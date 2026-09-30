const express = require('express');
const { authenticate, isAdmin } = require('../middleware/auth');
const PaymentOrder = require('../models/paymentOrder');
const {
  PLANS,
  getPlan,
  getBillingStatus,
  createPaymentOrder,
  activateOrder,
} = require('../services/billing');

const router = express.Router();
router.use(authenticate);

router.get('/plans', (req, res) => {
  res.json({ success: true, plans: Object.values(PLANS) });
});

router.get('/me', async (req, res) => {
  try {
    const status = await getBillingStatus(req.user.userId);
    const orders = await PaymentOrder.findByUserId(req.user.userId);
    res.json({ success: true, ...status, orders });
  } catch (error) {
    console.error('Get billing status error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/orders', async (req, res) => {
  try {
    const plan = getPlan(req.body?.planId);
    if (!plan || plan.id === 'free') {
      return res.status(400).json({ error: 'Chỉ có thể mua gói trả phí.' });
    }
    const order = await createPaymentOrder(req.user.userId, plan.id);
    res.status(201).json({ success: true, order });
  } catch (error) {
    console.error('Create payment order error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/orders', isAdmin, async (req, res) => {
  try {
    const orders = await PaymentOrder.findAllPending();
    res.json({ success: true, orders });
  } catch (error) {
    console.error('List payment orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/orders/:id/confirm', isAdmin, async (req, res) => {
  try {
    const order = await PaymentOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
    if (order.status !== 'pending') return res.status(400).json({ error: 'Đơn hàng đã được xử lý.' });
    const confirmed = await activateOrder(order, req.user.userId);
    res.json({ success: true, order: confirmed });
  } catch (error) {
    console.error('Confirm payment order error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;