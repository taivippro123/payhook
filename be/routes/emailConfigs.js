const express = require('express');
const EmailConfig = require('../models/emailConfig');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

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
    
    // Không trả về appPassword trong response
    const safeConfigs = configs.map(config => {
      const { appPassword, ...safeConfig } = config;
      return safeConfig;
    });

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
 *     summary: Create a new email config
 *     tags: [Email Configs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - appPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@gmail.com"
 *               appPassword:
 *                 type: string
 *                 format: password
 *                 description: Gmail App Password
 *                 example: "abcd efgh ijkl mnop"
 *               scanInterval:
 *                 type: integer
 *                 default: 30000
 *                 description: Scan interval in milliseconds
 *                 example: 30000
 *               webhookUrl:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *                 description: Webhook URL để nhận thông báo giao dịch (tùy chọn)
 *     responses:
 *       201:
 *         description: Email config created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 config:
 *                   $ref: '#/components/schemas/EmailConfig'
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Email already configured
 */
router.post('/', async (req, res) => {
  try {
    const { email, appPassword, scanInterval, webhookUrl } = req.body;

    if (!email || !appPassword) {
      return res.status(400).json({
        error: 'Missing required fields: email, appPassword',
      });
    }

    const config = await EmailConfig.create({
      userId: req.user.userId,
      email,
      appPassword,
      scanInterval: scanInterval || 30000,
      webhookUrl: webhookUrl || null,
    });

    // Không trả về appPassword
    const { appPassword: _, ...safeConfig } = config;

    res.status(201).json({
      success: true,
      message: 'Email config created successfully',
      config: safeConfig,
    });
  } catch (error) {
    if (error.message === 'Email already configured for this user') {
      return res.status(409).json({ error: error.message });
    }
    console.error('Create email config error:', error);
    res.status(500).json({ error: error.message });
  }
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
    const config = await EmailConfig.findById(req.params.id);

    if (!config) {
      return res.status(404).json({ error: 'Email config not found' });
    }

    // Kiểm tra user có quyền truy cập
    if (config.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Không trả về appPassword
    const { appPassword, ...safeConfig } = config;

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
  try {
    const config = await EmailConfig.findById(req.params.id);

    if (!config) {
      return res.status(404).json({ error: 'Email config not found' });
    }

    // Kiểm tra user có quyền truy cập
    if (config.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { email, appPassword, scanInterval, isActive, webhookUrl } = req.body;
    const updates = {};

    if (email !== undefined) updates.email = email;
    if (appPassword !== undefined) updates.appPassword = appPassword;
    if (scanInterval !== undefined) updates.scanInterval = parseInt(scanInterval, 10);
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (webhookUrl !== undefined) updates.webhookUrl = webhookUrl || null;

    const updated = await EmailConfig.update(req.params.id, updates);

    // Không trả về appPassword
    const { appPassword: _, ...safeConfig } = updated;

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

module.exports = router;

