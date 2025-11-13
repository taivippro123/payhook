const { scanGmail } = require('./gmailScanner');
const { parseMailToTransaction } = require('./emailParser');

class EmailMonitor {
  constructor(email, appPassword, options = {}) {
    this.email = email;
    this.appPassword = appPassword;
    const now = Date.now();
    const resumeFrom = options.resumeFrom
      ? new Date(options.resumeFrom)
      : new Date(now - (options.lookbackMs || 5 * 60 * 1000)); // mặc định lùi 5 phút
    this.resumeFrom = Number.isNaN(resumeFrom.getTime()) ? new Date(now - 5 * 60 * 1000) : resumeFrom;
    this.startTime = new Date(now); // Thời điểm app khởi động
    this.isRunning = false;
    this.intervalId = null;
    this.scanInterval = options.scanInterval || Number(process.env.SCAN_INTERVAL_MS) || 1000; // default 1s
    this.batchSize = options.batchSize || 50;
    this.isScanning = false; // Flag để tránh scan đồng thời 
    this.onTransactionCallback = options.onTransaction || null;
    this.processedUids = new Set(); // Lưu UID đã xử lý để tránh duplicate
    this.scanCount = 0; // Đếm số lần scan để chỉ log lần đầu
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
    console.log(`📬 Resume from: ${this.resumeFrom.toISOString()}`);

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
      return; // Không log nữa để giảm noise
    }

    this.isScanning = true;
    this.scanCount++;
    const isFirstScan = this.scanCount === 1;
    
    try {
      // Chỉ log lần đầu
      if (isFirstScan) {
        console.log(`🔍 [${this.email}] Starting Gmail scan...`);
      }
      
      const emails = await scanGmail(this.email, this.appPassword, {
        limit: this.batchSize, // đủ để phát hiện nhanh
        searchCriteria: ['UNSEEN'],
        sinceDate: this.resumeFrom,
      });

      // Chỉ log khi có email mới hoặc lần đầu
      if (emails.length > 0) {
        console.log(`✅ [${this.email}] Found ${emails.length} email(s)`);
      } else if (isFirstScan) {
        console.log(`✅ [${this.email}] Gmail scan completed. No new emails`);
      }

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
            // Bỏ qua nếu số tiền âm (chỉ nhận cộng tiền, không check trừ tiền)
            if (parsed.amountVND !== null && parsed.amountVND < 0) {
              console.log(`⏭️  Skipping negative amount transaction: ${parsed.amountVND} VND`);
              this.processedUids.add(emailData.uid); // Đánh dấu đã xử lý để không scan lại
              continue;
            }

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

            this.updateResumeFrom(emailData.date);

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
      resumeFrom: this.resumeFrom.toISOString(),
    };
  }

  updateResumeFrom(date) {
    const fallback = new Date();
    const parsedDate = date ? new Date(date) : fallback;
    if (Number.isNaN(parsedDate.getTime())) {
      this.resumeFrom = fallback;
      return;
    }
    if (!this.resumeFrom || Number.isNaN(this.resumeFrom.getTime()) || parsedDate > this.resumeFrom) {
      // Lùi 5 giây để đảm bảo không bỏ sót email có timestamp bằng nhau
      this.resumeFrom = new Date(parsedDate.getTime() + 5000);
    }
  }
}

module.exports = EmailMonitor;

