const { getDB } = require('../db');
const { ObjectId } = require('mongodb');

function serialize(doc) {
  if (!doc) return null;
  return {
    ...doc,
    _id: doc._id ? doc._id.toString() : undefined,
    userId: doc.userId ? doc.userId.toString() : null,
    emailConfigId: doc.emailConfigId ? doc.emailConfigId.toString() : null,
    transactionDocId: doc.transactionDocId ? doc.transactionDocId.toString() : null,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : null,
    nextRetryAt: doc.nextRetryAt ? doc.nextRetryAt.toISOString() : null,
  };
}

class DeadLetterQueue {
  static async collection() {
    const db = await getDB();
    return db.collection('dead_letter_queue');
  }

  /**
   * Thêm webhook failed vào dead letter queue
   * @param {Object} data - { webhookUrl, payload, userId, emailConfigId, transactionDocId, error, attempts }
   * @returns {Promise<Object>}
   */
  static async add({
    webhookUrl,
    payload,
    userId,
    emailConfigId,
    transactionDocId,
    transactionId,
    error,
    attempts,
    webhookLogId,
  }) {
    const collection = await this.collection();
    
    const dlqEntry = {
      webhookUrl,
      payload,
      userId: userId ? new ObjectId(userId) : null,
      emailConfigId: emailConfigId ? new ObjectId(emailConfigId) : null,
      transactionDocId: transactionDocId ? new ObjectId(transactionDocId) : null,
      transactionId: transactionId || null,
      error: error || null,
      attempts: attempts || 0,
      webhookLogId: webhookLogId ? new ObjectId(webhookLogId) : null,
      status: 'pending', // pending, retrying, failed, resolved
      retryCount: 0,
      maxRetries: 3, // Retry thêm 3 lần nữa từ DLQ
      nextRetryAt: new Date(Date.now() + 60 * 60 * 1000), // Retry sau 1 giờ
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(dlqEntry);
    return serialize({
      ...dlqEntry,
      _id: result.insertedId,
    });
  }

  /**
   * Lấy các entries cần retry
   * @param {number} limit - Số lượng entries tối đa
   * @returns {Promise<Array>}
   */
  static async getPendingRetries(limit = 10) {
    const collection = await this.collection();
    const now = new Date();
    
    const entries = await collection
      .find({
        status: { $in: ['pending', 'retrying'] },
        nextRetryAt: { $lte: now },
        retryCount: { $lt: 3 }, // Chưa vượt quá max retries
      })
      .limit(limit)
      .toArray();
    
    return entries.map(serialize);
  }

  /**
   * Update entry sau khi retry
   * @param {string} entryId
   * @param {Object} updateData - { status, retryCount, nextRetryAt, error? }
   * @returns {Promise<Object>}
   */
  static async updateAfterRetry(entryId, updateData) {
    const collection = await this.collection();
    const _id = new ObjectId(entryId);
    
    const update = {
      ...updateData,
      updatedAt: new Date(),
    };
    
    // Tính nextRetryAt dựa trên retryCount (exponential backoff)
    if (updateData.status === 'pending' || updateData.status === 'retrying') {
      const hours = Math.pow(2, updateData.retryCount || 0); // 1h, 2h, 4h, 8h
      update.nextRetryAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    }
    
    await collection.updateOne(
      { _id },
      { $set: update }
    );
    
    const updated = await collection.findOne({ _id });
    return serialize(updated);
  }

  /**
   * Mark entry là resolved (webhook đã được gửi thành công)
   * @param {string} entryId
   * @returns {Promise<Object>}
   */
  static async markResolved(entryId) {
    return this.updateAfterRetry(entryId, {
      status: 'resolved',
      nextRetryAt: null,
    });
  }

  /**
   * Mark entry là failed (đã hết retries)
   * @param {string} entryId
   * @returns {Promise<Object>}
   */
  static async markFailed(entryId) {
    return this.updateAfterRetry(entryId, {
      status: 'failed',
      nextRetryAt: null,
    });
  }

  /**
   * Lấy tất cả entries của user
   * @param {string} userId
   * @param {Object} options - { status?, limit?, skip? }
   * @returns {Promise<Array>}
   */
  static async findByUserId(userId, options = {}) {
    const collection = await this.collection();
    const query = {
      userId: new ObjectId(userId),
    };
    
    if (options.status) {
      query.status = options.status;
    }
    
    const cursor = collection.find(query).sort({ createdAt: -1 });
    
    if (options.skip) {
      cursor.skip(options.skip);
    }
    
    if (options.limit) {
      cursor.limit(options.limit);
    }
    
    const entries = await cursor.toArray();
    return entries.map(serialize);
  }

  /**
   * Xóa entries cũ hơn N ngày
   * @param {number} days - Số ngày
   * @returns {Promise<number>} Số lượng entries đã xóa
   */
  static async deleteOldEntries(days = 30) {
    const collection = await this.collection();
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const result = await collection.deleteMany({
      createdAt: { $lt: cutoffDate },
      status: { $in: ['resolved', 'failed'] },
    });
    
    return result.deletedCount;
  }
}

module.exports = DeadLetterQueue;

