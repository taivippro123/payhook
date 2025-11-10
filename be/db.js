const { MongoClient } = require('mongodb');
require('dotenv').config();

let client = null;
let db = null;

/**
 * Kết nối đến MongoDB database
 * @returns {Promise<MongoClient>}
 */
async function connectDB() {
  try {
    const mongoUri = process.env.MONGO_URI;
    
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is not set');
    }

    // Nếu đã kết nối, trả về client hiện tại
    if (client && client.topology && client.topology.isConnected()) {
      return client;
    }

    // Tạo client mới nếu chưa có hoặc đã mất kết nối
    client = new MongoClient(mongoUri, {
      // Các options tối ưu cho kết nối
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await client.connect();
    console.log('✅ Connected to MongoDB successfully');
    
    // Lấy database name từ URI hoặc sử dụng default
    const dbName = mongoUri.split('/').pop().split('?')[0] || 'test';
    db = client.db(dbName);
    
    return client;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    throw error;
  }
}

/**
 * Lấy database instance
 * @returns {Promise<Db>}
 */
async function getDB() {
  if (!db) {
    await connectDB();
  }
  return db;
}

/**
 * Đóng kết nối MongoDB
 */
async function closeDB() {
  try {
    if (client) {
      await client.close();
      console.log('✅ MongoDB connection closed');
      client = null;
      db = null;
    }
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error.message);
    throw error;
  }
}

module.exports = {
  connectDB,
  getDB,
  closeDB,
  client: () => client,
};

