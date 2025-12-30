const WebSocket = require('ws');
const Transaction = require('../models/transaction');
const { ObjectId } = require('mongodb');

// Map để lưu WebSocket connections theo URL
const connections = new Map();

// Map để lưu trạng thái initialized của mỗi connection
const initializedConnections = new Map();

// Map để lưu userId và emailConfigId theo mcpUrl
const connectionMetadata = new Map();

// Request ID counter để đảm bảo mỗi request có ID unique
let requestIdCounter = 1;

/**
 * Tạo hoặc lấy WebSocket connection tới Xiaozhi MCP endpoint
 * @param {string} mcpUrl - Xiaozhi MCP WebSocket URL
 * @param {string} userId - User ID (optional, để lưu metadata)
 * @param {string} emailConfigId - Email Config ID (optional, để lưu metadata)
 * @returns {Promise<WebSocket>}
 */
async function getOrCreateConnection(mcpUrl, userId = null, emailConfigId = null) {
  // Nếu đã có connection và đang OPEN và đã initialized
  if (connections.has(mcpUrl)) {
    const ws = connections.get(mcpUrl);
    if (ws && ws.readyState === WebSocket.OPEN && initializedConnections.get(mcpUrl)) {
      // Update metadata nếu có (quan trọng: có thể connection được tạo khi test không có metadata)
      if (userId && emailConfigId) {
        connectionMetadata.set(mcpUrl, { userId, emailConfigId });
        console.log(`📝 Updated metadata for existing connection: userId=${userId}, emailConfigId=${emailConfigId}`);
      }
      return ws;
    }
    // Nếu connection đã đóng hoặc chưa initialized, xóa khỏi map
    if (ws) {
      connections.delete(mcpUrl);
      initializedConnections.delete(mcpUrl);
      connectionMetadata.delete(mcpUrl);
    }
  }

  return new Promise((resolve, reject) => {
    console.log(`🔌 Connecting to Xiaozhi MCP: ${mcpUrl}`);
    
    const ws = new WebSocket(mcpUrl, {
      handshakeTimeout: 10000, // 10 seconds timeout
    });

    let initTimeout = null;
    let isResolved = false;

    // Đợi initialize từ server
    const markInitialized = () => {
      if (initTimeout) {
        clearTimeout(initTimeout);
        initTimeout = null;
      }
      if (!isResolved) {
        isResolved = true;
        initializedConnections.set(mcpUrl, true);
        resolve(ws);
      }
    };

    ws.on('open', () => {
      console.log(`✅ Connected to Xiaozhi MCP: ${mcpUrl}`);
      connections.set(mcpUrl, ws);
      initializedConnections.set(mcpUrl, false); // Chưa initialized
      
      // Lưu metadata nếu có
      if (userId && emailConfigId) {
        connectionMetadata.set(mcpUrl, { userId, emailConfigId });
        console.log(`📝 Stored metadata for connection: userId=${userId}, emailConfigId=${emailConfigId}`);
      }
      
      // Timeout nếu không nhận được initialize trong 5 giây
      initTimeout = setTimeout(() => {
        if (!initializedConnections.get(mcpUrl)) {
          console.warn(`⚠️ Initialize timeout, continuing anyway...`);
          markInitialized();
        }
      }, 5000);
    });
    
    // Thêm listener để xử lý initialize, ping/pong và log messages
    ws.on('message', (data) => {
      try {
        const messageStr = data.toString();
        console.log(`📥 [Raw] Received from Xiaozhi MCP:`, messageStr.substring(0, 500));
        
        // Log tất cả messages để debug
        const parsed = JSON.parse(messageStr);
        if (parsed.method) {
          console.log(`📥 [Debug] Received method: ${parsed.method}, id: ${parsed.id || 'none'}`);
        }
        
        // Parse message
        const message = JSON.parse(messageStr);
        
        // Xử lý initialize request từ server
        if (message.method === 'initialize' && message.jsonrpc === '2.0' && message.id !== undefined) {
          console.log(`🔧 Received initialize request (id: ${message.id}), sending response`);
          
          // Trả lời initialize
          const initResponse = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              protocolVersion: message.params?.protocolVersion || '2024-11-05',
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: 'payhook',
                version: '1.0.0',
              },
            },
          };
          
          ws.send(JSON.stringify(initResponse), (error) => {
            if (error) {
              console.error(`❌ Failed to send initialize response:`, error.message);
              // Vẫn mark as initialized để không block
              markInitialized();
            } else {
              console.log(`✅ Initialize response sent successfully`);
              markInitialized();
            }
          });
          return; // Không xử lý tiếp
        }
        
        // Xử lý tools/list request từ server
        if (message.method === 'tools/list' && message.jsonrpc === '2.0' && message.id !== undefined) {
          console.log(`🔧 Received tools/list request (id: ${message.id}), sending response`);
          
          // Expose tools để AI tự động kiểm tra payment mới và cho phép user hỏi
          const toolsListResponse = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              tools: [
                {
                  name: 'check_unnotified_payment',
                  description: 'Kiểm tra xem có giao dịch thanh toán mới nào chưa được thông báo không. Tool này PHẢI được gọi TỰ ĐỘNG ngay khi bạn được đánh thức (wakeup) hoặc khi một chat session mới bắt đầu, KHÔNG CẦN đợi người dùng hỏi. Nếu có giao dịch mới, bạn phải thông báo cho người dùng ngay lập tức với số tiền chính xác bằng chữ (ví dụ: "một triệu hai mươi sáu nghìn hai trăm lẻ một đồng").',
                  inputSchema: {
                    type: 'object',
                    properties: {},
                    required: [],
                  },
                },
                {
                  name: 'check_payment_status',
                  description: 'Kiểm tra trạng thái thanh toán và số tiền đã nhận. Sử dụng tool này khi người dùng hỏi về tiền, thanh toán, hoặc muốn kiểm tra xem có tiền mới không. Tool này sẽ trả về thông tin về giao dịch thanh toán mới nhất nếu có.',
                  inputSchema: {
                    type: 'object',
                    properties: {},
                    required: [],
                  },
                },
              ],
            },
          };
          
          ws.send(JSON.stringify(toolsListResponse), (error) => {
            if (error) {
              console.error(`❌ Failed to send tools/list response:`, error.message);
            } else {
              console.log(`✅ Tools/list response sent successfully (exposed 2 tools: check_unnotified_payment, check_payment_status)`);
              
              // Sau khi tools/list được gửi, gửi message để trigger AI tự động check payment
              // Đợi một chút để đảm bảo tools/list đã được xử lý
              setTimeout(() => {
                try {
                  // Gửi message để trigger AI tự động gọi check_unnotified_payment khi wakeup
                  // Thử nhiều cách để trigger AI
                  
                  // Cách 1: Notification (không có id)
                  const notificationMessage = {
                    jsonrpc: '2.0',
                    method: 'notifications/message',
                    params: {
                      message: {
                        role: 'user',
                        content: {
                          type: 'text',
                          text: 'Khi bạn được đánh thức, hãy tự động gọi tool check_unnotified_payment để kiểm tra và thông báo thanh toán mới ngay.',
                        },
                      },
                    },
                  };
                  
                  ws.send(JSON.stringify(notificationMessage), (notifError) => {
                    if (notifError) {
                      console.warn(`⚠️ Failed to send wakeup notification:`, notifError.message);
                    } else {
                      console.log(`✅ Wakeup notification sent`);
                    }
                  });
                  
                  // Cách 2: Request message (có id, nhưng không đợi response)
                  setTimeout(() => {
                    try {
                      const requestMessage = {
                        jsonrpc: '2.0',
                        method: 'messages/create',
                        params: {
                          messages: [
                            {
                              role: 'user',
                              content: {
                                type: 'text',
                                text: 'Kiểm tra thanh toán mới. Gọi check_unnotified_payment.',
                              },
                            },
                          ],
                        },
                        id: requestIdCounter++,
                      };
                      
                      ws.send(JSON.stringify(requestMessage), (reqError) => {
                        if (reqError) {
                          console.warn(`⚠️ Failed to send wakeup request:`, reqError.message);
                        } else {
                          console.log(`✅ Wakeup request sent (id: ${requestMessage.id})`);
                        }
                      });
                    } catch (reqErr) {
                      console.warn(`⚠️ Error sending wakeup request:`, reqErr.message);
                    }
                  }, 500);
                } catch (triggerErr) {
                  console.warn(`⚠️ Error sending wakeup trigger:`, triggerErr.message);
                }
              }, 1000);
            }
          });
          return; // Không xử lý tiếp
        }
        
        // Xử lý tools/call request từ server (AI gọi tool của chúng ta)
        if (message.method === 'tools/call' && message.jsonrpc === '2.0' && message.id !== undefined) {
          console.log(`🔧 Received tools/call request (id: ${message.id}):`, JSON.stringify(message.params).substring(0, 200));
          
          const toolName = message.params?.name;
          
          // Xử lý cả 2 tools: check_unnotified_payment và check_payment_status
          if (toolName === 'check_unnotified_payment' || toolName === 'check_payment_status') {
            // Xử lý async trong IIFE
            (async () => {
              try {
                // Lấy metadata từ connection
                let metadata = connectionMetadata.get(mcpUrl);
                
                // Nếu không có metadata, thử lấy từ emailConfig (tìm config có mcpUrl này)
                if (!metadata || !metadata.userId) {
                  console.warn(`⚠️ No metadata in connection, trying to find from emailConfig...`);
                  
                  try {
                    const EmailConfig = require('../models/emailConfig');
                    const { getDB } = require('../db');
                    const db = await getDB();
                    const configs = db.collection('email_configs');
                    
                    const config = await configs.findOne({ xiaozhiMcpUrl: mcpUrl });
                    if (config && config.userId) {
                      metadata = {
                        userId: config.userId.toString(),
                        emailConfigId: config._id.toString(),
                      };
                      connectionMetadata.set(mcpUrl, metadata);
                      console.log(`✅ Found metadata from emailConfig: userId=${metadata.userId}, emailConfigId=${metadata.emailConfigId}`);
                    }
                  } catch (configError) {
                    console.error(`❌ Error finding emailConfig:`, configError.message);
                  }
                }
                
                if (!metadata || !metadata.userId) {
                  console.error(`❌ No metadata found for connection: ${mcpUrl}`);
                  const errorResponse = {
                    jsonrpc: '2.0',
                    id: message.id,
                    error: {
                      code: -32603,
                      message: 'Internal error: No user metadata found. Please reconnect MCP endpoint.',
                    },
                  };
                  ws.send(JSON.stringify(errorResponse));
                  return;
                }
                
                const { userId, emailConfigId } = metadata;
                
                // Query DB tìm transaction
                const { getDB } = require('../db');
                const db = await getDB();
                const transactions = db.collection('transactions');
                
                let latestTransaction;
                let isUnnotified = false;
                
                if (toolName === 'check_unnotified_payment') {
                  // Chỉ tìm transaction chưa được notify
                  console.log(`🔍 Checking unnotified payments for userId: ${userId}`);
                  latestTransaction = await transactions
                    .find({
                      userId: new ObjectId(userId),
                      $or: [
                        { xiaozhiNotified: { $exists: false } },
                        { xiaozhiNotified: false },
                      ],
                    })
                    .sort({ detectedAt: -1, createdAt: -1 })
                    .limit(1)
                    .next();
                  isUnnotified = true;
                } else {
                  // check_payment_status: tìm transaction mới nhất (kể cả đã notify)
                  console.log(`🔍 Checking payment status for userId: ${userId}`);
                  latestTransaction = await transactions
                    .find({
                      userId: new ObjectId(userId),
                    })
                    .sort({ detectedAt: -1, createdAt: -1 })
                    .limit(1)
                    .next();
                }
                
                if (latestTransaction && latestTransaction.amountVND > 0) {
                  // Có transaction - đánh dấu đã notify nếu là check_unnotified_payment
                  if (isUnnotified) {
                    await transactions.updateOne(
                      { _id: latestTransaction._id },
                      { $set: { xiaozhiNotified: true, xiaozhiNotifiedAt: new Date() } }
                    );
                  }
                  
                  // Chuyển số tiền thành chữ
                  const amountInWords = numberToVietnameseWords(latestTransaction.amountVND);
                  // Format số tiền với dấu chấm phân cách hàng nghìn
                  const formattedAmount = latestTransaction.amountVND.toLocaleString('vi-VN');
                  
                  console.log(`✅ Found payment: ${latestTransaction.amountVND} VND (${formattedAmount} đồng)`);
                  
                  // Trả về thông tin để AI nói - format text trực tiếp với hướng dẫn rõ ràng
                  const toolResponse = {
                    jsonrpc: '2.0',
                    id: message.id,
                    result: {
                      content: [
                        {
                          type: 'text',
                          text: `Đã nhận ${amountInWords} đồng. Số tiền chính xác là ${formattedAmount} đồng. Bạn phải nói đúng số tiền này, không được làm tròn hay nói "hơn một triệu" hay "khoảng một triệu".`,
                        },
                      ],
                    },
                  };
                  
                  ws.send(JSON.stringify(toolResponse), (error) => {
                    if (error) {
                      console.error(`❌ Failed to send tool response:`, error.message);
                    } else {
                      console.log(`✅ Tool response sent. AI should announce: "Đã nhận ${amountInWords} đồng"`);
                    }
                  });
                } else {
                  // Không có transaction
                  console.log(`ℹ️ No payments found`);
                  
                  const toolResponse = {
                    jsonrpc: '2.0',
                    id: message.id,
                    result: {
                      content: [
                        {
                          type: 'text',
                          text: 'Không có giao dịch thanh toán mới',
                        },
                      ],
                    },
                  };
                  
                  ws.send(JSON.stringify(toolResponse), (error) => {
                    if (error) {
                      console.error(`❌ Failed to send tool response:`, error.message);
                    } else {
                      console.log(`✅ Tool response sent (no payments)`);
                    }
                  });
                }
              } catch (dbError) {
                console.error(`❌ Database error:`, dbError.message);
                const errorResponse = {
                  jsonrpc: '2.0',
                  id: message.id,
                  error: {
                    code: -32603,
                    message: `Database error: ${dbError.message}`,
                  },
                };
                ws.send(JSON.stringify(errorResponse));
              }
            })();
            return; // Không xử lý tiếp
          }
        }
        
        // Xử lý ping message từ server
        if (message.method === 'ping' && message.jsonrpc === '2.0' && message.id) {
          console.log(`🏓 Received ping, sending pong (id: ${message.id})`);
          
          // Trả lời pong
          const pongResponse = {
            jsonrpc: '2.0',
            id: message.id,
            result: 'pong',
          };
          
          ws.send(JSON.stringify(pongResponse), (error) => {
            if (error) {
              console.error(`❌ Failed to send pong:`, error.message);
            } else {
              console.log(`✅ Pong sent successfully`);
            }
          });
          return; // Không xử lý tiếp
        }
        
        // Bỏ qua notifications (không có id)
        if (message.method && message.jsonrpc === '2.0' && message.id === undefined) {
          console.log(`📢 Received notification: ${message.method}`);
          return; // Không xử lý tiếp
        }
        
        // Các message khác sẽ được xử lý trong sendMcpMessage
      } catch (error) {
        console.log(`⚠️ Failed to parse message:`, error.message);
        console.log(`📥 [Raw] Message content:`, data.toString().substring(0, 500));
      }
    });

    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for ${mcpUrl}:`, error.message);
      connections.delete(mcpUrl);
      reject(error);
    });

    ws.on('close', () => {
      console.log(`🔌 Disconnected from Xiaozhi MCP: ${mcpUrl}`);
      connections.delete(mcpUrl);
      initializedConnections.delete(mcpUrl);
      connectionMetadata.delete(mcpUrl);
    });

    // Timeout nếu không kết nối được trong 10 giây
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.terminate();
        connections.delete(mcpUrl);
        reject(new Error('Connection timeout'));
      }
    }, 10000);
  });
}

/**
 * Gửi MCP message qua WebSocket
 * Hỗ trợ cả 2 format: với wrapper và JSON-RPC 2.0 trực tiếp
 * @param {string} mcpUrl - Xiaozhi MCP WebSocket URL
 * @param {Object} payload - JSON-RPC 2.0 payload
 * @returns {Promise<Object>} Response từ server
 */
async function sendMcpMessage(mcpUrl, payload) {
  try {
    const ws = await getOrCreateConnection(mcpUrl);
    
    // Tạo JSON-RPC 2.0 message
    const jsonRpcMessage = {
        jsonrpc: '2.0',
        ...payload,
    };

    // Nếu là request (có method), thêm ID nếu chưa có
    if (jsonRpcMessage.method && !jsonRpcMessage.id) {
      jsonRpcMessage.id = requestIdCounter++;
    }

    // Thử cả 2 format: wrapper và trực tiếp
    const messageWithWrapper = {
      session_id: `payhook_${Date.now()}`,
      type: 'mcp',
      payload: jsonRpcMessage,
    };

    // Log message gửi đi
    console.log(`📤 Sending MCP message (direct JSON-RPC):`, JSON.stringify(jsonRpcMessage).substring(0, 500));

    return new Promise((resolve, reject) => {
      // Nếu là notification (không có id), gửi và resolve ngay
      if (!jsonRpcMessage.id) {
        // Gửi trực tiếp JSON-RPC 2.0 (không dùng wrapper)
        try {
          ws.send(JSON.stringify(jsonRpcMessage), (error) => {
            if (error) {
              console.error(`❌ Failed to send message:`, error.message);
              reject(error);
            } else {
              console.log(`✅ Notification sent successfully`);
              resolve({ success: true });
            }
          });
        } catch (error) {
          reject(error);
        }
        return;
      }

      // Nếu là request (có id), đợi response
      const timeout = setTimeout(() => {
        ws.removeListener('message', messageHandler);
        console.error(`❌ MCP message timeout after 10s for id: ${jsonRpcMessage.id}`);
        reject(new Error('MCP message timeout'));
      }, 10000);

      const messageHandler = (data) => {
        try {
          const rawStr = data.toString();
          
          // Bỏ qua ping messages (đã được xử lý ở listener chính)
          if (rawStr.includes('"method":"ping"')) {
            return;
          }
          
          console.log(`📥 Processing response for id ${jsonRpcMessage.id}:`, rawStr.substring(0, 500));
          
          const rawMessage = JSON.parse(rawStr);
          
          // Kiểm tra format response
          let responsePayload = null;
          let responseId = null;
          
          // Format trực tiếp JSON-RPC 2.0 (theo log, Xiaozhi dùng format này)
          if (rawMessage.jsonrpc === '2.0' && rawMessage.id !== undefined) {
            responsePayload = rawMessage;
            responseId = rawMessage.id;
            console.log(`📥 Detected JSON-RPC 2.0 format, id: ${responseId}`);
          }
          // Format với wrapper (backup)
          else if (rawMessage.type === 'mcp' && rawMessage.payload) {
            responsePayload = rawMessage.payload;
            responseId = rawMessage.payload.id;
            console.log(`📥 Detected wrapper format, id: ${responseId}`);
          }
          // Unknown format
          else {
            console.log(`📥 Unknown format:`, rawStr.substring(0, 200));
            return; // Không phải response cho request này
          }
          
          // Kiểm tra xem có phải response cho request này không
          if (responsePayload && responseId === jsonRpcMessage.id) {
            clearTimeout(timeout);
            ws.removeListener('message', messageHandler);
            
            if (responsePayload.error) {
              console.error(`❌ MCP error response:`, responsePayload.error);
              reject(new Error(responsePayload.error.message || 'MCP error'));
            } else {
              console.log(`✅ MCP success response:`, JSON.stringify(responsePayload.result || responsePayload).substring(0, 500));
              resolve(responsePayload.result || responsePayload);
            }
          }
        } catch (error) {
          // Không phải response cho request này, bỏ qua
          console.log(`⚠️ Failed to parse message in handler:`, error.message);
        }
      };
      
      ws.on('message', messageHandler);

      // Gửi message - chỉ dùng JSON-RPC 2.0 trực tiếp (theo format Xiaozhi sử dụng)
      try {
        ws.send(JSON.stringify(jsonRpcMessage), (error) => {
          if (error) {
            clearTimeout(timeout);
            ws.removeListener('message', messageHandler);
            console.error(`❌ Failed to send message:`, error.message);
            reject(error);
          } else {
            console.log(`✅ Request sent successfully (id: ${jsonRpcMessage.id})`);
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        ws.removeListener('message', messageHandler);
        reject(error);
      }
    });
  } catch (error) {
    console.error(`❌ Failed to send MCP message to ${mcpUrl}:`, error.message);
    throw error;
  }
}

/**
 * Chuyển đổi số tiền thành chữ tiếng Việt
 * @param {number} num - Số tiền cần chuyển đổi
 * @returns {string} Số tiền bằng chữ
 */
function numberToVietnameseWords(num) {
  const ones = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const tens = ["", "mười", "hai mươi", "ba mươi", "bốn mươi", "năm mươi", "sáu mươi", "bảy mươi", "tám mươi", "chín mươi"];

  if (num === 0) return "không";

  const toWordsBelowThousand = (n) => {
    let result = "";

    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    const ten = Math.floor(remainder / 10);
    const unit = remainder % 10;

    if (hundred > 0) {
      result += ones[hundred] + " trăm ";
      if (remainder > 0 && ten === 0) result += "lẻ ";
    }

    if (ten > 1) {
      result += tens[ten] + (unit ? " " + ones[unit] : "");
    } else if (ten === 1) {
      result += "mười" + (unit ? " " + ones[unit] : "");
    } else if (ten === 0 && unit > 0) {
      result += ones[unit];
    }

    return result.trim();
  };

  let result = "";
  const million = Math.floor(num / 1_000_000);
  const thousand = Math.floor((num % 1_000_000) / 1_000);
  const belowThousand = num % 1_000;

  if (million > 0) {
    result += toWordsBelowThousand(million) + " triệu ";
  }

  if (thousand > 0) {
    result += toWordsBelowThousand(thousand) + " nghìn ";
  } else if (million > 0 && (belowThousand > 0 || thousand === 0)) {
    result += "không nghìn ";
  }

  if (belowThousand > 0) {
    result += toWordsBelowThousand(belowThousand);
  }

  return result.trim();
}

/**
 * Gửi thông báo giao dịch tới Xiaozhi MCP để gửi về ESP32
 * Sử dụng MCP tool call theo tài liệu Xiaozhi
 * @param {string} mcpUrl - Xiaozhi MCP WebSocket URL
 * @param {Object} transaction - Transaction data
 * @returns {Promise<void>}
 */
/**
 * Gửi thông báo giao dịch tới Xiaozhi MCP
 * Lưu metadata để tool có thể query DB sau
 * @param {string} mcpUrl - Xiaozhi MCP WebSocket URL
 * @param {Object} transaction - Transaction data
 * @param {string} userId - User ID
 * @param {string} emailConfigId - Email Config ID
 * @returns {Promise<void>}
 */
async function sendTransactionNotification(mcpUrl, transaction, userId = null, emailConfigId = null) {
  try {
    if (mcpUrl && userId && emailConfigId) {
      // Tạo connection với metadata (nếu chưa có)
      const ws = await getOrCreateConnection(mcpUrl, userId, emailConfigId);
      
      // Đợi một chút để đảm bảo connection đã sẵn sàng
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Gửi message để trigger AI gọi check_unnotified_payment ngay
      // Thử nhiều cách để trigger AI
      try {
        // Cách 1: Gửi notification/message (không có id)
        const notificationMessage = {
          jsonrpc: '2.0',
          method: 'notifications/message',
          params: {
            message: {
              role: 'user',
              content: {
                type: 'text',
                text: 'Có giao dịch thanh toán mới. Hãy gọi tool check_unnotified_payment để kiểm tra và thông báo cho tôi ngay.',
              },
            },
          },
        };
        
        ws.send(JSON.stringify(notificationMessage), (error) => {
          if (error) {
            console.warn(`⚠️ Failed to send notification message:`, error.message);
          } else {
            console.log(`✅ Notification message sent to trigger AI`);
          }
        });
        
        // Cách 2: Gửi message với id nhưng không đợi response (fire and forget)
        // Đợi một chút rồi gửi thêm message có id
        setTimeout(() => {
          try {
            const requestMessage = {
              jsonrpc: '2.0',
              method: 'messages/create',
      params: {
                messages: [
                  {
                    role: 'user',
                    content: {
                      type: 'text',
                      text: 'Kiểm tra thanh toán mới. Gọi check_unnotified_payment.',
                    },
                  },
                ],
              },
              id: requestIdCounter++,
            };
            
            ws.send(JSON.stringify(requestMessage), (error) => {
              if (error) {
                console.warn(`⚠️ Failed to send request message:`, error.message);
              } else {
                console.log(`✅ Request message sent to trigger AI (id: ${requestMessage.id})`);
              }
            });
          } catch (reqError) {
            console.warn(`⚠️ Error sending request message:`, reqError.message);
          }
        }, 500);
      } catch (triggerError) {
        console.warn(`⚠️ Error sending trigger messages:`, triggerError.message);
      }
      
      console.log(`✅ Connection ready for MCP tool. Trigger sent to AI.`);
      console.log(`💰 Transaction saved: ${transaction.amountVND} VND`);
    } else {
      console.warn(`⚠️ Missing metadata for MCP connection (userId or emailConfigId)`);
    }
  } catch (error) {
    console.error(`❌ Failed to setup MCP connection:`, error.message);
    // Không throw để không ảnh hưởng đến flow chính
  }
}

/**
 * Test kết nối tới Xiaozhi MCP endpoint
 * @param {string} mcpUrl - Xiaozhi MCP WebSocket URL
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function testConnection(mcpUrl) {
  try {
    console.log(`🧪 Testing connection to Xiaozhi MCP: ${mcpUrl}`);
    
    // Thử kết nối và gọi tools/list để kiểm tra
    await getOrCreateConnection(mcpUrl);
    
    // Gọi tools/list để kiểm tra connection (sử dụng sendMcpMessage để đảm bảo consistency)
    const result = await sendMcpMessage(mcpUrl, {
      method: 'tools/list',
    });
    
    console.log(`✅ Connection test successful:`, result);
    return { success: true, message: 'Kết nối thành công' };
  } catch (error) {
    console.error(`❌ Connection test failed:`, error.message);
    return { success: false, message: `Lỗi kết nối: ${error.message}` };
  }
}

/**
 * Đóng tất cả WebSocket connections (dùng khi shutdown)
 */
function closeAllConnections() {
  console.log('🔌 Closing all Xiaozhi MCP connections...');
  for (const [url, ws] of connections.entries()) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  }
  connections.clear();
}

module.exports = {
  sendTransactionNotification,
  sendMcpMessage,
  getOrCreateConnection,
  testConnection,
  closeAllConnections,
};

