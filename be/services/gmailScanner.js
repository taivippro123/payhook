const imap = require('imap-simple');
const { simpleParser } = require('mailparser');

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

  const config = {
    imap: {
      user: email,
      password: appPassword,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
      connTimeout: 10000,
      keepalive: false, // Tắt keepalive để tránh giữ connection
    },
  };

  let connection;
  try {
    // Kết nối IMAP (không log mỗi lần)
    connection = await imap.connect(config);

    // Mở inbox
    await connection.openBox('INBOX', true);

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
    
    // Search và fetch email bodies cùng lúc
    const messages = await connection.search(searchCriteriaArray, {
      bodies: '',
      struct: true,
    });

    if (!messages || messages.length === 0) {
      return [];
    }

    // Lấy số lượng email theo limit
    const messagesToProcess = messages.slice(0, limit);

    const parsedEmails = [];

    for (const message of messagesToProcess) {
      try {
        const uid = message.attributes.uid;
        
        // Lấy phần body của email
        const all = message.parts.find((part) => part.which === '');
        if (!all || !all.body) {
          continue;
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
          continue;
        }
        
        parsedEmails.push({
          uid: uid,
          subject: mail.subject,
          from: fromText,
          date: emailDate ? emailDate.toISOString() : null,
          text: mail.text,
          html: mail.html,
          raw: mail,
        });
      } catch (parseError) {
        console.error(`❌ Error parsing email UID ${uid}:`, parseError.message);
      }
    }

    return parsedEmails;

  } catch (error) {
    console.error('❌ Gmail scan error:', error.message);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (closeError) {
        console.error('❌ Error closing IMAP connection:', closeError.message);
      }
    }
  }
}

module.exports = {
  scanGmail,
};

