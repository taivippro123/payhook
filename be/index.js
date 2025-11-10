const express = require('express');
const { connectDB, closeDB, getDB } = require('./db');
const path = require('path');
const { parseEmlFileToTransaction, parseMailToTransaction } = require('./services/emailParser');
const { scanGmail } = require('./services/gmailScanner');
const EmailMonitor = require('./services/emailMonitor');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Kết nối database khi server khởi động
connectDB().catch((error) => {
  console.error('Failed to connect to database:', error);
  process.exit(1);
});

// Khởi tạo Email Monitor nếu có config trong env
let emailMonitor = null;
const GMAIL_EMAIL = process.env.GMAIL_EMAIL;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const SCAN_INTERVAL = parseInt(process.env.SCAN_INTERVAL || '30000', 10); // 30 giây mặc định

if (GMAIL_EMAIL && GMAIL_APP_PASSWORD) {
  emailMonitor = new EmailMonitor(GMAIL_EMAIL, GMAIL_APP_PASSWORD, {
    scanInterval: SCAN_INTERVAL,
    onTransaction: async (transaction) => {
      // Callback khi phát hiện transaction mới
      // Có thể lưu vào DB hoặc gửi webhook ở đây
      // Không log ở đây để tránh duplicate với log trong emailMonitor
    },
  });
  console.log(`✅ Email monitoring configured for: ${GMAIL_EMAIL}`);
} else {
  console.warn('⚠️  GMAIL_EMAIL or GMAIL_APP_PASSWORD not set in .env - Email monitoring disabled');
  console.warn('⚠️  Add GMAIL_EMAIL and GMAIL_APP_PASSWORD to .env to enable background monitoring');
}

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Endpoint kiểm tra DB
app.get('/health', async (req, res) => {
  try {
    const db = await getDB();
    const stats = await db.command({ ping: 1 });
    res.json({ ok: stats.ok });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint parse .eml mẫu (TPBank) và trả về JSON (giữ lại để test)
app.get('/parse/eml', async (req, res) => {
  try {
    const file = req.query.file || path.join('payhook', 'Thông báo giao dịch từ tài khoản.eml');
    const parsed = await parseEmlFileToTransaction(file);
    console.log('Parsed email transaction:', parsed);
    res.json(parsed);
  } catch (error) {
    console.error('Parse eml error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint quét Gmail và parse email giao dịch
app.post('/scan/gmail', async (req, res) => {
  try {
    const { email, appPassword, limit = 10 } = req.body;

    if (!email || !appPassword) {
      return res.status(400).json({ 
        error: 'Missing required fields: email and appPassword are required' 
      });
    }

    console.log(`📧 Scanning Gmail for: ${email}`);

    // Quét email từ Gmail
    const emails = await scanGmail(email, appPassword, {
      limit: parseInt(limit, 10),
      searchCriteria: ['UNSEEN'], // Chỉ lấy email chưa đọc
    });

    if (emails.length === 0) {
      return res.json({
        success: true,
        message: 'No new emails found',
        transactions: [],
        count: 0,
      });
    }

    // Parse từng email thành transaction
    const transactions = [];
    const errors = [];

    for (const emailData of emails) {
      try {
        const parsed = parseMailToTransaction(emailData.raw);
        
        // Chỉ trả về email có phát hiện được bank (không phải UNKNOWN)
        if (parsed.bank !== 'UNKNOWN') {
          transactions.push({
            ...parsed,
            emailUid: emailData.uid,
            emailDate: emailData.date,
          });
          
          console.log(`✅ Parsed transaction from ${parsed.bank}:`, {
            transactionId: parsed.transactionId,
            amount: parsed.amountVND,
            date: parsed.executedAt,
          });
        }
      } catch (parseError) {
        errors.push({
          uid: emailData.uid,
          error: parseError.message,
        });
        console.error(`❌ Error parsing email UID ${emailData.uid}:`, parseError.message);
      }
    }

    res.json({
      success: true,
      message: `Found ${transactions.length} transaction(s) from ${emails.length} email(s)`,
      transactions,
      count: transactions.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('❌ Gmail scan error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.stack,
    });
  }
});

// Endpoint xem trạng thái email monitor
app.get('/monitor/status', (req, res) => {
  if (!emailMonitor) {
    return res.json({
      enabled: false,
      message: 'Email monitor not configured. Set GMAIL_EMAIL and GMAIL_APP_PASSWORD in .env',
    });
  }
  res.json({
    enabled: true,
    ...emailMonitor.getStats(),
  });
});

// Endpoint dừng email monitor
app.post('/monitor/stop', (req, res) => {
  if (!emailMonitor) {
    return res.status(400).json({ error: 'Email monitor not configured' });
  }
  emailMonitor.stop();
  res.json({ success: true, message: 'Email monitor stopped' });
});

// Endpoint khởi động lại email monitor
app.post('/monitor/start', (req, res) => {
  if (!emailMonitor) {
    return res.status(400).json({ error: 'Email monitor not configured' });
  }
  emailMonitor.start();
  res.json({ success: true, message: 'Email monitor started' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  
  // Tự động khởi động email monitor nếu có config
  if (emailMonitor) {
    emailMonitor.start();
  }
  
  console.log(`\n📋 Available endpoints:`);
  console.log(`   GET  / - Health check`);
  console.log(`   GET  /health - Database health check`);
  console.log(`   GET  /monitor/status - Email monitor status`);
  console.log(`   POST /monitor/stop - Stop email monitor`);
  console.log(`   POST /monitor/start - Start email monitor`);
  console.log(`   GET  /parse/eml - Parse .eml file (test)`);
  console.log(`   POST /scan/gmail - Manual Gmail scan\n`);
});

// Đóng kết nối database và dừng email monitor khi server tắt
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  if (emailMonitor) {
    emailMonitor.stop();
  }
  await closeDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down server...');
  if (emailMonitor) {
    emailMonitor.stop();
  }
  await closeDB();
  process.exit(0);
});
