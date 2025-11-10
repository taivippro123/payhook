const express = require('express');
const Transaction = require('../models/transaction');
const { authenticate, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Tất cả routes cần authentication
router.use(authenticate);

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Get transactions (current user or all for admin)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of transactions to return
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of transactions to skip
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: detectedAt
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID (admin only)
 *     responses:
 *       200:
 *         description: List of transactions
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
 *                     $ref: '#/components/schemas/Transaction'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     skip:
 *                       type: number
 *                     hasMore:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get('/', async (req, res) => {
  try {
    const {
      limit = 50,
      skip = 0,
      sortBy = 'detectedAt',
      order = 'desc',
      userId, // Admin có thể filter theo userId
    } = req.query;

    // Nếu là admin và có userId trong query, lấy tất cả transactions
    if (req.user.role === 'admin') {
      const transactions = await Transaction.findAll({
        limit: parseInt(limit, 10),
        skip: parseInt(skip, 10),
        sortBy,
        order,
        userId: userId || null,
      });

      const total = await Transaction.countAll(userId || null);

      return res.json({
        success: true,
        transactions,
        pagination: {
          total,
          limit: parseInt(limit, 10),
          skip: parseInt(skip, 10),
          hasMore: parseInt(skip, 10) + transactions.length < total,
        },
      });
    }

    // User thường chỉ xem được transactions của mình
    const transactions = await Transaction.findByUserId(req.user.userId, {
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10),
      sortBy,
      order,
    });

    const total = await Transaction.countByUserId(req.user.userId);

    res.json({
      success: true,
      transactions,
      pagination: {
        total,
        limit: parseInt(limit, 10),
        skip: parseInt(skip, 10),
        hasMore: parseInt(skip, 10) + transactions.length < total,
      },
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

