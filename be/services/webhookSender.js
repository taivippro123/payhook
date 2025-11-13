const axios = require('axios');
const WebhookLog = require('../models/webhookLog');
const { broadcastWebhookLog, broadcastWebhookLogUpdate } = require('./wsHub');

const MAX_SERIALIZED_LENGTH = 8000;

function safeClone(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    const str = typeof value === 'string' ? value : String(value);
    return str.length > MAX_SERIALIZED_LENGTH
      ? `${str.slice(0, MAX_SERIALIZED_LENGTH)}...(truncated)`
      : str;
  }
}

function safeString(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    return value.length > MAX_SERIALIZED_LENGTH
      ? `${value.slice(0, MAX_SERIALIZED_LENGTH)}...(truncated)`
      : value;
  }
  try {
    const str = JSON.stringify(value);
    return str.length > MAX_SERIALIZED_LENGTH
      ? `${str.slice(0, MAX_SERIALIZED_LENGTH)}...(truncated)`
      : str;
  } catch (error) {
    return String(value);
  }
}

async function safeLog(fn) {
  try {
    return await fn();
  } catch (error) {
    console.error('❌ WebhookLog persistence error:', error.message, error.stack);
    return null;
  }
}

/**
 * Tính số Fibonacci thứ n (bắt đầu từ 0: 1, 1, 2, 3, 5, 8, ...)
 * @param {number} n - Vị trí trong dãy Fibonacci (0-indexed)
 * @returns {number} Số Fibonacci thứ n
 */
