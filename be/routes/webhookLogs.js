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


