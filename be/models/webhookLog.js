const { getDB } = require('../db');
const { ObjectId } = require('mongodb');

function toObjectId(id) {
  if (!id) return null;
  try {
    return new ObjectId(id);
  } catch (error) {
    return null;
  }
}

function toPlainString(value) {
  if (!value) return value;
  return value.toString();
}

function serializeAttempt(attempt = {}) {
  return {
    ...attempt,
    requestedAt: attempt.requestedAt ? attempt.requestedAt.toISOString() : null,
    completedAt: attempt.completedAt ? attempt.completedAt.toISOString() : null,
  };
}

function serialize(doc) {
  if (!doc) return null;
  return {
    ...doc,
    _id: doc._id ? doc._id.toString() : undefined,
    userId: doc.userId ? doc.userId.toString() : null,
    userEmail: doc.userEmail || null,
    emailConfigId: doc.emailConfigId ? doc.emailConfigId.toString() : null,
    emailConfigEmail: doc.emailConfigEmail || null,
    transactionDocId: doc.transactionDocId ? doc.transactionDocId.toString() : null,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : null,
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
    lastAttemptAt: doc.lastAttemptAt ? doc.lastAttemptAt.toISOString() : null,
    attempts: Array.isArray(doc.attempts) ? doc.attempts.map(serializeAttempt) : [],
  };
}

class WebhookLog {
  static async collection() {
    const db = await getDB();
    return db.collection('webhook_logs');
  }

  static async create({
    webhookUrl,
    payload,
    userId,
    userEmail,
    emailConfigId,
    emailConfigEmail,
    transactionDocId,
    transactionId,
  }) {
    const collection = await this.collection();
    const now = new Date();

    const doc = {
      webhookUrl,
      payload,
      userId: toObjectId(userId),
      userEmail: userEmail || null,
      emailConfigId: toObjectId(emailConfigId),
      emailConfigEmail: emailConfigEmail || null,
      transactionDocId: toObjectId(transactionDocId),
      transactionId: transactionId || null,
      status: 'pending',
      totalAttempts: 0,
      attempts: [],
      lastError: null,
      finalStatusCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      lastAttemptAt: null,
    };

    const result = await collection.insertOne(doc);
    return {
      ...doc,
      _id: result.insertedId,
    };
  }

  static async appendAttempt(logId, attemptData = {}) {
    if (!logId) return;
    const collection = await this.collection();
    const _id = toObjectId(logId);
    if (!_id) return;

    const attempt = {
      attemptNumber: attemptData.attemptNumber,
      success: Boolean(attemptData.success),
      statusCode: attemptData.statusCode ?? null,
      errorMessage: attemptData.errorMessage || null,
      responseBody: attemptData.responseBody ?? null,
      requestedAt: attemptData.requestedAt instanceof Date ? attemptData.requestedAt : new Date(),
      completedAt: attemptData.completedAt instanceof Date ? attemptData.completedAt : new Date(),
      durationMs: typeof attemptData.durationMs === 'number' ? attemptData.durationMs : null,
    };

    await collection.updateOne(
      { _id },
      {
        $push: { attempts: attempt },
        $set: {
          updatedAt: new Date(),
          totalAttempts: attempt.attemptNumber,
          status: attempt.success ? 'success' : 'retrying',
          lastAttemptAt: attempt.completedAt,
          lastError: attempt.success ? null : attempt.errorMessage || null,
          finalStatusCode: attempt.statusCode ?? null,
        },
      }
    );
  }

  static async markCompleted(logId, { success, finalStatusCode, errorMessage }) {
    if (!logId) return;
    const collection = await this.collection();
    const _id = toObjectId(logId);
    if (!_id) return;

    await collection.updateOne(
      { _id },
      {
        $set: {
          status: success ? 'success' : 'failed',
          updatedAt: new Date(),
          completedAt: new Date(),
          finalStatusCode: finalStatusCode ?? null,
          lastError: success ? null : errorMessage || null,
        },
      }
    );
  }

  static async list({ filter = {}, page = 1, limit = 20, sort = { createdAt: -1 } } = {}) {
    const collection = await this.collection();
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const cursor = collection.find(filter).sort(sort).skip(skip).limit(pageSize);
    const [items, total] = await Promise.all([
      cursor.toArray(),
      collection.countDocuments(filter),
    ]);

    return {
      logs: items.map(serialize),
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  static async findById(id) {
    const collection = await this.collection();
    const _id = toObjectId(id);
    if (!_id) return null;
    const doc = await collection.findOne({ _id });
    return serialize(doc);
  }
}

module.exports = WebhookLog;


