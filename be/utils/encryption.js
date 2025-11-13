const crypto = require('crypto');

// Lấy encryption key từ environment variable
// Nếu không có, generate một key mới (chỉ dùng cho development)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

// Log warning nếu không có ENCRYPTION_KEY (chỉ log 1 lần khi module load)
if (!process.env.ENCRYPTION_KEY) {
  console.warn('⚠️ ENCRYPTION_KEY not set in environment! Using random key (will change on restart).');
  console.warn('   This means encrypted data cannot be decrypted after server restart.');
  console.warn('   Please set ENCRYPTION_KEY in fly.io secrets: fly secrets set ENCRYPTION_KEY=<your-64-char-hex-key>');
} else {
  console.log('✅ ENCRYPTION_KEY is set');
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for IV
const SALT_LENGTH = 64; // 64 bytes for salt
const TAG_LENGTH = 16; // 16 bytes for auth tag

// Derive key từ ENCRYPTION_KEY
function getKey() {
  // Nếu ENCRYPTION_KEY là 64 hex chars (32 bytes), dùng trực tiếp
  if (ENCRYPTION_KEY.length === 64) {
    return Buffer.from(ENCRYPTION_KEY, 'hex');
  }
  // Nếu không, hash nó để có 32 bytes
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

/**
 * Mã hóa text
 * @param {string} text - Text cần mã hóa
 * @returns {string} Encrypted text (base64 encoded)
 */
function encrypt(text) {
  if (!text) return null;
  
  try {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV + authTag + encrypted data
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'base64')
    ]);
    
    return combined.toString('base64');
  } catch (error) {
    console.error('❌ Encryption error:', error.message);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Giải mã text
 * @param {string} encryptedText - Encrypted text (base64 encoded)
 * @returns {string} Decrypted text
 */
function decrypt(encryptedText) {
  if (!encryptedText) return null;
  
  try {
    const key = getKey();
    const combined = Buffer.from(encryptedText, 'base64');
    
    // Extract IV, authTag, and encrypted data
    const iv = combined.slice(0, IV_LENGTH);
    const authTag = combined.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.slice(IV_LENGTH + TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, null, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('❌ Decryption error:', error.message);
    throw new Error('Failed to decrypt data');
  }
}

module.exports = {
  encrypt,
  decrypt,
};

