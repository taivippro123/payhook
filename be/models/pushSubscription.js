const { getDB } = require('../db');
const { ObjectId } = require('mongodb');

class PushSubscription {
  /**
   * Lấy collection push_subscriptions
   */
  static async collection() {
    const db = await getDB();
    return db.collection('push_subscriptions');
  }

  /**
   * Tạo hoặc cập nhật push subscription cho user
   * @param {string} userId
   * @param {Object} subscription - PushSubscription object từ browser
   * @param {Object} settings - { enabled, startTime, endTime }
   * @returns {Promise<Object>}
   */
  static async upsert(userId, subscription, settings = {}) {
    const collection = await this.collection();
    
    const subscriptionData = {
      userId: new ObjectId(userId),
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      enabled: settings.enabled !== undefined ? settings.enabled : true,
      startTime: settings.startTime || '07:00', // Mặc định 7h
      endTime: settings.endTime || '21:00', // Mặc định 21h
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Tìm subscription đã tồn tại theo endpoint
    const existing = await collection.findOne({ endpoint: subscription.endpoint });
    
    if (existing) {
      // Cập nhật
      const result = await collection.findOneAndUpdate(
        { endpoint: subscription.endpoint },
        {
          $set: {
            ...subscriptionData,
            createdAt: existing.createdAt, // Giữ nguyên createdAt
          }
        },
        { returnDocument: 'after' }
      );
      return result.value;
    } else {
      // Tạo mới
      const result = await collection.insertOne(subscriptionData);
      return {
        ...subscriptionData,
        _id: result.insertedId,
      };
    }
  }

  /**
   * Lấy tất cả subscriptions của user
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  static async findByUserId(userId) {
    const collection = await this.collection();
    return await collection.find({ userId: new ObjectId(userId) }).toArray();
  }

  /**
   * Xóa subscription theo endpoint
   * @param {string} endpoint
   * @returns {Promise<boolean>}
   */
  static async deleteByEndpoint(endpoint) {
    const collection = await this.collection();
    const result = await collection.deleteOne({ endpoint });
    return result.deletedCount > 0;
  }

  /**
   * Xóa tất cả subscriptions của user
   * @param {string} userId
   * @returns {Promise<number>}
   */
  static async deleteByUserId(userId) {
    const collection = await this.collection();
    const result = await collection.deleteMany({ userId: new ObjectId(userId) });
    return result.deletedCount;
  }

  /**
   * Cập nhật settings của subscription
   * @param {string} endpoint
   * @param {Object} settings - { enabled?, startTime?, endTime? }
   * @returns {Promise<Object|null>}
   */
  static async updateSettings(endpoint, settings) {
    const collection = await this.collection();
    const updateData = {
      updatedAt: new Date(),
    };

    if (settings.enabled !== undefined) {
      updateData.enabled = settings.enabled;
    }
    if (settings.startTime !== undefined) {
      updateData.startTime = settings.startTime;
    }
    if (settings.endTime !== undefined) {
      updateData.endTime = settings.endTime;
    }

    const result = await collection.findOneAndUpdate(
      { endpoint },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return result.value;
  }

  /**
   * Kiểm tra xem thời gian hiện tại có trong khoảng cho phép không
   * @param {string} startTime - Format "HH:mm"
   * @param {string} endTime - Format "HH:mm"
   * @returns {boolean}
   */
  static isWithinTimeRange(startTime, endTime) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;

    // Xử lý trường hợp qua đêm (ví dụ: 21:00 - 07:00)
    if (endTimeMinutes < startTimeMinutes) {
      // Khoảng thời gian qua đêm
      return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes;
    } else {
      // Khoảng thời gian trong ngày
      return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
    }
  }
}

module.exports = PushSubscription;

