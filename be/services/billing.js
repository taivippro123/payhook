const { getDB } = require('../db');
const { ObjectId } = require('mongodb');
const crypto = require('crypto');
const PaymentOrder = require('../models/paymentOrder');
const User = require('../models/user');
const { sendPayhookEmail } = require('./cakeTestEmail');

const PLANS = Object.freeze({
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    transactionLimit: 50,
    description: 'Dành cho sinh viên và thử nghiệm cá nhân',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 100000,
    transactionLimit: 1000,
    description: 'Cho dự án nhỏ và cửa hàng đang vận hành',
  },
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited',
    price: 200000,
    transactionLimit: null,
    description: 'Không giới hạn giao dịch trong phạm vi sử dụng hợp lý',
  },
});

const PAYMENT_ACCOUNT = process.env.PAYMENT_BANK_ACCOUNT || '0356882700';
const PAYMENT_BANK = process.env.PAYMENT_BANK_CODE || 'cake';
const PAYMENT_QR_BASE_URL = process.env.PAYMENT_QR_BASE_URL
  || 'https://rimmed-improvise-hatchery.ngrok-free.dev/api/qr/img';
const PAYMENT_RECEIVING_EMAIL = (process.env.PAYMENT_RECEIVING_EMAIL || '').trim().toLowerCase();
let billingIndexesPromise = null;
let lastReconcileAt = 0;
let reconcilePromise = null;

function getPlan(planId) {
  return PLANS[planId] || null;
}

function getMonthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getNextMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function addOneMonth(date = new Date()) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1);
  return result;
}

