const axios = require('axios');

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

