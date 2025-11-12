const { getDB } = require('../db');
const { ObjectId } = require('mongodb');

class Transaction {
  /**
   * Lưu transaction mới
   * @param {Object} transactionData - Transaction data từ email parser
   * @param {string} userId
   * @param {string} emailConfigId
   * @returns {Promise<Object>}
   */
  static async create(transactionData, userId, emailConfigId) {
    const db = await getDB();
    const transactions = db.collection('transactions');

    const transaction = {
      userId: new ObjectId(userId),
      emailConfigId: new ObjectId(emailConfigId),
      ...transactionData,
      detectedAt: new Date(),
      createdAt: new Date(),
    };

    const result = await transactions.insertOne(transaction);
    return {
      ...transaction,
      _id: result.insertedId,
    };
  }

  /**
   * Lấy transactions của user
   * @param {string} userId
   * @param {Object} options - { limit?, skip?, sortBy?, order? }
   * @returns {Promise<Array>}
   */
  static async findByUserId(userId, options = {}) {
    const db = await getDB();
    const transactions = db.collection('transactions');

    const {
      limit = 50,
      skip = 0,
      sortBy = 'detectedAt',
      order = 'desc',
    } = options;

    const sortOrder = order === 'desc' ? -1 : 1;

    return await transactions
      .find({ userId: new ObjectId(userId) })
      .sort({ [sortBy]: sortOrder })
      .skip(parseInt(skip, 10))
      .limit(parseInt(limit, 10))
      .toArray();
  }

  /**
   * Đếm số transactions của user
   * @param {string} userId
   * @returns {Promise<number>}
   */
  static async countByUserId(userId) {
    const db = await getDB();
    const transactions = db.collection('transactions');
    return await transactions.countDocuments({ 
      userId: new ObjectId(userId) 
    });
  }

  /**
   * Kiểm tra transaction đã tồn tại (theo transactionId và bank)
   * @param {string} transactionId
   * @param {string} bank
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  static async exists(transactionId, bank, userId) {
    const db = await getDB();
    const transactions = db.collection('transactions');
    const count = await transactions.countDocuments({
      transactionId,
      bank,
      userId: new ObjectId(userId),
    });
    return count > 0;
  }

  /**
   * Lấy tất cả transactions (admin only)
   * @param {Object} options - { limit?, skip?, sortBy?, order?, userId? }
   * @returns {Promise<Array>}
   */
  static async findAll(options = {}) {
    const db = await getDB();
    const transactions = db.collection('transactions');

    const {
      limit = 50,
      skip = 0,
      sortBy = 'detectedAt',
      order = 'desc',
      userId,
    } = options;

    const sortOrder = order === 'desc' ? -1 : 1;
    const query = {};

    // Filter by userId nếu có
    if (userId) {
      query.userId = new ObjectId(userId);
    }

    return await transactions
      .find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(parseInt(skip, 10))
      .limit(parseInt(limit, 10))
      .toArray();
  }

  /**
   * Đếm tổng số transactions
   * @param {string} userId - Optional: filter by userId
   * @returns {Promise<number>}
   */
  static async countAll(userId = null) {
    const db = await getDB();
    const transactions = db.collection('transactions');
    
    const query = userId ? { userId: new ObjectId(userId) } : {};
    return await transactions.countDocuments(query);
  }

  /**
   * Lấy transaction mới nhất theo emailConfigId
   * @param {string} emailConfigId
   * @returns {Promise<Object|null>}
   */
  static async findLatestByEmailConfigId(emailConfigId) {
    const db = await getDB();
    const transactions = db.collection('transactions');

    return await transactions
      .find({ emailConfigId: new ObjectId(emailConfigId) })
      .sort({ detectedAt: -1, createdAt: -1 })
      .limit(1)
      .next();
  }
}

module.exports = Transaction;

