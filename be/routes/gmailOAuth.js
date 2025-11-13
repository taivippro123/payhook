const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getAuthUrl, handleCallback } = require('../services/gmailOAuth');
const { watchGmail } = require('../services/gmailApi');
const EmailConfig = require('../models/emailConfig');

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

module.exports = router;

