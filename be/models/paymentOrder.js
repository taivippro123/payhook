const { getDB } = require('../db');
const { ObjectId } = require('mongodb');

function serialize(order) {
  if (!order) return null;
  return {
    ...order,
    _id: order._id?.toString(),
    userId: order.userId?.toString(),
    createdAt: order.createdAt?.toISOString?.() || order.createdAt,
    updatedAt: order.updatedAt?.toISOString?.() || order.updatedAt,
    paidAt: order.paidAt?.toISOString?.() || order.paidAt || null,
  };
}

class PaymentOrder {
  static async create({ userId, planId, amount, orderCode }) {
    const db = await getDB();
    const now = new Date();
    const order = {
      userId: new ObjectId(userId),
      planId,
      amount,
      orderCode,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      paidAt: null,
      confirmedBy: null,
    };
    const result = await db.collection('payment_orders').insertOne(order);
    return serialize({ ...order, _id: result.insertedId });
  }

  static async findById(id) {
    const db = await getDB();
    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch (error) {
      return null;
    }
    return serialize(await db.collection('payment_orders').findOne({ _id: objectId }));
  }

  static async findPendingByOrderCode(orderCode) {
    const db = await getDB();
    return serialize(await db.collection('payment_orders').findOne({
      orderCode,
      status: 'pending',
    }));
  }

  static async findByUserId(userId, limit = 10) {
    const db = await getDB();
    const orders = await db.collection('payment_orders')
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50))
      .toArray();
    return orders.map(serialize);
  }

  static async findAllPending(limit = 100) {
    const db = await getDB();
    const orders = await db.collection('payment_orders')
      .find({ status: 'pending' })
      .sort({ createdAt: 1 })
      .limit(Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200))
      .toArray();
    return orders.map(serialize);
  }

  static async confirm(id, adminId) {
    const db = await getDB();
    const now = new Date();
    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch (error) {
      return null;
    }

    const result = await db.collection('payment_orders').findOneAndUpdate(
      { _id: objectId, status: 'pending' },
      {
        $set: {
          status: 'paid',
          paidAt: now,
          confirmedBy: adminId ? new ObjectId(adminId) : null,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' }
    );
    return serialize(result?.value || result);
  }
}

module.exports = PaymentOrder;