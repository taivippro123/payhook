const { getDB } = require('../db');
const { ObjectId } = require('mongodb');
const { encrypt, decrypt } = require('../utils/encryption');

class EmailConfig {
  /**
   * Tạo email config mới
   * @param {Object} configData - { userId, email, refreshToken?, webhookUrl?, watchHistoryId?, watchExpiration? }
   * @returns {Promise<Object>}
   */
  static async create({ userId, email, appPassword, scanInterval = 30000, webhookUrl, xiaozhiMcpUrl, refreshToken, watchHistoryId, watchExpiration }) {
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
      appPassword: appPassword || null, // Có thể null nếu dùng OAuth
      refreshToken: refreshToken ? (() => {
        try {
          const encrypted = encrypt(refreshToken);
          console.log(`🔐 Encrypted refreshToken for new config (email: ${email})`);
          return encrypted;
        } catch (encryptError) {
          console.error(`❌ Failed to encrypt refreshToken for new config:`, encryptError.message);
          throw new Error('Failed to encrypt refresh token');
        }
      })() : null, // OAuth refresh token - ENCRYPTED
      scanInterval: parseInt(scanInterval, 10),
      webhookUrl: webhookUrl || null,
      webhookSecret: null, // Sẽ được generate khi user set webhook URL
      xiaozhiMcpUrl: xiaozhiMcpUrl || null, // Xiaozhi MCP WebSocket URL
      watchHistoryId: watchHistoryId || null, // Gmail watch history ID
      watchExpiration: watchExpiration || null, // Gmail watch expiration
      isActive: true,
      lastSyncedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await configs.insertOne(config);
    const createdConfig = {
      ...config,
      _id: result.insertedId,
    };
    // Decrypt refresh token để return (không lưu plaintext trong response)
    return this.decryptRefreshToken(createdConfig);
  }

  /**
   * Decrypt refresh token trong config object
   * @param {Object} config - Config object từ database
   * @returns {Object} Config với decrypted refreshToken
   */
  static decryptRefreshToken(config) {
    if (!config) return config;
    if (config.refreshToken) {
      try {
        // Thử decrypt - nếu fail có thể là plain text (data cũ)
        config.refreshToken = decrypt(config.refreshToken);
      } catch (error) {
        // Nếu decrypt fail, có thể là plain text (backward compatibility)
        // Giữ nguyên và log warning
        console.warn('⚠️ Refresh token appears to be plain text (not encrypted). Consider running migration script.');
        // Không set null, giữ nguyên để backward compatibility
      }
    }
    return config;
  }

  /**
   * Lấy tất cả email configs của user
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  static async findByUserId(userId) {
    const db = await getDB();
    const configs = db.collection('email_configs');
    const results = await configs.find({ 
      userId: new ObjectId(userId) 
    }).toArray();
    // Decrypt refresh tokens
    return results.map(config => this.decryptRefreshToken(config));
  }

  /**
   * Lấy email config theo ID
   * @param {string} configId
   * @returns {Promise<Object|null>}
   */
  static async findById(configId) {
    const db = await getDB();
    const configs = db.collection('email_configs');
    const config = await configs.findOne({ 
      _id: new ObjectId(configId) 
    });
    return config ? this.decryptRefreshToken(config) : null;
  }

  /**
   * Lấy tất cả email configs đang active
   * @returns {Promise<Array>}
   */
  static async findActive() {
    const db = await getDB();
    const configs = db.collection('email_configs');
    const results = await configs.find({ isActive: true }).toArray();
    // Decrypt refresh tokens
    return results.map(config => this.decryptRefreshToken(config));
  }

  /**
   * Cập nhật email config
   * @param {string} configId
   * @param {Object} updates - { email?, appPassword?, scanInterval?, isActive? }
   * @returns {Promise<Object>}
   */
  static async update(configId, updates) {
    try {
      const db = await getDB();
      const configs = db.collection('email_configs');
      
      // Validate ObjectId
      let objectId;
      try {
        objectId = new ObjectId(configId);
      } catch (idError) {
        console.error(`❌ Invalid ObjectId: ${configId}`, idError);
        throw new Error(`Invalid config ID: ${configId}`);
      }
      
      const updateData = {
        ...updates,
        updatedAt: new Date(),
      };
      
      // Xử lý webhookUrl: nếu là empty string thì set null
      if (updateData.webhookUrl === '') {
        updateData.webhookUrl = null;
      }
      
      // Xử lý xiaozhiMcpUrl: nếu là empty string thì set null
      if (updateData.xiaozhiMcpUrl === '') {
        updateData.xiaozhiMcpUrl = null;
      }
      
      // Mã hóa refreshToken nếu có trong updates
      if (updateData.refreshToken) {
        try {
          updateData.refreshToken = encrypt(updateData.refreshToken);
          console.log(`🔐 Encrypted refreshToken for config ${configId}`);
        } catch (encryptError) {
          console.error(`❌ Failed to encrypt refreshToken for config ${configId}:`, encryptError.message);
          throw new Error('Failed to encrypt refresh token');
        }
      }

      console.log(`🔄 Updating config ${configId} with data:`, { ...updateData, appPassword: updateData.appPassword ? '[REDACTED]' : undefined });

      // Dùng updateOne để update, sau đó findOne để lấy document mới
      const updateResult = await configs.updateOne(
        { _id: objectId },
        { $set: updateData }
      );

      console.log(`🔍 updateOne result:`, {
        matchedCount: updateResult.matchedCount,
        modifiedCount: updateResult.modifiedCount,
        acknowledged: updateResult.acknowledged,
      });

      // Kiểm tra xem có document nào được match không
      if (updateResult.matchedCount === 0) {
        console.error(`❌ Config ${configId} not found (matchedCount: 0)`);
        throw new Error('Email config not found or update failed');
      }

      // Lấy document sau khi update
      const updatedConfig = await configs.findOne({ _id: objectId });

      if (!updatedConfig) {
        console.error(`❌ Config ${configId} not found after update`);
        throw new Error('Email config not found or update failed');
      }

      console.log(`✅ Config ${configId} updated successfully`);
      // Decrypt refresh token trước khi return
      return this.decryptRefreshToken(updatedConfig);
    } catch (error) {
      console.error(`❌ Error updating config ${configId}:`, error.message);
      throw error;
    }
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

