const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const PushSubscription = require('../models/pushSubscription');
const webpush = require('web-push');

// Khởi tạo web-push với VAPID keys từ environment variables
// User cần set VAPID_PUBLIC_KEY và VAPID_PRIVATE_KEY trong .env
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@payhook.codes',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log('✅ Web Push VAPID keys configured');
} else {
  console.warn('⚠️  VAPID keys not configured. Push notifications will not work.');
  console.warn('   Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env');
  console.warn('   Generate keys with: npx web-push generate-vapid-keys');
}

/**
 * @swagger
 * /api/push/public-key:
 *   get:
 *     summary: Get VAPID public key for push notifications
 *     tags: [Push Notifications]
 *     responses:
 *       200:
 *         description: VAPID public key
 */
router.get('/public-key', (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(500).json({ error: 'VAPID public key not configured' });
  }
  res.json({ publicKey });
});

/**
 * @swagger
 * /api/push/subscribe:
 *   post:
 *     summary: Subscribe to push notifications
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subscription
 *             properties:
 *               subscription:
 *                 type: object
 *                 description: PushSubscription object from browser
 *               settings:
 *                 type: object
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                   startTime:
 *                     type: string
 *                     example: "07:00"
 *                   endTime:
 *                     type: string
 *                     example: "21:00"
 *     responses:
 *       200:
 *         description: Subscription saved successfully
 *       400:
 *         description: Invalid subscription data
 */
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { subscription, settings } = req.body;
    const userId = req.user.userId;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }

    const saved = await PushSubscription.upsert(userId, subscription, settings || {});
    
    res.json({ 
      success: true, 
      subscription: saved 
    });
  } catch (error) {
    console.error('❌ Error subscribing to push:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/push/unsubscribe:
 *   post:
 *     summary: Unsubscribe from push notifications
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - endpoint
 *             properties:
 *               endpoint:
 *                 type: string
 *     responses:
 *       200:
 *         description: Unsubscribed successfully
 */
router.post('/unsubscribe', authenticate, async (req, res) => {
  try {
    const { endpoint } = req.body;
    const userId = req.user.userId;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint required' });
    }

    // Kiểm tra subscription thuộc về user này
    const subscriptions = await PushSubscription.findByUserId(userId);
    const subscription = subscriptions.find(s => s.endpoint === endpoint);
    
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    await PushSubscription.deleteByEndpoint(endpoint);
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error unsubscribing from push:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/push/settings:
 *   get:
 *     summary: Get push notification settings
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 */
router.get('/settings', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const subscriptions = await PushSubscription.findByUserId(userId);
    
    // Trả về settings từ subscription đầu tiên (hoặc default)
    if (subscriptions.length > 0) {
      const sub = subscriptions[0];
      res.json({
        enabled: sub.enabled,
        startTime: sub.startTime,
        endTime: sub.endTime,
        hasSubscription: true,
      });
    } else {
      res.json({
        enabled: false,
        startTime: '07:00',
        endTime: '21:00',
        hasSubscription: false,
      });
    }
  } catch (error) {
    console.error('❌ Error getting push settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/push/settings:
 *   put:
 *     summary: Update push notification settings
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *               startTime:
 *                 type: string
 *                 example: "07:00"
 *               endTime:
 *                 type: string
 *                 example: "21:00"
 *     responses:
 *       200:
 *         description: Settings updated successfully
 */
router.put('/settings', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { enabled, startTime, endTime } = req.body;

    const subscriptions = await PushSubscription.findByUserId(userId);
    
    if (subscriptions.length === 0) {
      return res.status(404).json({ error: 'No subscription found. Please subscribe first.' });
    }

    // Cập nhật tất cả subscriptions của user
    const updatePromises = subscriptions.map(sub => 
      PushSubscription.updateSettings(sub.endpoint, {
        enabled,
        startTime,
        endTime,
      })
    );

    await Promise.all(updatePromises);
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error updating push settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper function để gửi push notification
 * @param {string} userId
 * @param {Object} payload
 */
async function sendPushNotification(userId, payload) {
  try {
    const subscriptions = await PushSubscription.findByUserId(userId);
    
    if (subscriptions.length === 0) {
      console.log(`⏭️  No push subscriptions for user ${userId}`);
      return;
    }

    const sendPromises = subscriptions.map(async (subscription) => {
      // Kiểm tra enabled
      if (!subscription.enabled) {
        console.log(`⏭️  Push notifications disabled for subscription ${subscription.endpoint}`);
        return;
      }

      // Kiểm tra thời gian
      const isWithinTime = PushSubscription.isWithinTimeRange(subscription.startTime, subscription.endTime);
      if (!isWithinTime) {
        // Lấy giờ Việt Nam hiện tại để log
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const vietnamTime = formatter.format(now);
        console.log(`⏭️  Current time (${vietnamTime} VN) outside allowed range (${subscription.startTime} - ${subscription.endTime})`);
        return;
      }

      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        };

        await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
        console.log(`✅ Push notification sent to ${subscription.endpoint}`);
      } catch (error) {
        console.error(`❌ Error sending push to ${subscription.endpoint}:`, error.message);
        
        // Nếu subscription không còn hợp lệ (410 Gone), xóa nó
        if (error.statusCode === 410) {
          console.log(`🗑️  Removing invalid subscription: ${subscription.endpoint}`);
          await PushSubscription.deleteByEndpoint(subscription.endpoint);
        }
      }
    });

    await Promise.all(sendPromises);
  } catch (error) {
    console.error('❌ Error in sendPushNotification:', error);
  }
}

module.exports = router;
module.exports.sendPushNotification = sendPushNotification;

