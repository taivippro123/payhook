const { scanGmail } = require('./gmailScanner');
const { parseMailToTransaction } = require('./emailParser');

class EmailMonitor {
  constructor(email, appPassword, options = {}) {
    this.email = email;
    this.appPassword = appPassword;
    this.startTime = new Date(); // Thời điểm app khởi động
    this.isRunning = false;
    this.intervalId = null;
    this.scanInterval = options.scanInterval || 30000; // 30 giây mặc định
    this.isScanning = false; // Flag để tránh scan đồng thời 
    this.onTransactionCallback = options.onTransaction || null;
    this.processedUids = new Set(); // Lưu UID đã xử lý để tránh duplicate
  }

  /**
   * Bắt đầu monitoring email
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Email monitor is already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 Starting email monitor for: ${this.email}`);
    console.log(`⏰ Monitoring emails since: ${this.startTime.toISOString()}`);
    console.log(`🔄 Scan interval: ${this.scanInterval / 1000} seconds`);

    // Chạy ngay lần đầu
    this.scan();

    // Sau đó chạy định kỳ
    this.intervalId = setInterval(() => {
      this.scan();
    }, this.scanInterval);
  }

  /**
   * Dừng monitoring
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('🛑 Email monitor stopped');
  }

  /**
   * Quét email và xử lý transaction
   */
  async scan() {
    // Tránh scan đồng thời
    if (this.isScanning) {
      return;
    }

    this.isScanning = true;
    try {
      const emails = await scanGmail(this.email, this.appPassword, {
        limit: 50, // Lấy nhiều hơn để đảm bảo không bỏ sót
        searchCriteria: ['UNSEEN'],
        sinceDate: this.startTime,
      });

      if (emails.length === 0) {
        return; // Không log gì nếu không có email mới
      }

      // Parse và xử lý từng email
      for (const emailData of emails) {
        // Bỏ qua nếu đã xử lý
        if (this.processedUids.has(emailData.uid)) {
          continue;
        }

        try {
          const parsed = parseMailToTransaction(emailData.raw);

          // Chỉ xử lý email có phát hiện được bank
          if (parsed.bank !== 'UNKNOWN') {
            // Đánh dấu đã xử lý
            this.processedUids.add(emailData.uid);

            const transaction = {
              ...parsed,
              emailUid: emailData.uid,
              emailDate: emailData.date,
              detectedAt: new Date().toISOString(),
            };

            // In JSON format
            console.log('\n✅ New transaction detected:');
            console.log(JSON.stringify(transaction, null, 2));

            // Gọi callback nếu có
            if (this.onTransactionCallback) {
              try {
                await this.onTransactionCallback(transaction);
              } catch (callbackError) {
                console.error('❌ Error in transaction callback:', callbackError.message);
              }
            }
          }
        } catch (parseError) {
          console.error(`❌ Error parsing email UID ${emailData.uid}:`, parseError.message);
        }
      }

    } catch (error) {
      console.error('❌ Error scanning emails:', error.message);
      // Không throw để service tiếp tục chạy
    } finally {
      this.isScanning = false;
      // Thêm delay nhỏ để tránh quá nhiều connection
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Lấy thống kê
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime.toISOString(),
      scanInterval: this.scanInterval,
      processedCount: this.processedUids.size,
    };
  }
}

module.exports = EmailMonitor;

