const express = require('express');
const { ObjectId } = require('mongodb');
const WebhookLog = require('../models/webhookLog');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function toObjectId(id) {
  if (!id) return null;
  try {
    return new ObjectId(id);
  } catch (error) {
    return null;
  }
}

router.use(authenticate);

/**
 * @swagger
 * /api/webhook-logs:
 *   get:
 *     summary: Lấy danh sách webhook logs
 *     tags: [Webhook Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Số lượng bản ghi mỗi trang
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, retrying, success, failed]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: emailConfigId
 *         schema:
 *           type: string
 *         description: Lọc theo email config ID
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Lọc theo user ID (chỉ admin)
 *       - in: query
 *         name: transactionId
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo transaction ID
 *       - in: query
 *         name: webhookUrl
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo webhook URL
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo transaction ID, URL, email
 *     responses:
 *       200:
 *         description: Danh sách webhook logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 logs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WebhookLog'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      emailConfigId,
      userId: queryUserId,
      transactionId,
      webhookUrl,
      search,
    } = req.query;

    const andConditions = [];

    if (req.user.role !== 'admin') {
      const currentUserId = toObjectId(req.user.userId);
      if (currentUserId) {
        andConditions.push({ userId: currentUserId });
      }
    } else if (queryUserId) {
      const userObjectId = toObjectId(queryUserId);
      if (userObjectId) {
        andConditions.push({ userId: userObjectId });
      }
    }

    if (emailConfigId) {
      const emailConfigObjectId = toObjectId(emailConfigId);
      if (emailConfigObjectId) {
        andConditions.push({ emailConfigId: emailConfigObjectId });
      }
    }

    if (status) {
      andConditions.push({ status });
    }

    if (transactionId) {
      andConditions.push({
        transactionId: { $regex: transactionId, $options: 'i' },
      });
    }

    if (webhookUrl) {
      andConditions.push({
        webhookUrl: { $regex: webhookUrl, $options: 'i' },
      });
    }

    if (search) {
      const regex = { $regex: search, $options: 'i' };
      andConditions.push({
        $or: [
          { transactionId: regex },
          { webhookUrl: regex },
          { emailConfigEmail: regex },
        ],
      });
    }

    let filter = {};
    if (andConditions.length === 1) {
      filter = andConditions[0];
    } else if (andConditions.length > 1) {
      filter = { $and: andConditions };
    }

    const result = await WebhookLog.list({
      filter,
      page,
      limit,
      sort: { createdAt: -1 },
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('❌ Error fetching webhook logs:', error);
    return res.status(500).json({
      success: false,
      error: 'Không thể lấy danh sách webhook log',
      message: error.message,
    });
  }
});

/**
 * @swagger
 * /api/webhook-logs/{id}:
 *   get:
 *     summary: Lấy chi tiết webhook log
 *     tags: [Webhook Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Webhook log ID
 *     responses:
 *       200:
 *         description: Chi tiết webhook log
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 log:
 *                   $ref: '#/components/schemas/WebhookLog'
 *       404:
 *         description: Webhook log không tồn tại
 *       403:
 *         description: Không có quyền xem log này
 *       500:
 *         description: Server error
 */
router.get('/:id', async (req, res) => {
  try {
    const log = await WebhookLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ success: false, error: 'Webhook log không tồn tại' });
    }

    if (req.user.role !== 'admin' && log.userId && log.userId !== req.user.userId) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xem log này' });
    }

    return res.json({
      success: true,
      log,
    });
  } catch (error) {
    console.error('❌ Error fetching webhook log detail:', error);
    return res.status(500).json({
      success: false,
      error: 'Không thể lấy chi tiết webhook log',
      message: error.message,
    });
  }
});

module.exports = router;


