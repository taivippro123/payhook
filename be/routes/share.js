const express = require('express');
const User = require('../models/user');
const Transaction = require('../models/transaction');

const router = express.Router();

/**
 * @swagger
 * /api/share/transactions:
 *   get:
 *     summary: Lấy 5 giao dịch gần nhất bằng API key (public)
 *     description: |
 *       Endpoint public để chia sẻ giao dịch gần nhất. 
 *       Mỗi user có một API key riêng, có thể lấy/regen trong phần cấu hình người dùng.
 *     tags: [Share]
 *     parameters:
 *       - in: query
 *         name: apiKey
 *         schema:
 *           type: string
 *         required: true
 *         description: API key của user
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *           maximum: 20
 *         description: Số giao dịch cần lấy (tối đa 20)
 *     responses:
 *       200:
 *         description: Danh sách giao dịch gần nhất
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       transactionId:
 *                         type: string
 *                       bank:
 *                         type: string
 *                       amountVND:
 *                         type: number
 *                       description:
 *                         type: string
 *                       detectedAt:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Thiếu apiKey
 *       404:
 *         description: User không tồn tại hoặc không có giao dịch
 */
router.get('/transactions', async (req, res) => {
  try {
    const { apiKey } = req.query;
    let { limit } = req.query;

    if (!apiKey) {
      return res.status(400).json({ error: 'Missing apiKey' });
    }

    const user = await User.findByApiKey(apiKey);

    if (!user) {
      return res.status(404).json({ error: 'User not found for given apiKey' });
    }

    const parsedLimit = parseInt(limit, 10);
    if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
      limit = 5;
    } else {
      limit = Math.min(parsedLimit, 20);
    }

    const transactions = await Transaction.findByUserId(user._id.toString(), {
      limit,
      skip: 0,
      sortBy: 'detectedAt',
      order: 'desc',
    });

    const toVietnamTimeString = (value) => {
      const date = value instanceof Date ? value : new Date(value)
      if (Number.isNaN(date.getTime())) return null

      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })

      const parts = formatter.formatToParts(date)
      const get = (type) => parts.find((p) => p.type === type)?.value
      const year = get('year')
      const month = get('month')
      const day = get('day')
      const hour = get('hour')
      const minute = get('minute')
      const second = get('second')

      return `${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`
    }

    const sanitized = transactions.map((tx) => ({
      transactionId: tx.transactionId || null,
      bank: tx.bank || null,
      amountVND: tx.amountVND ?? null,
      description: tx.description || null,
      detectedAt: toVietnamTimeString(tx.detectedAt),
    }));

    return res.json({
      success: true,
      transactions: sanitized,
    });
  } catch (error) {
    console.error('Get shared transactions error:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;

