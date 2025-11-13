const url = require('url');

// Danh sách domain/IP không được phép (internal, localhost, private IPs)
const FORBIDDEN_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
];

const FORBIDDEN_PREFIXES = [
  '192.168.',
  '10.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  '169.254.', // Link-local
  '224.', // Multicast
  '240.', // Reserved
];

/**
 * Validate webhook URL
 * @param {string} webhookUrl - URL cần validate
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateWebhookUrl(webhookUrl) {
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    return { valid: false, error: 'Webhook URL is required' };
  }

  let parsedUrl;
  try {
    parsedUrl = new url.URL(webhookUrl);
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Chỉ cho phép HTTPS (trừ localhost trong development)
  const protocol = parsedUrl.protocol.toLowerCase();
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  if (protocol !== 'https:' && !(isDevelopment && protocol === 'http:' && parsedUrl.hostname === 'localhost')) {
    return { valid: false, error: 'Webhook URL must use HTTPS (except localhost in development)' };
  }

  // Kiểm tra hostname
  const hostname = parsedUrl.hostname.toLowerCase();
  
  // Block localhost và private IPs
  if (FORBIDDEN_HOSTS.includes(hostname)) {
    return { valid: false, error: 'Localhost and private IPs are not allowed' };
  }

  // Block private IP ranges
  for (const prefix of FORBIDDEN_PREFIXES) {
    if (hostname.startsWith(prefix)) {
      return { valid: false, error: 'Private IP ranges are not allowed' };
    }
  }

  // Block IP addresses (chỉ cho phép domain names)
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipRegex.test(hostname)) {
    return { valid: false, error: 'IP addresses are not allowed, use domain names only' };
  }

  // Block invalid ports (chỉ cho phép standard ports)
  if (parsedUrl.port && parsedUrl.port !== '443' && parsedUrl.port !== '80') {
    // Trong development, cho phép custom ports cho localhost
    if (!(isDevelopment && hostname === 'localhost')) {
      return { valid: false, error: 'Only standard ports (80, 443) are allowed' };
    }
  }

  return { valid: true };
}

module.exports = {
  validateWebhookUrl,
};

