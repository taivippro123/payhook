const imap = require('imap-simple');
const { simpleParser } = require('mailparser');
const connectionPool = require('./imapConnectionPool');

// Track logged emails để chỉ log lần đầu
const loggedEmails = new Set();

/**
 * Kết nối Gmail qua IMAP và quét email
 * @param {string} email - Email address
 * @param {string} appPassword - Gmail App Password
 * @param {Object} options - Tùy chọn quét
 * @param {number} options.limit - Số email tối đa (default: 10)
 * @param {string|Array} options.searchCriteria - Tiêu chí tìm kiếm IMAP (default: 'UNSEEN')
 * @param {Date} options.sinceDate - Chỉ lấy email sau ngày này (optional)
 * @returns {Promise<Array>} Mảng các email đã parse
 */
async function scanGmail(email, appPassword, options = {}) {
  const { limit = 10, searchCriteria = ['UNSEEN'], sinceDate } = options;

  let connection;
  const isFirstTime = !loggedEmails.has(email);
  if (isFirstTime) {
    loggedEmails.add(email);
  }

  const scanStartTime = Date.now();
  
  try {
    // Sử dụng connection pool để reuse connection
    connection = await connectionPool.getConnection(email, appPassword);
    
    if (isFirstTime) {
      console.log(`🔌 [${email}] Using connection pool for Gmail IMAP`);
    }

    // Tìm email theo tiêu chí
    let searchCriteriaArray = Array.isArray(searchCriteria) 
      ? [...searchCriteria] 
      : [searchCriteria];
    
    // Nếu có sinceDate, thêm điều kiện SINCE
    if (sinceDate) {
      // Format: SINCE 10-Nov-2025 (IMAP format)
      const day = String(sinceDate.getDate()).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[sinceDate.getMonth()];
      const year = sinceDate.getFullYear();
      const dateStr = `${day}-${month}-${year}`;
      searchCriteriaArray.push(['SINCE', dateStr]);
    }
    
    // Search và fetch email bodies cùng lúc (imap-simple không có fetch() riêng)
    const searchStartTime = Date.now();
    const searchResults = await connection.search(searchCriteriaArray, {
      bodies: '',
      struct: true,
    });

    if (!searchResults || searchResults.length === 0) {
      return [];
    }

    const searchDuration = Date.now() - searchStartTime;
    if (searchDuration > 1000) {
      console.log(`⏱️  [${email}] IMAP search took ${searchDuration}ms for ${searchResults.length} message(s)`);
    }

    // Sort messages theo UID descending để lấy email mới nhất trước (UID cao hơn = email mới hơn)
    searchResults.sort((a, b) => {
      const uidA = a.attributes?.uid || 0;
      const uidB = b.attributes?.uid || 0;
      return uidB - uidA; // Descending: email mới nhất trước
    });

    // Lấy số lượng email theo limit (đã sort, nên sẽ lấy email mới nhất)
    const messagesToProcess = searchResults.slice(0, limit);

    const parsedEmails = [];
    const parseStartTime = Date.now();

    // Parse emails song song để tăng tốc độ
    const parsePromises = messagesToProcess.map(async (message) => {
      try {
        const uid = message.attributes.uid;
        
        // Lấy phần body của email
        const all = message.parts.find((part) => part.which === '');
        if (!all || !all.body) {
          return null;
        }
        
        // Convert body thành buffer
        let emailBuffer;
        if (Buffer.isBuffer(all.body)) {
          emailBuffer = all.body;
        } else if (typeof all.body === 'string') {
          emailBuffer = Buffer.from(all.body, 'utf8');
        } else {
          emailBuffer = Buffer.from(String(all.body), 'utf8');
        }

        // Parse email
        const mail = await simpleParser(emailBuffer);

        const emailDate = mail.date ? new Date(mail.date) : null;
        const fromText = mail.from?.text || (mail.from?.value?.[0] ? mail.from.value[0].address : '') || '';
        
        // Lọc thêm theo date nếu có sinceDate (IMAP SINCE có thể không chính xác 100%)
        if (sinceDate && emailDate && emailDate < sinceDate) {
          return null;
        }
        
        return {
          uid: uid,
          subject: mail.subject,
          from: fromText,
          date: emailDate ? emailDate.toISOString() : null,
          text: mail.text,
          html: mail.html,
          raw: mail,
        };
      } catch (parseError) {
        console.error(`❌ Error parsing email UID ${message.attributes?.uid}:`, parseError.message);
        return null;
      }
    });

    // Chờ tất cả parse xong
    const parseResults = await Promise.all(parsePromises);
    const parseDuration = Date.now() - parseStartTime;
    if (parseDuration > 1000) {
      console.log(`⏱️  [${email}] Email parsing took ${parseDuration}ms for ${messagesToProcess.length} email(s)`);
    }

    // Lọc bỏ null values
    for (const result of parseResults) {
      if (result) {
        parsedEmails.push(result);
      }
    }

    const scanDuration = Date.now() - scanStartTime;
    if (isFirstTime || scanDuration > 2000) {
      console.log(`⏱️  [${email}] Scan completed in ${scanDuration}ms`);
    }

    return parsedEmails;

  } catch (error) {
    console.error(`❌ [${email}] Gmail scan error:`, error.message);
    
    // Nếu lỗi liên quan đến connection (timeout, connection closed, etc), đóng và xóa khỏi pool
    const isConnectionError = error.message.includes('timeout') || 
                              error.message.includes('connection') || 
                              error.message.includes('ECONNRESET') ||
                              error.message.includes('socket');
    
    if (isConnectionError && connection) {
      console.log(`🔄 [${email}] Connection error detected, closing and removing from pool`);
      await connectionPool.closeConnection(email).catch(() => {});
    }
    
    throw error;
  } finally {
    // Release connection về pool thay vì đóng (trừ khi đã bị đóng do lỗi)
    if (connection) {
      try {
        connectionPool.releaseConnection(email);
      } catch (releaseError) {
        // Ignore release errors
      }
    }
  }
}

module.exports = {
  scanGmail,
};

