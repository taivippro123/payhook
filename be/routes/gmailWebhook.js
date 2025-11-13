const express = require('express');
const router = express.Router();
const { handleGmailPush } = require('../services/gmailPushHandler');

/**
 * @swagger
 * /api/gmail/webhook:
 *   post:
 *     summary: Nhận push notifications từ Google Pub/Sub (Gmail)
 *     tags: [Gmail]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: object
 *                 description: Pub/Sub message object
 *               subscription:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tiếp nhận thành công
 */
router.post('/webhook', async (req, res) => {
  try {
    // Google Pub/Sub gửi message trong format:
    // {
    //   message: {
    //     data: base64_encoded_json,
    //     messageId: "...",
    //     publishTime: "..."
    //   },
    //   subscription: "..."
    // }

    const pubsubMessage = req.body;
    
    if (!pubsubMessage || !pubsubMessage.message) {
      console.error('❌ Invalid Pub/Sub message format');
      return res.status(400).json({ error: 'Invalid message format' });
    }

    // Xử lý message (async, không block response)
    handleGmailPush(pubsubMessage).catch(error => {
      console.error('❌ Error handling Gmail push:', error);
    });

    // Trả về 200 ngay để Google biết đã nhận được message
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    // Vẫn trả về 200 để Google không retry
    res.status(200).json({ error: error.message });
  }
});

module.exports = router;

