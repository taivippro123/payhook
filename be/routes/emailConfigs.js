const express = require('express');
const EmailConfig = require('../models/emailConfig');
const { authenticate } = require('../middleware/auth');
const { validateWebhookUrl } = require('../utils/webhookValidation');
const { generateWebhookSecret } = require('../utils/webhookSignature');
const { sendCakeTestEmail } = require('../services/cakeTestEmail');
const { watchGmail } = require('../services/gmailApi');
const { testConnection } = require('../services/xiaozhiMcpClient');

const router = express.Router();

// Gmail watch auto-renew fallback config
const PUBSUB_TOPIC = process.env.GOOGLE_PUBSUB_TOPIC;
const RENEW_THRESHOLD_MS =
  Number(process.env.GMAIL_WATCH_RENEW_THRESHOLD_MS) || 24 * 60 * 60 * 1000; // 24h

/**
 * Fallback: tự động gia hạn Gmail watch cho 1 config khi user mở Dashboard/API
 * Tránh trường hợp scheduler (cron) không chạy đúng giờ dẫn đến hết hạn push.
 *
 * Chiến lược:
 * - Nếu còn hạn xa hơn threshold thì bỏ qua để tránh spam Gmail API.
 * - Nếu sắp hết hạn (<= threshold) hoặc đã hết hạn thì gọi lại users.watch().
 *
 * @param {Object} config - email config document (đã decrypt refreshToken)
 * @param {string} reason - lý do để log (vd: 'email-configs-list', 'email-configs-detail')
 * @returns {Promise<Object>} config đã được update (nếu có) hoặc config cũ nếu không cần renew/renew fail
 */
async function maybeAutoRenewWatch(config, reason = 'fallback') {
  try {
    if (!PUBSUB_TOPIC) {
      // Không cấu hình Pub/Sub topic thì bỏ qua auto-renew
      return config;
    }

    if (!config || !config.refreshToken) {
      return config;
    }

    const now = Date.now();
    const expirationTime = config.watchExpiration
      ? new Date(config.watchExpiration).getTime()
      : 0;

    // Nếu chưa từng có watch hoặc sắp hết hạn / đã hết hạn
    const needsRenew =
      !expirationTime || expirationTime - now <= RENEW_THRESHOLD_MS;

    if (!needsRenew) {
      return config;
    }

    console.log(
      `🔄 [Fallback] Auto-renew Gmail watch for ${config.email} (reason: ${reason})`
    );

    const result = await watchGmail(config.refreshToken, PUBSUB_TOPIC);
    const watchExpiration = result.expiration
      ? new Date(Number(result.expiration))
      : null;

    const updated = await EmailConfig.update(config._id.toString(), {
      watchHistoryId: result.historyId ? String(result.historyId) : null,
      watchExpiration,
    });

    console.log(
      `✅ [Fallback] Watch renewed for ${config.email}. New historyId=${result.historyId}`
    );

    return updated || config;
  } catch (error) {
    console.error(
      `❌ [Fallback] Failed to auto-renew Gmail watch for ${
        config?.email
      }: ${error.message}`
    );
    // Không throw để tránh làm hỏng endpoint chính
    return config;
  }
}

// Helper function để serialize MongoDB object thành JSON-safe object
function serializeConfig(config) {
  if (!config) return null;
  
  try {
    return {
      _id: config._id ? (config._id.toString ? config._id.toString() : String(config._id)) : config._id,
      userId: config.userId ? (config.userId.toString ? config.userId.toString() : String(config.userId)) : config.userId,
      email: config.email || null,
      scanInterval: config.scanInterval || null,
      webhookUrl: config.webhookUrl || null,
      xiaozhiMcpUrl: config.xiaozhiMcpUrl || null,
      isActive: config.isActive !== undefined ? Boolean(config.isActive) : null,
      lastSyncedAt: config.lastSyncedAt ? (config.lastSyncedAt instanceof Date ? config.lastSyncedAt.toISOString() : (typeof config.lastSyncedAt === 'string' ? config.lastSyncedAt : new Date(config.lastSyncedAt).toISOString())) : null,
      createdAt: config.createdAt ? (config.createdAt instanceof Date ? config.createdAt.toISOString() : (typeof config.createdAt === 'string' ? config.createdAt : new Date(config.createdAt).toISOString())) : null,
      updatedAt: config.updatedAt ? (config.updatedAt instanceof Date ? config.updatedAt.toISOString() : (typeof config.updatedAt === 'string' ? config.updatedAt : new Date(config.updatedAt).toISOString())) : null,
      watchExpiration: config.watchExpiration ? (config.watchExpiration instanceof Date ? config.watchExpiration.toISOString() : (typeof config.watchExpiration === 'string' ? config.watchExpiration : new Date(config.watchExpiration).toISOString())) : null,
      hasRefreshToken: Boolean(config.refreshToken),
      webhookSecret: config.webhookSecret || null, // Trả về webhook secret để user có thể verify webhook
    };
  } catch (error) {
    console.error('❌ Error in serializeConfig:', error, 'Config:', config);
    throw error;
  }
}

