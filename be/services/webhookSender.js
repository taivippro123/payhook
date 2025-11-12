const axios = require('axios');
const WebhookLog = require('../models/webhookLog');

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
    await fn();
  } catch (error) {
    console.error('❌ WebhookLog persistence error:', error.message);
  }
}

/**
 * Gửi webhook với retry logic (tối đa 3 lần) và ghi log chi tiết
 * @param {string} webhookUrl - URL để gửi webhook
 * @param {Object} payload - Dữ liệu gửi đi
 * @param {number} maxRetries - Số lần retry tối đa (default: 3)
 * @param {Object} meta - Thông tin bổ sung { userId, userEmail, emailConfigId, emailConfigEmail, transactionDocId, transactionId }
 * @returns {Promise<{success: boolean, attempts: number, statusCode?: number, error?: string, logId?: string}>}
 */
async function sendWebhook(webhookUrl, payload, maxRetries = 3, meta = {}) {
  if (!webhookUrl) {
    return { success: false, attempts: 0, error: 'Webhook URL is not configured' };
  }

  let lastError = null;
  let lastStatusCode = null;
  let attempts = 0;
  let logRecord = null;

  await safeLog(async () => {
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
  });

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

      await safeLog(() =>
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

      await safeLog(() =>
        WebhookLog.markCompleted(logRecord?._id, {
          success: true,
          finalStatusCode: response.status,
        })
      );

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
      lastError = error.response
        ? `HTTP ${error.response.status}: ${error.response.statusText || error.message}`
        : error.message;

      console.error(`❌ Webhook send failed (attempt ${attempt}/${maxRetries}):`, lastError);

      await safeLog(() =>
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

      // Nếu là lỗi 4xx (client error), không retry
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        console.warn('⚠️  Client error detected, stopping retries');
        break;
      }

      // Nếu không phải lần cuối, đợi một chút trước khi retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s, 2s, 4s (max 5s)
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  await safeLog(() =>
    WebhookLog.markCompleted(logRecord?._id, {
      success: false,
      finalStatusCode: lastStatusCode,
      errorMessage: safeString(lastError),
    })
  );

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


/**
 * Gửi webhook với retry logic (tối đa 3 lần)
 * @param {string} webhookUrl - URL để gửi webhook
 * @param {Object} payload - Dữ liệu gửi đi
 * @param {number} maxRetries - Số lần retry tối đa (default: 3)
 * @returns {Promise<{success: boolean, attempts: number, error?: string}>}
 */
async function sendWebhook(webhookUrl, payload, maxRetries = 3) {
  if (!webhookUrl) {
    return { success: false, attempts: 0, error: 'Webhook URL is not configured' };
  }

  let lastError = null;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    attempts = attempt;
    try {
      const response = await axios.post(webhookUrl, payload, {
        timeout: 10000, // 10 seconds timeout
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Payhook/1.0',
        },
      });

      // Xem như thành công nếu status code 2xx
      if (response.status >= 200 && response.status < 300) {
        console.log(`✅ Webhook sent successfully (attempt ${attempt}/${maxRetries}):`, webhookUrl);
        return { success: true, attempts, statusCode: response.status };
      }

      // Nếu không phải 2xx, coi như lỗi và retry
      lastError = `HTTP ${response.status}: ${response.statusText}`;
      console.warn(`⚠️  Webhook returned non-2xx status (attempt ${attempt}/${maxRetries}):`, lastError);

    } catch (error) {
      lastError = error.response
        ? `HTTP ${error.response.status}: ${error.response.statusText || error.message}`
        : error.message;

      console.error(`❌ Webhook send failed (attempt ${attempt}/${maxRetries}):`, lastError);

      // Nếu là lỗi 4xx (client error), không retry
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        console.warn(`⚠️  Client error detected, stopping retries`);
        break;
      }

      // Nếu không phải lần cuối, đợi một chút trước khi retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s, 2s, 4s (max 5s)
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`❌ Webhook failed after ${attempts} attempts:`, webhookUrl, lastError);
  return { success: false, attempts, error: lastError };
}

module.exports = {
  sendWebhook,
};

