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

/**
 * Tạo OAuth2 authorization URL cho login
 * @returns {string} Authorization URL
 */
function getLoginAuthUrl() {
  const loginRedirectUri = process.env.GOOGLE_LOGIN_REDIRECT_URI || `${process.env.BACKEND_URL}/api/auth/google/login/callback`;
  
  const loginOAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    loginRedirectUri
  );

  const url = loginOAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'select_account', // Cho phép chọn account
  });

  return url;
}

/**
 * Xử lý OAuth2 callback cho login và lấy thông tin user
 * @param {string} code - Authorization code từ Google
 * @returns {Promise<Object>} { tokens, userInfo: { email, name, picture } }
 */
async function handleLoginCallback(code) {
  try {
    const loginRedirectUri = process.env.GOOGLE_LOGIN_REDIRECT_URI || `${process.env.BACKEND_URL}/api/auth/google/login/callback`;
    
    const loginOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      loginRedirectUri
    );

    // Đổi code lấy tokens
    const { tokens } = await loginOAuth2Client.getToken(code);
    
    // Lấy thông tin user từ Google OAuth2 API
    loginOAuth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: loginOAuth2Client });
    const userInfo = await oauth2.userinfo.get();
    
    return {
      tokens,
      userInfo: {
        email: userInfo.data.email,
        name: userInfo.data.name,
        picture: userInfo.data.picture,
        googleId: userInfo.data.id,
      },
    };
  } catch (error) {
    console.error('❌ Google login callback error:', error.message);
    throw error;
  }
}

module.exports = {
  getAuthUrl,
  handleCallback,
  getOAuth2Client,
  refreshAccessToken,
  getLoginAuthUrl,
  handleLoginCallback,
};