// Tất cả routes cần authentication
router.use(authenticate);

/**
 * @swagger
 * /api/email-configs:
 *   get:
 *     summary: Get all email configs for current user
 *     tags: [Email Configs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of email configs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 configs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EmailConfig'
 *                 count:
 *                   type: number
 *       401:
 *         description: Unauthorized
 */
router.get('/', async (req, res) => {
  try {
    const configs = await EmailConfig.findByUserId(req.user.userId);

    // Fallback: cố gắng auto-renew Gmail watch cho từng config nếu sắp/đã hết hạn
    const renewedConfigs = await Promise.all(
      configs.map((config) => maybeAutoRenewWatch(config, 'email-configs-list'))
    );

    // Serialize MongoDB objects thành JSON-safe objects
    const safeConfigs = renewedConfigs.map((config) => serializeConfig(config));

    res.json({
      success: true,
      configs: safeConfigs,
      count: safeConfigs.length,
    });
  } catch (error) {
    console.error('Get email configs error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/email-configs:
 *   post:
 *     summary: (Deprecated) Create a new email config
 *     description: Kể từ phiên bản Gmail push notifications, endpoint này không còn được sử dụng. Vui lòng sử dụng OAuth 2.0 để kết nối Gmail.
 *     tags: [Email Configs]
 *     deprecated: true
 *     responses:
 *       410:
 *         description: Endpoint deprecated - use Google OAuth flow
 */
router.post('/', async (req, res) => {
  return res.status(410).json({
    error: 'This endpoint has been deprecated. Please use Google OAuth to connect Gmail.',
  });
});

/**
 * @swagger
 * /api/email-configs/{id}:
 *   get:
 *     summary: Get email config by ID
 *     tags: [Email Configs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Email config ID
 *     responses:
 *       200:
 *         description: Email config details
 *       403:
 *         description: Access denied
 *       404:
 *         description: Email config not found
 */
router.get('/:id', async (req, res) => {
  try {
    let config = await EmailConfig.findById(req.params.id);

    if (!config) {
      return res.status(404).json({ error: 'Email config not found' });
    }

    // Kiểm tra user có quyền truy cập
    if (config.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fallback: auto-renew cho riêng config này nếu user đang xem chi tiết và gần/đã hết hạn
    config = await maybeAutoRenewWatch(config, 'email-configs-detail');

    // Serialize MongoDB object thành JSON-safe object
    const safeConfig = serializeConfig(config);

    res.json({
      success: true,
      config: safeConfig,
    });
  } catch (error) {
    console.error('Get email config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/email-configs/{id}:
 *   put:
 *     summary: Update email config
 *     tags: [Email Configs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               appPassword:
 *                 type: string
 *                 format: password
 *               scanInterval:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *               webhookUrl:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *                 description: Webhook URL để nhận thông báo giao dịch (tùy chọn)
 *     responses:
 *       200:
 *         description: Email config updated
 *       403:
 *         description: Access denied
 *       404:
 *         description: Email config not found
 */
router.put('/:id', async (req, res) => {
  const configId = req.params.id;
  console.log(`📝 PUT /api/email-configs/${configId} - Request received`);
  
  try {
    const config = await EmailConfig.findById(configId);
    console.log(`🔍 Found config:`, config ? `ID: ${config._id}, User: ${config.userId}` : 'NOT FOUND');

    if (!config) {
      console.warn(`⚠️  Config ${configId} not found`);
      return res.status(404).json({ error: 'Email config not found' });
    }

    // Kiểm tra user có quyền truy cập
    const configUserId = config.userId.toString();
    const requestUserId = req.user.userId;
    console.log(`🔐 Checking access: configUserId=${configUserId}, requestUserId=${requestUserId}`);
    
    if (configUserId !== requestUserId) {
      console.warn(`⚠️  Access denied for config ${configId}`);
      return res.status(403).json({ error: 'Access denied' });
    }

    const { webhookUrl, xiaozhiMcpUrl, isActive } = req.body;
    const updates = {};

    if (webhookUrl !== undefined) {
      const newWebhookUrl = webhookUrl || null;
      
      // Validate webhook URL nếu có
      if (newWebhookUrl) {
        const validation = validateWebhookUrl(newWebhookUrl);
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error });
        }
        
        // Nếu webhook URL thay đổi hoặc chưa có secret, generate secret mới
        if (newWebhookUrl !== config.webhookUrl || !config.webhookSecret) {
          updates.webhookSecret = generateWebhookSecret();
        }
      } else {
        // Nếu xóa webhook URL, cũng xóa secret
        updates.webhookSecret = null;
      }
      
      updates.webhookUrl = newWebhookUrl;
    }
    
    if (xiaozhiMcpUrl !== undefined) {
      const newXiaozhiMcpUrl = xiaozhiMcpUrl || null;
      
      // Validate Xiaozhi MCP URL nếu có (phải là WebSocket URL)
      if (newXiaozhiMcpUrl) {
        if (!newXiaozhiMcpUrl.startsWith('wss://') && !newXiaozhiMcpUrl.startsWith('ws://')) {
          return res.status(400).json({ error: 'Xiaozhi MCP URL phải là WebSocket URL (wss:// hoặc ws://)' });
        }
        
        try {
          const url = new URL(newXiaozhiMcpUrl);
          if (url.protocol !== 'wss:' && url.protocol !== 'ws:') {
            return res.status(400).json({ error: 'Xiaozhi MCP URL phải sử dụng WebSocket protocol (wss:// hoặc ws://)' });
          }
        } catch (urlError) {
          return res.status(400).json({ error: 'Xiaozhi MCP URL không đúng định dạng' });
        }
        
        // Test connection (không block nếu fail, chỉ log warning)
        try {
          const testResult = await testConnection(newXiaozhiMcpUrl);
          if (!testResult.success) {
            console.warn(`⚠️ Xiaozhi MCP connection test failed for ${newXiaozhiMcpUrl}: ${testResult.message}`);
            // Vẫn cho phép lưu URL, chỉ log warning
          } else {
            console.log(`✅ Xiaozhi MCP connection test successful for ${newXiaozhiMcpUrl}`);
          }
        } catch (testError) {
          console.warn(`⚠️ Xiaozhi MCP connection test error: ${testError.message}`);
          // Vẫn cho phép lưu URL, chỉ log warning
        }
      }
      
      updates.xiaozhiMcpUrl = newXiaozhiMcpUrl;
    }
    
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    if (Object.keys(updates).length === 0) {
      return res.json({
        success: true,
        message: 'No changes applied',
        config: serializeConfig(config),
      });
    }

    console.log(`🔄 Updating config ${configId} with updates:`, updates);

    const updated = await EmailConfig.update(configId, updates);
    console.log(`✅ Config updated, result:`, updated ? `ID: ${updated._id}` : 'NULL');

    if (!updated) {
      return res.status(404).json({ error: 'Email config not found or update failed' });
    }

    // Serialize MongoDB object thành JSON-safe object
    let safeConfig;
    try {
      safeConfig = serializeConfig(updated);
      if (!safeConfig) {
        throw new Error('Failed to serialize config');
      }
    } catch (serializeError) {
      console.error('❌ Error serializing config:', serializeError);
      return res.status(500).json({ 
        error: 'Failed to serialize config response',
        details: serializeError.message 
      });
    }

    res.json({
      success: true,
      message: 'Email config updated successfully',
      config: safeConfig,
    });
  } catch (error) {
    console.error('Update email config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/email-configs/{id}:
 *   delete:
 *     summary: Delete email config
 *     tags: [Email Configs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email config deleted
 *       403:
 *         description: Access denied
 *       404:
 *         description: Email config not found
 */
router.delete('/:id', async (req, res) => {
  try {
    const config = await EmailConfig.findById(req.params.id);

    if (!config) {
      return res.status(404).json({ error: 'Email config not found' });
    }

    // Kiểm tra user có quyền truy cập
    if (config.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await EmailConfig.delete(req.params.id);

    res.json({
      success: true,
      message: 'Email config deleted successfully',
    });
  } catch (error) {
    console.error('Delete email config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Trigger CAKE test email to Gmail inbox so the parser can pick it up
 */
router.post('/:id/send-test-email', async (req, res) => {
  const configId = req.params.id;
  try {
    const config = await EmailConfig.findById(configId);
    if (!config) {
      return res.status(404).json({ error: 'Email config not found' });
    }

    if (config.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!config.email) {
      return res.status(400).json({ error: 'Configured Gmail address is missing' });
    }

    const overrides = req.body?.overrides || {};
    const result = await sendCakeTestEmail({
      to: config.email,
      overrides,
      headers: {
        'X-Payhook-User': req.user.userId,
      },
    });

    return res.json({
      success: true,
      message: 'Đã gửi email test CAKE. Vui lòng kiểm tra hộp thư đến trong 5-10 giây.',
      email: config.email,
      metadata: {
        messageId: result.messageId,
      },
      sample: result.sample,
    });
  } catch (error) {
    console.error('Send test email error:', error);
    const status = error.message && error.message.includes('environment variable') ? 500 : 500;
    return res.status(status).json({ error: error.message || 'Failed to send test email' });
  }
});

module.exports = router;