function fibonacci(n) {
  if (n <= 0) return 1;
  if (n === 1) return 1;
  let a = 1, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

/**
 * Chuyển đổi error message sang tiếng Việt
 * @param {string} errorMessage - Error message gốc
 * @returns {string} Error message đã được dịch sang tiếng Việt
 */
function translateErrorMessage(errorMessage) {
  if (!errorMessage) return errorMessage;
  
  const errorMap = {
    'timeout of 10000ms exceeded': 'Đã vượt quá thời gian chờ 10 giây',
    'timeout of': 'Đã vượt quá thời gian chờ',
    'ECONNREFUSED': 'Không thể kết nối đến máy chủ',
    'ENOTFOUND': 'Không tìm thấy máy chủ',
    'ETIMEDOUT': 'Hết thời gian kết nối',
    'ECONNABORTED': 'Kết nối bị hủy',
    'Network Error': 'Lỗi mạng',
  };

  // Kiểm tra exact match trước
  if (errorMap[errorMessage]) {
    return errorMap[errorMessage];
  }

  // Kiểm tra partial match (cho timeout với các giá trị khác nhau)
  if (errorMessage.includes('timeout of') && errorMessage.includes('exceeded')) {
    const timeoutMatch = errorMessage.match(/timeout of (\d+)ms exceeded/);
    if (timeoutMatch) {
      const timeoutMs = parseInt(timeoutMatch[1], 10);
      const timeoutSeconds = timeoutMs / 1000;
      return `Đã vượt quá thời gian chờ ${timeoutSeconds} giây`;
    }
    return 'Đã vượt quá thời gian chờ';
  }

  // Kiểm tra các error code khác
  for (const [key, value] of Object.entries(errorMap)) {
    if (errorMessage.includes(key)) {
      return value;
    }
  }

  return errorMessage; // Trả về nguyên bản nếu không tìm thấy
}

/**
 * Gửi webhook với retry logic (tối đa 5 lần) và ghi log chi tiết
 * Retry delay theo dãy Fibonacci × 10: 10s, 10s, 20s, 30s, 50s
 * @param {string} webhookUrl - URL để gửi webhook
 * @param {Object} payload - Dữ liệu gửi đi
 * @param {number} maxRetries - Số lần retry tối đa (default: 5)
 * @param {Object} meta - Thông tin bổ sung { userId, userEmail, emailConfigId, emailConfigEmail, transactionDocId, transactionId }
 * @returns {Promise<{success: boolean, attempts: number, statusCode?: number, error?: string, logId?: string}>}
 */
async function sendWebhook(webhookUrl, payload, maxRetries = 5, meta = {}) {
  console.log('🚀 [sendWebhook] FUNCTION CALLED - Version with logging enabled');
  console.log('🚀 [sendWebhook] Parameters:', {
    webhookUrl,
    hasPayload: !!payload,
    maxRetries,
    hasMeta: !!meta,
    userId: meta?.userId,
    transactionId: meta?.transactionId,
  });

  if (!webhookUrl) {
    console.warn('⚠️ [sendWebhook] No webhook URL provided');
    return { success: false, attempts: 0, error: 'Webhook URL is not configured' };
  }

  let lastError = null;
  let lastStatusCode = null;
  let attempts = 0;
  let logRecord = null;

  console.log('🔍 [sendWebhook] About to create webhook log', {
    webhookUrl,
    hasMeta: !!meta,
    userId: meta?.userId,
    transactionId: meta?.transactionId,
  });

  try {
    logRecord = await WebhookLog.create({
      webhookUrl,
      payload: safeClone(payload),
      userId: meta.userId,
      userEmail: meta.userEmail,
      emailConfigId: meta.emailConfigId,
      emailConfigEmail: meta.emailConfigEmail,
      transactionDocId: meta.transactionDocId,
      transactionId: meta.transactionId,
    });
    console.log('✅ [sendWebhook] Webhook log created:', logRecord?._id?.toString());
    
    if (!logRecord || !logRecord._id) {
      console.warn('⚠️  Webhook log was not created (returned null/undefined) for', webhookUrl);
    } else {
      // Broadcast webhook log mới tạo
      try {
        const userIdStr = meta.userId?.toString();
        if (userIdStr) {
          broadcastWebhookLog(logRecord, userIdStr);
        }
      } catch (broadcastError) {
        console.error('❌ [sendWebhook] Failed to broadcast webhook log:', broadcastError.message);
      }
    }
  } catch (logError) {
    console.error('❌ [sendWebhook] Failed to create webhook log:', logError.message);
    console.error('❌ [sendWebhook] Stack:', logError.stack);
    // Tiếp tục gửi webhook dù không log được
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    attempts = attempt;
    const startedAt = Date.now();
    try {
      const response = await axios.post(webhookUrl, payload, {
        timeout: 10000, // 10 seconds timeout
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Payhook/1.0',
        },
      });

      lastStatusCode = response.status;

      const updatedAfterAttempt = await safeLog(() =>
        WebhookLog.appendAttempt(logRecord?._id, {
          attemptNumber: attempt,
          success: true,
          statusCode: response.status,
          responseBody: safeClone(response.data),
          durationMs: Date.now() - startedAt,
          requestedAt: new Date(startedAt),
          completedAt: new Date(),
        })
      );

      const updatedAfterComplete = await safeLog(() =>
        WebhookLog.markCompleted(logRecord?._id, {
          success: true,
          finalStatusCode: response.status,
        })
      );

      // Broadcast update
      if (updatedAfterComplete && meta.userId) {
        try {
          const userIdStr = meta.userId.toString();
          broadcastWebhookLogUpdate(updatedAfterComplete, userIdStr);
        } catch (broadcastError) {
          console.error('❌ [sendWebhook] Failed to broadcast webhook log update:', broadcastError.message);
        }
      }

      console.log(`✅ Webhook sent successfully (attempt ${attempt}/${maxRetries}):`, webhookUrl);
      return {
        success: true,
        attempts,
        statusCode: response.status,
        response: response.data,
        logId: logRecord?._id ? logRecord._id.toString() : undefined,
      };
    } catch (error) {
      lastStatusCode = error.response?.status ?? null;
      const rawError = error.response
        ? `HTTP ${error.response.status}: ${error.response.statusText || error.message}`
        : error.message;
      
      // Chuyển đổi error message sang tiếng Việt
      lastError = translateErrorMessage(rawError);

      console.error(`❌ Webhook send failed (attempt ${attempt}/${maxRetries}):`, lastError);

      const updatedAfterAttempt = await safeLog(() =>
        WebhookLog.appendAttempt(logRecord?._id, {
          attemptNumber: attempt,
          success: false,
          statusCode: lastStatusCode,
          errorMessage: safeString(lastError),
          responseBody: safeClone(error.response?.data),
          durationMs: Date.now() - startedAt,
          requestedAt: new Date(startedAt),
          completedAt: new Date(),
        })
      );

      // Broadcast update sau mỗi attempt
      if (updatedAfterAttempt && meta.userId) {
        try {
          const userIdStr = meta.userId.toString();
          broadcastWebhookLogUpdate(updatedAfterAttempt, userIdStr);
        } catch (broadcastError) {
          console.error('❌ [sendWebhook] Failed to broadcast webhook log update:', broadcastError.message);
        }
      }

      // Nếu là lỗi 4xx (client error), không retry
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        console.warn('⚠️  Client error detected, stopping retries');
        break;
      }

      // Nếu không phải lần cuối, đợi một chút trước khi retry (Fibonacci × 10 delay)
      // Delay: 10s, 10s, 20s, 30s, 50s (Fibonacci: 1, 1, 2, 3, 5 × 10)
      if (attempt < maxRetries) {
        const fibIndex = attempt - 1; // attempt 1 -> index 0, attempt 2 -> index 1, ...
        const fibValue = fibonacci(fibIndex);
        const delay = fibValue * 10000; // Fibonacci × 10 seconds (convert to milliseconds)
        console.log(`⏳ Waiting ${delay / 1000}s before retry ${attempt + 1}/${maxRetries} (Fibonacci delay)`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  const updatedAfterComplete = await safeLog(() =>
    WebhookLog.markCompleted(logRecord?._id, {
      success: false,
      finalStatusCode: lastStatusCode,
      errorMessage: safeString(lastError),
    })
  );

  // Broadcast update khi hoàn thành (thất bại)
  if (updatedAfterComplete && meta.userId) {
    try {
      const userIdStr = meta.userId.toString();
      broadcastWebhookLogUpdate(updatedAfterComplete, userIdStr);
    } catch (broadcastError) {
      console.error('❌ [sendWebhook] Failed to broadcast webhook log update:', broadcastError.message);
    }
  }

  console.error(`❌ Webhook failed after ${attempts} attempts:`, webhookUrl, lastError);

  return {
    success: false,
    attempts,
    statusCode: lastStatusCode ?? undefined,
    error: lastError,
    logId: logRecord?._id ? logRecord._id.toString() : undefined,
  };
}

module.exports = {
  sendWebhook,
};

