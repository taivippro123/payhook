/**
 * Migration script để encrypt các refresh token còn plain text trong database
 * 
 * Usage: node scripts/migrate-encrypt-refresh-tokens.js
 * 
 * Lưu ý: Cần set ENCRYPTION_KEY trong .env trước khi chạy
 */

require('dotenv').config();
const { connectDB, getDB } = require('../db');
const { encrypt, decrypt } = require('../utils/encryption');

async function migrateRefreshTokens() {
  try {
    console.log('🔄 Starting migration: Encrypt plain text refresh tokens...');
    
    // Kiểm tra ENCRYPTION_KEY
    if (!process.env.ENCRYPTION_KEY) {
      console.error('❌ ENCRYPTION_KEY not set in .env file!');
      console.error('   Please set ENCRYPTION_KEY in your .env file before running migration.');
      process.exit(1);
    }
    
    await connectDB();
    const db = await getDB();
    const configs = db.collection('email_configs');
    
    // Lấy tất cả configs có refreshToken
    const allConfigs = await configs.find({ refreshToken: { $ne: null } }).toArray();
    
    console.log(`📋 Found ${allConfigs.length} configs with refreshToken`);
    
    let encryptedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const config of allConfigs) {
      try {
        const refreshToken = config.refreshToken;
        
        // Kiểm tra xem đã được encrypt chưa
        // Encrypted token thường là base64 string dài hơn và có cấu trúc đặc biệt
        // Plain text token thường ngắn hơn và không phải base64 hợp lệ
        let isEncrypted = false;
        
        try {
          // Thử decrypt - nếu thành công thì đã được encrypt
          const decrypted = decrypt(refreshToken);
          if (decrypted && decrypted.length > 0) {
            isEncrypted = true;
          }
        } catch (e) {
          // Decrypt fail = có thể là plain text hoặc format sai
          isEncrypted = false;
        }
        
        if (isEncrypted) {
          console.log(`⏭️  Config ${config._id}: Already encrypted, skipping`);
          skippedCount++;
        } else {
          // Plain text - cần encrypt
          console.log(`🔐 Config ${config._id}: Encrypting plain text token...`);
          const encrypted = encrypt(refreshToken);
          
          await configs.updateOne(
            { _id: config._id },
            { $set: { refreshToken: encrypted, updatedAt: new Date() } }
          );
          
          // Verify encryption
          const updated = await configs.findOne({ _id: config._id });
          try {
            const decrypted = decrypt(updated.refreshToken);
            if (decrypted === refreshToken) {
              console.log(`✅ Config ${config._id}: Successfully encrypted`);
              encryptedCount++;
            } else {
              console.error(`❌ Config ${config._id}: Encryption verification failed`);
              errorCount++;
            }
          } catch (verifyError) {
            console.error(`❌ Config ${config._id}: Failed to verify encryption:`, verifyError.message);
            errorCount++;
          }
        }
      } catch (error) {
        console.error(`❌ Config ${config._id}: Error processing:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Encrypted: ${encryptedCount}`);
    console.log(`   ⏭️  Skipped (already encrypted): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📋 Total: ${allConfigs.length}`);
    
    if (errorCount > 0) {
      console.log('\n⚠️  Some configs failed to encrypt. Please review the errors above.');
      process.exit(1);
    } else {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Chạy migration
migrateRefreshTokens();

