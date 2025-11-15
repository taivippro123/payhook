const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { generateToken } = require('../middleware/auth');
const { getAuthUrl, handleCallback, getLoginAuthUrl, handleLoginCallback } = require('../services/gmailOAuth');
const { watchGmail } = require('../services/gmailApi');
const EmailConfig = require('../models/emailConfig');
const User = require('../models/user');

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Tạo Google OAuth URL để kết nối Gmail
 *     tags: [Gmail]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về đường dẫn Google OAuth
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authUrl:
 *                   type: string
 *                   format: uri
 *                   description: Đường dẫn Google OAuth 2.0
 *       401:
 *         description: Unauthorized
 */
router.get('/google', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const authUrl = getAuthUrl(userId);
    res.json({ authUrl });
  } catch (error) {
    console.error('❌ Error generating auth URL:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/google/callback:
 *   get:
 *     summary: Callback từ Google OAuth (server-side)
 *     tags: [Gmail]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         required: true
 *         description: Authorization code được Google trả về
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID (được truyền khi tạo auth URL)
 *     responses:
 *       302:
 *         description: Redirect về Dashboard kèm thông báo thành công/thất bại
 *       400:
 *         description: Thiếu tham số hoặc cấu hình Pub/Sub
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error('❌ OAuth error:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=oauth_failed`);
    }

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=no_code`);
    }

    // Lấy userId từ state
    const userId = state;
    if (!userId) {
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=no_user`);
    }

    // Xử lý callback và lấy tokens
    const { tokens, userInfo } = await handleCallback(code);

    if (!tokens.refresh_token) {
      console.error('❌ No refresh token received');
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=no_refresh_token`);
    }

    // Đăng ký Gmail watch
    const topicName = process.env.GOOGLE_PUBSUB_TOPIC; // Ví dụ: projects/PROJECT_ID/topics/gmail-notifications
    if (!topicName) {
      console.error('❌ GOOGLE_PUBSUB_TOPIC not configured');
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=pubsub_not_configured`);
    }

    const watchResult = await watchGmail(tokens.refresh_token, topicName);
    const watchExpiration = watchResult.expiration ? new Date(Number(watchResult.expiration)) : null;

    // Lưu hoặc cập nhật email config
    const existingConfig = await EmailConfig.findByUserId(userId);
    const configForEmail = existingConfig.find(c => c.email === userInfo.email);

    if (configForEmail) {
      // Update existing config
      await EmailConfig.update(configForEmail._id.toString(), {
        refreshToken: tokens.refresh_token,
        watchHistoryId: watchResult.historyId,
        watchExpiration,
        isActive: true,
      });
    } else {
      // Create new config
      await EmailConfig.create({
        userId,
        email: userInfo.email,
        refreshToken: tokens.refresh_token,
        watchHistoryId: watchResult.historyId,
        watchExpiration,
        scanInterval: 1000, // Không cần scan nữa, nhưng giữ để tương thích
        webhookUrl: null,
      });
    }

    console.log(`✅ Gmail OAuth completed for user: ${userId}, email: ${userInfo.email}`);

    // Redirect về dashboard với success message
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?gmail_connected=true`);
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=oauth_callback_failed`);
  }
});

/**
 * @swagger
 * /api/auth/google/login:
 *   get:
 *     summary: Tạo Google OAuth URL để đăng nhập
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Trả về đường dẫn Google OAuth cho login
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authUrl:
 *                   type: string
 *                   format: uri
 *                   description: Đường dẫn Google OAuth 2.0 cho login
 *       500:
 *         description: Server error
 */
router.get('/google/login', async (req, res) => {
  try {
    const authUrl = getLoginAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    console.error('❌ Error generating login auth URL:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/google/login/callback:
 *   get:
 *     summary: Callback từ Google OAuth cho login
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         required: true
 *         description: Authorization code được Google trả về
 *     responses:
 *       302:
 *         description: Redirect về frontend với token hoặc error
 *       400:
 *         description: Thiếu tham số
 */
router.get('/google/login/callback', async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      console.error('❌ OAuth error:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
    }

    // Xử lý callback và lấy thông tin user từ Google
    const { tokens, userInfo } = await handleLoginCallback(code);

    if (!userInfo.email) {
      console.error('❌ No email received from Google');
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_email`);
    }

    // Tìm user theo email
    let user = await User.findByEmail(userInfo.email);

    if (!user) {
      // Tạo user mới nếu chưa tồn tại
      // Tạo username từ email (phần trước @)
      const username = userInfo.email.split('@')[0];
      let uniqueUsername = username;
      let counter = 1;
      
      // Đảm bảo username unique
      while (await User.findByUsername(uniqueUsername)) {
        uniqueUsername = `${username}${counter}`;
        counter++;
      }

      user = await User.create({
        username: uniqueUsername,
        email: userInfo.email,
        password: Math.random().toString(36).slice(-12), // Random password (user không cần dùng)
      });
    }

    // Tạo JWT token
    const token = generateToken(user);

    console.log(`✅ Google login successful for user: ${user.email}`);

    // Redirect về frontend với token trong query string
    // Frontend sẽ lấy token và lưu vào localStorage
    res.redirect(`${process.env.FRONTEND_URL}/login?token=${token}&success=true`);
  } catch (error) {
    console.error('❌ Google login callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=login_failed`);
  }
});

module.exports = router;

