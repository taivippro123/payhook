const { google } = require('googleapis');
const EmailConfig = require('../models/emailConfig');

// OAuth2 Client configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || `${process.env.BACKEND_URL}/api/auth/google/callback`
);

/**
 * Tạo OAuth2 authorization URL
 * @param {string} userId - User ID để lưu vào state
 * @returns {string} Authorization URL
 */
function getAuthUrl(userId) {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Để có refresh_token
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
    prompt: 'consent', // Bắt buộc hiển thị consent screen để lấy refresh_token
    state: userId, // Lưu userId vào state để xác định user sau callback
  });

  return url;
}

/**
 * Xử lý OAuth2 callback và lấy tokens
 * @param {string} code - Authorization code từ Google
 * @returns {Promise<Object>} { tokens, userInfo }
 */
async function handleCallback(code) {
  try {
    // Đổi code lấy tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Lấy thông tin user từ Gmail API
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    return {
      tokens,
      userInfo: {
        email: profile.data.emailAddress,
      },
    };
  } catch (error) {
    console.error('❌ OAuth callback error:', error.message);
    throw error;
  }
}

/**
 * Lấy OAuth2 client với refresh token của user
 * @param {string} refreshToken - Refresh token của user
 * @returns {google.auth.OAuth2Client}
 */
function getOAuth2Client(refreshToken) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  client.setCredentials({
    refresh_token: refreshToken,
  });
  
  return client;
}

/**
 * Refresh access token nếu cần
 * @param {string} refreshToken - Refresh token của user
 * @returns {Promise<string>} Access token mới
 */
async function refreshAccessToken(refreshToken) {
  const client = getOAuth2Client(refreshToken);
  const { credentials } = await client.refreshAccessToken();
  return credentials.access_token;
}

module.exports = {
  getAuthUrl,
  handleCallback,
  getOAuth2Client,
  refreshAccessToken,
};

