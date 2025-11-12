const EmailMonitor = require('./emailMonitor');
const EmailConfig = require('../models/emailConfig');
const Transaction = require('../models/transaction');
const User = require('../models/user');
const { broadcastTransaction } = require('./wsHub');
const { sendWebhook } = require('./webhookSender');

const DEFAULT_RESUME_LOOKBACK_MS = Number(process.env.EMAIL_MONITOR_LOOKBACK_MS) || 30 * 60 * 1000; // 30 phút

function serializeTransaction(tx) {
  if (!tx) return null;
  const { raw, ...rest } = tx;
  return {
    ...rest,
    _id: tx._id ? tx._id.toString() : undefined,
    userId: tx.userId ? tx.userId.toString() : undefined,
    emailConfigId: tx.emailConfigId ? tx.emailConfigId.toString() : undefined,
    detectedAt: tx.detectedAt instanceof Date ? tx.detectedAt.toISOString() : tx.detectedAt,
    createdAt: tx.createdAt instanceof Date ? tx.createdAt.toISOString() : tx.createdAt,
  };
}

/**
 * Quản lý nhiều EmailMonitor cho nhiều users
 */
class MultiUserEmailMonitor {
  constructor() {
    this.monitors = new Map(); // Map<configId, EmailMonitor>
    this.isRunning = false;
  }

  /**
   * Khởi động monitoring cho tất cả email configs đang active
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Multi-user email monitor is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting multi-user email monitor...');

    // Load tất cả active configs và start monitoring
    await this.loadAndStartAll();

    // Định kỳ reload configs để phát hiện configs mới
    this.reloadInterval = setInterval(async () => {
      await this.loadAndStartAll();
    }, 60000); // Reload mỗi phút
  }

  /**
   * Dừng tất cả monitors
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
      this.reloadInterval = null;
    }

    // Dừng tất cả monitors
    for (const [configId, monitor] of this.monitors.entries()) {
      monitor.stop();
    }
    this.monitors.clear();

    console.log('🛑 Multi-user email monitor stopped');
  }

  /**
   * Load và start tất cả active configs
   */
  async loadAndStartAll() {
    try {
      const activeConfigs = await EmailConfig.findActive();

      // Start monitors cho configs mới hoặc chưa được start
      for (const config of activeConfigs) {
        const configId = config._id.toString();

        // Nếu monitor chưa tồn tại, tạo mới
        if (!this.monitors.has(configId)) {
          await this.startMonitorForConfig(config);
        } else {
          // Kiểm tra nếu config đã bị deactivate, dừng monitor
          const monitor = this.monitors.get(configId);
          if (!config.isActive) {
            monitor.stop();
            this.monitors.delete(configId);
            console.log(`🛑 Stopped monitor for config: ${configId}`);
          }
        }
      }

      // Dừng monitors cho configs không còn active
      for (const [configId, monitor] of this.monitors.entries()) {
        const config = activeConfigs.find(c => c._id.toString() === configId);
        if (!config || !config.isActive) {
          monitor.stop();
          this.monitors.delete(configId);
          console.log(`🛑 Stopped monitor for config: ${configId}`);
        }
      }
    } catch (error) {
      console.error('❌ Error loading email configs:', error.message);
    }
  }

