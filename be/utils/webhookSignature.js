const crypto = require('crypto');

/**
 * Tạo webhook signature sử dụng HMAC-SHA256
 * @param {string} payload - Payload JSON string
 * @param {string} secret - Secret key (từ user's webhook secret hoặc global secret)
 * @returns {string} Signature (hex encoded)
 */
function createSignature(payload, secret) {
  if (!secret) {
    throw new Error('Webhook secret is required');
  }
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

/**
 * Verify webhook signature
 * @param {string} payload - Payload JSON string
 * @param {string} signature - Signature từ header
 * @param {string} secret - Secret key
 * @returns {boolean} True nếu signature hợp lệ
 */
function verifySignature(payload, signature, secret) {
  if (!signature || !secret) {
    return false;
  }
  
  try {
    const expectedSignature = createSignature(payload, secret);
    // Use constant-time comparison để tránh timing attack
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('❌ Signature verification error:', error.message);
    return false;
  }
}

/**
 * Tạo webhook secret cho user (nếu chưa có)
 * @returns {string} Random secret (32 bytes hex)
 */
function generateWebhookSecret() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  createSignature,
  verifySignature,
  generateWebhookSecret,
};

