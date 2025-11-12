const { getDB } = require('../db');
const { ObjectId } = require('mongodb');

class EmailConfig {
  /**
   * Tạo email config mới
   * @param {Object} configData - { userId, email, appPassword, scanInterval }
   * @returns {Promise<Object>}
   */
  static async create({ userId, email, appPassword, scanInterval = 30000, webhookUrl }) {
    const db = await getDB();
    const configs = db.collection('email_configs');

    // Kiểm tra email đã tồn tại cho user này
    const existing = await configs.findOne({ 
      userId: new ObjectId(userId),
      email 
    });
    if (existing) {
      throw new Error('Email already configured for this user');
    }

    const config = {
      userId: new ObjectId(userId),
      email,
      appPassword, // Lưu plain text (có thể encrypt sau nếu cần)
      scanInterval: parseInt(scanInterval, 10),
      webhookUrl: webhookUrl || null,
      isActive: true,
      lastSyncedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await configs.insertOne(config);
    return {
      ...config,
      _id: result.insertedId,
    };
  }

  /**
   * Lấy tất cả email configs của user
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  static async findByUserId(userId) {
    const db = await getDB();
    const configs = db.collection('email_configs');
    return await configs.find({ 
      userId: new ObjectId(userId) 
    }).toArray();
  }

  /**
   * Lấy email config theo ID
   * @param {string} configId
   * @returns {Promise<Object|null>}
   */
  static async findById(configId) {
    const db = await getDB();
    const configs = db.collection('email_configs');
    return await configs.findOne({ 
      _id: new ObjectId(configId) 
    });
  }

  /**
   * Lấy tất cả email configs đang active
   * @returns {Promise<Array>}
   */
  static async findActive() {
    const db = await getDB();
    const configs = db.collection('email_configs');
    return await configs.find({ isActive: true }).toArray();
  }

  /**
   * Cập nhật email config
   * @param {string} configId
   * @param {Object} updates - { email?, appPassword?, scanInterval?, isActive? }
   * @returns {Promise<Object>}
   */
  static async update(configId, updates) {
    const db = await getDB();
    const configs = db.collection('email_configs');
    
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };
    
    // Xử lý webhookUrl: nếu là empty string thì set null
    if (updateData.webhookUrl === '') {
      updateData.webhookUrl = null;
    }

    const result = await configs.findOneAndUpdate(
      { _id: new ObjectId(configId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return result.value;
  }

  static async markSynced(configId, syncedAt = new Date()) {
    const db = await getDB();
    const configs = db.collection('email_configs');

    let resolvedDate = syncedAt instanceof Date ? syncedAt : new Date(syncedAt);
    if (Number.isNaN(resolvedDate.getTime())) {
      resolvedDate = new Date();
    }

    await configs.updateOne(
      { _id: new ObjectId(configId) },
      {
        $set: {
          lastSyncedAt: resolvedDate,
          updatedAt: new Date(),
        },
      }
    );
  }

  /**
   * Xóa email config
   * @param {string} configId
   * @returns {Promise<boolean>}
   */
  static async delete(configId) {
    const db = await getDB();
    const configs = db.collection('email_configs');
    const result = await configs.deleteOne({ 
      _id: new ObjectId(configId) 
    });
    return result.deletedCount > 0;
  }
}

module.exports = EmailConfig;