function buildQrUrl(amount, orderCode) {
  const url = new URL(PAYMENT_QR_BASE_URL);
  url.searchParams.set('acc', PAYMENT_ACCOUNT);
  url.searchParams.set('bank', PAYMENT_BANK);
  url.searchParams.set('amount', String(amount));
  url.searchParams.set('des', orderCode);
  return url.toString();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function ensureBillingIndexes() {
  if (!billingIndexesPromise) {
    billingIndexesPromise = (async () => {
      const db = await getDB();
      const indexes = [
        [db.collection('payment_orders'), { orderCode: 1 }, { unique: true, name: 'payment_orders_order_code_unique' }],
        [db.collection('subscriptions'), { userId: 1 }, { unique: true, name: 'subscriptions_user_unique' }],
        [db.collection('usage_counters'), { userId: 1, periodKey: 1 }, { unique: true, name: 'usage_counters_period_unique' }],
        [db.collection('transactions'), { userId: 1, transactionId: 1, bank: 1 }, { unique: true, partialFilterExpression: { transactionId: { $type: 'string' } }, name: 'transactions_identity_unique' }],
      ];
      for (const [collection, keys, options] of indexes) {
        try {
          await collection.createIndex(keys, options);
        } catch (error) {
          console.warn(`⚠️ Could not create billing index ${options.name}:`, error.message);
        }
      }
    })();
  }
  await billingIndexesPromise;
}

async function reconcilePendingPayments() {
  if (process.env.PAYMENT_AUTO_CONFIRM !== 'true' || !PAYMENT_RECEIVING_EMAIL) return;
  if (Date.now() - lastReconcileAt < 30 * 1000) return;
  if (reconcilePromise) return reconcilePromise;

  reconcilePromise = (async () => {
    const db = await getDB();
    const watcherConfigs = await db.collection('email_configs')
      .find({ email: PAYMENT_RECEIVING_EMAIL })
      .project({ _id: 1 })
      .toArray();
    const configIds = watcherConfigs.map((config) => config._id);
    if (configIds.length === 0) return;

    const pendingOrders = await PaymentOrder.findAllPending(200);
    for (const order of pendingOrders) {
      const transaction = await db.collection('transactions').findOne({
        emailConfigId: { $in: configIds },
        amountVND: Number(order.amount),
        createdAt: { $gte: new Date(order.createdAt) },
        description: {
          $regex: `\\b${escapeRegex(order.orderCode)}\\b`,
          $options: 'i',
        },
      });
      if (transaction) {
        await activateOrder(order, null);
        console.log(`✅ Reconciled payment order ${order.orderCode} from saved transaction`);
      }
    }
    lastReconcileAt = Date.now();
  })().finally(() => {
    reconcilePromise = null;
  });
  return reconcilePromise;
}

async function getSubscription(userId) {
  const db = await getDB();
  const subscription = await db.collection('subscriptions').findOne({
    userId: new ObjectId(userId),
    status: 'active',
  });

  if (subscription?.planId !== 'free' && subscription?.expiresAt && subscription.expiresAt <= new Date()) {
    await db.collection('subscriptions').updateOne(
      { _id: subscription._id },
      { $set: { status: 'expired', updatedAt: new Date() } }
    );
    return null;
  }
  return subscription;
}

async function getBillingStatus(userId) {
  await ensureBillingIndexes();
  await reconcilePendingPayments();
  const subscription = await getSubscription(userId);
  const plan = getPlan(subscription?.planId) || PLANS.free;
  const db = await getDB();
  const periodStart = plan.id === 'free'
    ? getMonthStart()
    : new Date(subscription.activatedAt);
  const periodEnd = plan.id === 'free'
    ? getNextMonth()
    : new Date(subscription.expiresAt);
  const used = await db.collection('transactions').countDocuments({
    userId: new ObjectId(userId),
    createdAt: { $gte: periodStart, $lt: periodEnd },
  });

  return {
    plan,
    used,
    remaining: plan.transactionLimit === null ? null : Math.max(plan.transactionLimit - used, 0),
    periodStart,
    periodEnd,
    isExhausted: plan.transactionLimit !== null && used >= plan.transactionLimit,
  };
}

async function canCreateTransaction(userId) {
  const status = await getBillingStatus(userId);
  return {
    allowed: !status.isExhausted,
    ...status,
  };
}

async function reserveTransactionSlot(userId) {
  const status = await getBillingStatus(userId);
  if (status.plan.transactionLimit === null) {
    return { allowed: true, ...status };
  }

  const db = await getDB();
  const periodKey = `${userId}:${status.periodStart.toISOString()}`;
  const usageCounters = db.collection('usage_counters');
  await usageCounters.updateOne(
    { userId: new ObjectId(userId), periodKey },
    {
      $setOnInsert: {
        userId: new ObjectId(userId),
        periodKey,
        count: status.used,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  const result = await usageCounters.findOneAndUpdate(
    { userId: new ObjectId(userId), periodKey, count: { $lt: status.plan.transactionLimit } },
    { $inc: { count: 1 }, $set: { updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  const counter = result?.value || result;
  if (status.plan.id === 'free' && (!counter || counter.count >= status.plan.transactionLimit)) {
    notifyFreeLimitReached(
      userId,
      counter?.count || status.used,
      status.plan.transactionLimit,
      status.periodStart
    ).catch((error) => console.error('❌ Free limit notification error:', error.message));
  }
  return {
    allowed: Boolean(counter),
    ...status,
    used: counter?.count || status.used,
    remaining: counter ? Math.max(status.plan.transactionLimit - counter.count, 0) : 0,
    isExhausted: !counter || counter.count >= status.plan.transactionLimit,
  };
}

async function releaseTransactionSlot(userId, periodStart) {
  const db = await getDB();
  const periodKey = `${userId}:${new Date(periodStart).toISOString()}`;
  await db.collection('usage_counters').updateOne(
    { userId: new ObjectId(userId), periodKey, count: { $gt: 0 } },
    { $inc: { count: -1 }, $set: { updatedAt: new Date() } }
  );
}

function buildFreeLimitEmail({ username, used, limit, billingUrl }) {
  const greeting = username ? `Chào ${username},` : 'Chào bạn,';
  const subject = 'Payhook: Bạn đã đạt giới hạn gói Free';
  const text = `${greeting}\n\nBạn đã sử dụng ${used}/${limit} giao dịch trong tháng này trên gói Free. Các giao dịch mới sẽ tạm dừng cho đến khi bạn nâng cấp gói.\n\nNâng cấp tại: ${billingUrl}\n\nPayhook`;
  const html = `
    <div style="margin:0;background:#f3f4f6;padding:32px 16px;font-family:Arial,sans-serif;color:#111827">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
        <div style="display:inline-block;background:#eff6ff;color:#2563eb;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700">PAYHOOK</div>
        <h1 style="font-size:24px;margin:20px 0 12px">Bạn đã đạt giới hạn gói Free</h1>
        <p>${greeting}</p>
        <p>Bạn đã sử dụng <strong>${used}/${limit} giao dịch</strong> trong tháng này.</p>
        <p>Các giao dịch mới sẽ tạm dừng cho đến khi bạn nâng cấp gói dịch vụ.</p>
        <p style="margin:28px 0"><a href="${billingUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:700">Xem và nâng cấp gói</a></p>
        <p style="font-size:12px;color:#6b7280;margin:0">Email tự động từ Payhook.</p>
      </div>
    </div>
  `;
  return { subject, text, html };
}

async function notifyFreeLimitReached(userId, used, limit, periodStart) {
  const db = await getDB();
  const notificationId = `${userId}:${new Date(periodStart).toISOString()}:free-limit`;
  const notifications = db.collection('billing_notifications');
  const existing = await notifications.findOne({ _id: notificationId });
  if (existing?.status === 'sent' || existing?.status === 'sending') return;

  if (existing?.status === 'failed') {
    const retry = await notifications.updateOne(
      { _id: notificationId, status: 'failed' },
      { $set: { status: 'sending', updatedAt: new Date(), used, limit } }
    );
    if (!retry.matchedCount) return;
  } else try {
    await notifications.insertOne({
      _id: notificationId,
      userId: new ObjectId(userId),
      type: 'free_limit_reached',
      status: 'sending',
      used,
      limit,
      periodStart: new Date(periodStart),
      createdAt: new Date(),
    });
  } catch (error) {
    if (error.code === 11000) return;
    throw error;
  }

  try {
    const user = await User.findById(userId);
    if (!user?.email) throw new Error('User email is not configured');
    const billingUrl = `${process.env.FRONTEND_URL || 'https://payhook.codes'}/billing`;
    const email = buildFreeLimitEmail({ username: user.username, used, limit, billingUrl });
    await sendPayhookEmail({
      to: user.email,
      ...email,
      headers: { 'X-Payhook-Notification': 'free-limit-reached' },
    });
    await notifications.updateOne(
      { _id: notificationId },
      { $set: { status: 'sent', sentAt: new Date() } }
    );
    console.log(`✉️ Free limit email sent to ${user.email}`);
  } catch (error) {
    await notifications.updateOne(
      { _id: notificationId },
      { $set: { status: 'failed', error: error.message, updatedAt: new Date() } }
    );
    console.error(`❌ Failed to send free limit email for user ${userId}:`, error.message);
  }
}

async function notifyExistingFreeLimitUsers() {
  const db = await getDB();
  const periodStart = getMonthStart();
  const exhaustedUsers = await db.collection('transactions').aggregate([
    { $match: { createdAt: { $gte: periodStart } } },
    { $group: { _id: '$userId', used: { $sum: 1 } } },
    { $match: { used: { $gte: PLANS.free.transactionLimit } } },
  ]).toArray();

  for (const entry of exhaustedUsers) {
    const userId = entry._id?.toString();
    if (!userId) continue;
    const subscription = await getSubscription(userId);
    if (!subscription || subscription.planId === 'free') {
      await notifyFreeLimitReached(
        userId,
        entry.used,
        PLANS.free.transactionLimit,
        periodStart
      );
    }
  }
}

async function createPaymentOrder(userId, planId) {
  const plan = getPlan(planId);
  if (!plan || plan.id === 'free') {
    throw new Error('Invalid paid plan');
  }
  const orderCode = `PAYHOOK${Date.now().toString().slice(-8)}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const order = await PaymentOrder.create({
    userId,
    planId,
    amount: plan.price,
    orderCode,
  });
  return {
    ...order,
    plan,
    qrUrl: buildQrUrl(plan.price, orderCode),
  };
}

async function activateOrder(order, adminId) {
  const plan = getPlan(order.planId);
  if (!plan || plan.id === 'free') throw new Error('Invalid paid plan');
  const db = await getDB();
  const now = new Date();
  const existingSubscription = await db.collection('subscriptions').findOne({
    userId: new ObjectId(order.userId),
    status: 'active',
  });
  const startsAt = existingSubscription?.expiresAt > now ? existingSubscription.expiresAt : now;
  const expiresAt = addOneMonth(startsAt);
  await db.collection('subscriptions').updateOne(
    { userId: new ObjectId(order.userId) },
    {
      $set: {
        planId: plan.id,
        status: 'active',
        activatedAt: now,
        expiresAt,
        paymentOrderId: new ObjectId(order._id),
        updatedAt: now,
      },
    },
    { upsert: true }
  );
  const paidOrder = await PaymentOrder.confirm(order._id, adminId);
  return paidOrder || { ...order, status: 'paid', paidAt: now };
}

function isPaymentWatcherConfig(config) {
  return process.env.PAYMENT_AUTO_CONFIRM === 'true'
    && PAYMENT_RECEIVING_EMAIL
    && config?.email?.toLowerCase() === PAYMENT_RECEIVING_EMAIL;
}

async function autoConfirmPayment({ description, amountVND }) {
  if (!description || !Number.isFinite(amountVND) || amountVND <= 0) return null;
  const match = String(description).match(/\b(PAYHOOK\d+)\b/i);
  if (!match) return null;

  const order = await PaymentOrder.findPendingByOrderCode(match[1].toUpperCase());
  if (!order || Number(order.amount) !== Number(amountVND)) return null;
  return activateOrder(order, null);
}

module.exports = {
  PLANS,
  getPlan,
  getBillingStatus,
  canCreateTransaction,
  reserveTransactionSlot,
  releaseTransactionSlot,
  createPaymentOrder,
  activateOrder,
  isPaymentWatcherConfig,
  autoConfirmPayment,
  notifyExistingFreeLimitUsers,
  buildQrUrl,
};