  /**
   * Start monitor cho một config
   */
  async startMonitorForConfig(config) {
    try {
      const configId = config._id.toString();
      const userId = config.userId.toString();

      const lastSyncedAt = config.lastSyncedAt ? new Date(config.lastSyncedAt) : null;
      const latestTransaction = await Transaction.findLatestByEmailConfigId(configId);

      let resumeFrom = lastSyncedAt
        || (latestTransaction
          ? new Date(latestTransaction.detectedAt || latestTransaction.createdAt || Date.now())
          : null);

      if (!resumeFrom || Number.isNaN(resumeFrom.getTime())) {
        resumeFrom = new Date(Date.now() - DEFAULT_RESUME_LOOKBACK_MS);
      }

      const monitor = new EmailMonitor(config.email, config.appPassword, {
        scanInterval: config.scanInterval || Number(process.env.SCAN_INTERVAL_MS) || 1000,
        resumeFrom,
        lookbackMs: DEFAULT_RESUME_LOOKBACK_MS,
        batchSize: Math.max(20, Math.min(100, Math.floor((config.scanInterval || 1000) / 100))),
        onTransaction: async (transaction) => {
          // Lưu transaction vào DB
          try {
            // Kiểm tra transaction đã tồn tại chưa (tránh duplicate)
            const exists = await Transaction.exists(
              transaction.transactionId,
              transaction.bank,
              userId
            );

            if (!exists && transaction.transactionId) {
              const saved = await Transaction.create(transaction, userId, configId);
              const serialized = serializeTransaction(saved);
              if (serialized) {
                broadcastTransaction(serialized, userId);
              }
              console.log(`💾 Saved transaction to DB: ${transaction.transactionId}`);
              monitor.updateResumeFrom(transaction.emailDate || transaction.detectedAt);
              await EmailConfig.markSynced(configId, transaction.emailDate || transaction.detectedAt || new Date());
              
              // Gửi webhook nếu có cấu hình webhookUrl
              if (config.webhookUrl) {
                console.log('🔍 [multiUserEmailMonitor] About to send webhook for transaction:', transaction.transactionId);
                try {
                  // Lấy thông tin user email
                  let userEmail = null;
                  try {
                    const userDoc = await User.findById(userId);
                    userEmail = userDoc?.email || null;
                    console.log('✅ [multiUserEmailMonitor] Fetched user email:', userEmail);
                  } catch (userErr) {
                    console.warn('⚠️  Could not fetch user email:', userErr.message);
                  }

                  const webhookPayload = {
                    event: 'transaction.detected',
                    transaction: serialized,
                    timestamp: new Date().toISOString(),
                  };
                  
                  const meta = {
                    userId,
                    userEmail,
                    emailConfigId: configId,
                    emailConfigEmail: config.email,
                    transactionDocId: saved?._id?.toString(),
                    transactionId: saved?.transactionId || transaction.transactionId,
                  };
                  
                  console.log('📤 [multiUserEmailMonitor] Calling sendWebhook with meta:', {
                    userId: meta.userId,
                    transactionId: meta.transactionId,
                    webhookUrl: config.webhookUrl,
                  });
                  
                  const webhookResult = await sendWebhook(
                    config.webhookUrl,
                    webhookPayload,
                    3,
                    meta
                  );
                  if (webhookResult.success) {
                    console.log(`✅ Webhook sent successfully for transaction: ${transaction.transactionId}`);
                  } else {
                    console.warn(`⚠️  Webhook failed after ${webhookResult.attempts} attempts: ${webhookResult.error}`);
                  }
                } catch (webhookError) {
                  console.error('❌ Error sending webhook:', webhookError.message);
                  // Không throw để không ảnh hưởng đến flow chính
                }
              }
            } else if (exists) {
              console.log(`⏭️  Transaction already exists: ${transaction.transactionId}`);
            }
          } catch (error) {
            console.error('❌ Error saving transaction:', error.message);
          }
        },
      });

      monitor.start();
      this.monitors.set(configId, monitor);

      console.log(`✅ Started monitor for email: ${config.email} (User: ${userId})`);
    } catch (error) {
      console.error(`❌ Error starting monitor for config ${config._id}:`, error.message);
    }
  }

  /**
   * Stop monitor cho một config cụ thể
   */
  stopMonitorForConfig(configId) {
    const monitor = this.monitors.get(configId);
    if (monitor) {
      monitor.stop();
      this.monitors.delete(configId);
      console.log(`🛑 Stopped monitor for config: ${configId}`);
    }
  }

  /**
   * Lấy thống kê
   */
  getStats() {
    const stats = {
      isRunning: this.isRunning,
      activeMonitors: this.monitors.size,
      monitors: [],
    };

    for (const [configId, monitor] of this.monitors.entries()) {
      stats.monitors.push({
        configId,
        ...monitor.getStats(),
      });
    }

    return stats;
  }
}

module.exports = MultiUserEmailMonitor;

