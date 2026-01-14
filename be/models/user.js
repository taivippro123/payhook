const { getDB } = require('../db');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

class User {
  /**
   * Tạo user mới
   * @param {Object} userData - { username, password, email, role? }
   * @returns {Promise<Object>} Created user (không có password)
   */
  static async create({ username, password, email, role = 'user' }) {
    const db = await getDB();
    const users = db.collection('users');

    // Kiểm tra username đã tồn tại
    const existing = await users.findOne({ username });
    if (existing) {
      throw new Error('Username already exists');
    }

    // Validate role
    if (role !== 'user' && role !== 'admin') {
      throw new Error('Invalid role. Must be "user" or "admin"');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const user = {
      username,
      email,
      passwordHash,
      role: role || 'user', // Mặc định là 'user'
      apiKey: crypto.randomBytes(32).toString('hex'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await users.insertOne(user);
    
    // Trả về user không có password
    const { passwordHash: _, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      _id: result.insertedId,
    };
  }

  /**
   * Tìm user theo username
   * @param {string} username
   * @returns {Promise<Object|null>}
   */
  static async findByUsername(username) {
    const db = await getDB();
    const users = db.collection('users');
    return await users.findOne({ username });
  }

  /**
   * Tìm user theo email
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  static async findByEmail(email) {
    const db = await getDB();
    const users = db.collection('users');
    return await users.findOne({ email });
  }

  /**
   * Tìm user theo API key (dùng cho endpoint chia sẻ giao dịch public)
   * @param {string} apiKey
   * @returns {Promise<Object|null>}
   */
  static async findByApiKey(apiKey) {
    if (!apiKey) return null;
    const db = await getDB();
    const users = db.collection('users');
    return await users.findOne({ apiKey });
  }

  /**
   * Lấy API key hiện tại của user (không tạo mới)
   * @param {string} userId
   * @returns {Promise<string|null>} apiKey hoặc null nếu chưa có
   */
  static async getApiKey(userId) {
    const db = await getDB();
    const users = db.collection('users');
    const objectId = new ObjectId(userId);

    const existing = await users.findOne({ _id: objectId });
    if (!existing) {
      throw new Error('User not found');
    }

    return existing.apiKey || null;
  }

  /**
   * Lấy hoặc tạo mới API key cho user
   * @param {string} userId
   * @returns {Promise<string>} apiKey
   */
  static async getOrCreateApiKey(userId) {
    const db = await getDB();
    const users = db.collection('users');
    const objectId = new ObjectId(userId);

    const existing = await users.findOne({ _id: objectId });
    if (!existing) {
      throw new Error('User not found');
    }

    if (existing.apiKey) {
      return existing.apiKey;
    }

    const apiKey = crypto.randomBytes(32).toString('hex');
    await users.updateOne(
      { _id: objectId },
      {
        $set: {
          apiKey,
          updatedAt: new Date(),
        },
      }
    );

    return apiKey;
  }

  /**
   * Rotate API key cho user (regen key mới)
   * @param {string} userId
   * @returns {Promise<string>} apiKey mới
   */
  static async rotateApiKey(userId) {
    const db = await getDB();
    const users = db.collection('users');
    const objectId = new ObjectId(userId);

    const apiKey = crypto.randomBytes(32).toString('hex');
    const result = await users.findOneAndUpdate(
      { _id: objectId },
      {
        $set: {
          apiKey,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      throw new Error('User not found');
    }

    return apiKey;
  }

  /**
   * Tìm user theo ID
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  static async findById(userId) {
    const db = await getDB();
    const users = db.collection('users');
    try {
      return await users.findOne({ _id: new ObjectId(userId) });
    } catch (error) {
      // Nếu userId không phải ObjectId hợp lệ, trả về null
      return null;
    }
  }

  /**
   * Cập nhật role của user
   * @param {string} userId
   * @param {string} role - 'user' hoặc 'admin'
   * @returns {Promise<Object|null>}
   */
  static async updateRole(userId, role) {
    const db = await getDB();
    const users = db.collection('users');
    
    if (role !== 'user' && role !== 'admin') {
      throw new Error('Invalid role. Must be "user" or "admin"');
    }

    try {
      const result = await users.findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { 
          $set: { 
            role,
            updatedAt: new Date(),
          } 
        },
        { returnDocument: 'after' }
      );
      return result.value;
    } catch (error) {
      return null;
    }
  }

  /**
   * Xác thực password
   * @param {string} password
   * @param {string} hash
   * @returns {Promise<boolean>}
   */
  static async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Lấy tất cả users (admin only)
   * @param {Object} options - { limit?, skip? }
   * @returns {Promise<Array>}
   */
  static async findAll(options = {}) {
    const db = await getDB();
    const users = db.collection('users');
    
    const { limit = 50, skip = 0 } = options;

    const result = await users
      .find({})
      .sort({ createdAt: -1 })
      .skip(parseInt(skip, 10))
      .limit(parseInt(limit, 10))
      .toArray();

    // Không trả về passwordHash
    return result.map(user => {
      const { passwordHash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  /**
   * Đếm tổng số users
   * @returns {Promise<number>}
   */
  static async count() {
    const db = await getDB();
    const users = db.collection('users');
    return await users.countDocuments({});
  }

  /**
   * Cập nhật thông tin user
   * @param {string} userId
   * @param {Object} updates - { username?, email?, password? }
   * @returns {Promise<Object|null>}
   */
  static async update(userId, updates) {
    const db = await getDB();
    const users = db.collection('users');

    const updateData = {
      updatedAt: new Date(),
    };

    // Cập nhật username nếu có
    if (updates.username) {
      // Kiểm tra username đã tồn tại chưa
      const existing = await users.findOne({ 
        username: updates.username,
        _id: { $ne: new ObjectId(userId) }
      });
      if (existing) {
        throw new Error('Username already exists');
      }
      updateData.username = updates.username;
    }

    // Cập nhật email nếu có
    if (updates.email) {
      updateData.email = updates.email;
    }

    // Cập nhật password nếu có
    if (updates.password) {
      if (updates.password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }
      updateData.passwordHash = await bcrypt.hash(updates.password, 10);
    }

    try {
      const result = await users.findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        return null;
      }

      // Không trả về passwordHash
      const { passwordHash, ...userWithoutPassword } = result.value;
      return userWithoutPassword;
    } catch (error) {
      if (error.message.includes('Username already exists') || error.message.includes('Password must be')) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Xóa user
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  static async delete(userId) {
    const db = await getDB();
    const users = db.collection('users');
    const objectId = new ObjectId(userId);

    try {
      const result = await users.deleteOne({ _id: objectId });
      if (!result.deletedCount) {
        return false;
      }

      await Promise.allSettled([
        db.collection('email_configs').deleteMany({ userId: objectId }),
        db.collection('transactions').deleteMany({ userId: objectId }),
        db.collection('webhook_logs').deleteMany({ userId: objectId }),
        db.collection('dead_letter_queue').deleteMany({ userId: objectId }),
        db.collection('push_subscriptions').deleteMany({ userId: objectId }),
      ]);

      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = User;

