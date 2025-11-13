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
      // Đếm số lần skip (không tăng scanCount vì scan không chạy)
      this.skipCount = (this.skipCount || 0) + 1;
      // Log khi scan bị skip để debug (mỗi 10 lần skip)
      if (this.skipCount % 10 === 0) {
        console.log(`⏭️  [${this.email}] Scan skipped (previous scan still running). Total skipped: ${this.skipCount}`);
      }
      return;
    }

    this.isScanning = true;
    this.scanCount++;
    this.skipCount = 0; // Reset skip count khi scan chạy
    const isFirstScan = this.scanCount === 1;
    
    try {
      // Log mỗi lần scan để biết monitor đang chạy (không chỉ lần đầu)
      if (isFirstScan || this.scanCount % 10 === 0) {
        console.log(`🔍 [${this.email}] Starting scan #${this.scanCount}...`);
      }
      
      // Tối ưu: nếu resumeFrom quá cũ (> 30 phút), chỉ scan email trong 5 phút gần đây
      // để tránh scan quá nhiều email cũ, nhưng vẫn đảm bảo không bỏ sót email mới
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000); // Chỉ scan email trong 1 phút gần đây để tối ưu
      
      // Nếu resumeFrom quá cũ (> 30 phút), chỉ scan 1 phút gần đây (tối ưu hơn 5 phút)
      // Nếu resumeFrom gần đây (< 30 phút), dùng resumeFrom nhưng không quá 1 phút trước
      let scanSince = this.resumeFrom < thirtyMinutesAgo ? oneMinuteAgo : this.resumeFrom;
      // Đảm bảo scanSince không quá cũ (tối đa 1 phút trước) để tránh scan quá nhiều email
      if (scanSince < oneMinuteAgo) {
        scanSince = oneMinuteAgo;
      }
      
      // Giới hạn tìm kiếm email từ đúng nguồn gửi để giảm tải IMAP
      const cakeSearchCriteria = [
        'UNSEEN',
        ['HEADER', 'FROM', 'no-reply@cake.vn'],
        ['HEADER', 'SUBJECT', '[CAKE] Thông báo giao dịch thành công'],
      ];

      const scanStartTime = Date.now();
      const emails = await scanGmail(this.email, this.appPassword, {
        limit: this.batchSize, // đủ để phát hiện nhanh
        searchCriteria: cakeSearchCriteria,
        sinceDate: scanSince,
      });
      const scanDuration = Date.now() - scanStartTime;

      // Luôn log khi có email mới, log lần đầu và định kỳ để confirm scan hoạt động
      if (emails && emails.length > 0) {
        console.log(`✅ [${this.email}] Found ${emails.length} email(s) in ${scanDuration}ms`);
      } else {
        // Luôn log khi scan hoàn thành để confirm monitor vẫn chạy
        // Log mỗi lần scan (không chỉ mỗi 10 lần) để debug tốt hơn
        const emailCount = emails ? emails.length : 0;
        console.log(`✅ [${this.email}] Scan #${this.scanCount} completed in ${scanDuration}ms. No new emails (found ${emailCount} emails)`);
      }

      if (!emails || emails.length === 0) {
        return; // Không xử lý gì nếu không có email mới
      }

      // Sort emails theo date descending để xử lý email mới nhất trước
      emails.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA; // Descending: email mới nhất trước
      });

      // Parse và xử lý từng email (đã sort, email mới nhất sẽ được xử lý trước)
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
      console.error(`❌ [${this.email}] Error scanning emails:`, error.message);
      console.error(`❌ [${this.email}] Error stack:`, error.stack);
      // Log scan completed ngay cả khi có lỗi
      console.log(`✅ [${this.email}] Scan #${this.scanCount} completed with error`);
      // Không throw để service tiếp tục chạy
    } finally {
      this.isScanning = false;
      // Không delay nữa - scan interval đã được set bởi user, không cần delay thêm
      // Delay chỉ làm chậm việc phát hiện email mới
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

