const WebSocket = require('ws');

// Map để lưu WebSocket connections theo URL
const connections = new Map();

// Request ID counter để đảm bảo mỗi request có ID unique
let requestIdCounter = 1;

/**
 * Tạo hoặc lấy WebSocket connection tới Xiaozhi MCP endpoint
 * @param {string} mcpUrl - Xiaozhi MCP WebSocket URL
 * @returns {Promise<WebSocket>}
 */
async function getOrCreateConnection(mcpUrl) {
  // Nếu đã có connection và đang OPEN, return luôn
  if (connections.has(mcpUrl)) {
    const ws = connections.get(mcpUrl);
    if (ws && ws.readyState === WebSocket.OPEN) {
      return ws;
    }
    // Nếu connection đã đóng, xóa khỏi map
    if (ws) {
      connections.delete(mcpUrl);
    }
  }

  return new Promise((resolve, reject) => {
    console.log(`🔌 Connecting to Xiaozhi MCP: ${mcpUrl}`);
    
    const ws = new WebSocket(mcpUrl, {
      handshakeTimeout: 10000, // 10 seconds timeout
    });

    ws.on('open', () => {
      console.log(`✅ Connected to Xiaozhi MCP: ${mcpUrl}`);
      connections.set(mcpUrl, ws);
      resolve(ws);
    });

    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for ${mcpUrl}:`, error.message);
      connections.delete(mcpUrl);
      reject(error);
    });

    ws.on('close', () => {
      console.log(`🔌 Disconnected from Xiaozhi MCP: ${mcpUrl}`);
      connections.delete(mcpUrl);
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
 * @param {string} mcpUrl - Xiaozhi MCP WebSocket URL
 * @param {Object} payload - JSON-RPC 2.0 payload
 * @returns {Promise<Object>} Response từ server
 */
async function sendMcpMessage(mcpUrl, payload) {
  try {
    const ws = await getOrCreateConnection(mcpUrl);
    
    // Tạo MCP message format theo protocol
    const mcpMessage = {
      session_id: `payhook_${Date.now()}`, // Session ID tạm thời
      type: 'mcp',
      payload: {
        jsonrpc: '2.0',
        ...payload,
      },
    };

    // Nếu là request (có method), thêm ID
    if (payload.method && !payload.id) {
      mcpMessage.payload.id = requestIdCounter++;
    }

    return new Promise((resolve, reject) => {
      // Nếu là notification (không có id), gửi và resolve ngay
      if (!mcpMessage.payload.id) {
        try {
          ws.send(JSON.stringify(mcpMessage), (error) => {
            if (error) {
              reject(error);
            } else {
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
        reject(new Error('MCP message timeout'));
      }, 10000);

      const messageHandler = (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'mcp' && message.payload && message.payload.id === mcpMessage.payload.id) {
            clearTimeout(timeout);
            ws.removeListener('message', messageHandler);
            
            if (message.payload.error) {
              reject(new Error(message.payload.error.message || 'MCP error'));
            } else {
              resolve(message.payload.result || message.payload);
            }
          }
        } catch (error) {
          // Không phải response cho request này, bỏ qua
        }
      };
      
      ws.on('message', messageHandler);

      // Gửi message
      try {
        ws.send(JSON.stringify(mcpMessage), (error) => {
          if (error) {
            clearTimeout(timeout);
            ws.removeListener('message', messageHandler);
            reject(error);
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
 * Gửi thông báo giao dịch tới Xiaozhi MCP
 * Format message để AI có thể đọc số tiền
 * @param {string} mcpUrl - Xiaozhi MCP WebSocket URL
 * @param {Object} transaction - Transaction data
 * @returns {Promise<void>}
 */
async function sendTransactionNotification(mcpUrl, transaction) {
  try {
    const amountVND = transaction.amountVND || 0;
    
    // Format số tiền theo định dạng Việt Nam
    const amountFormatted = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amountVND);

    // Tạo message để AI đọc
    const message = `Đã nhận ${amountFormatted}`;
    
    console.log(`📤 Sending transaction notification to Xiaozhi MCP: ${message}`);

    // Gửi notification qua MCP
    // Sử dụng notification (không có id) để gửi message cho AI
    await sendMcpMessage(mcpUrl, {
      method: 'notifications/transaction',
      params: {
        message: message,
        amount: amountVND,
        amountFormatted: amountFormatted,
        transactionId: transaction.transactionId,
        description: transaction.description,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`✅ Transaction notification sent to Xiaozhi MCP`);
  } catch (error) {
    console.error(`❌ Failed to send transaction notification to Xiaozhi MCP:`, error.message);
    // Không throw để không ảnh hưởng đến flow chính
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
  closeAllConnections,
};

