const EmailConfig = require('../models/emailConfig');
const { watchGmail } = require('./gmailApi');

const CHECK_INTERVAL_MS = Number(process.env.GMAIL_WATCH_REFRESH_INTERVAL_MS) || 60 * 60 * 1000; // 1h
const RENEW_THRESHOLD_MS = Number(process.env.GMAIL_WATCH_RENEW_THRESHOLD_MS) || 24 * 60 * 60 * 1000; // 24h
const PUBSUB_TOPIC = process.env.GOOGLE_PUBSUB_TOPIC;

class GmailWatchManager {
  constructor() {
    this.intervalId = null;
    if (!PUBSUB_TOPIC) {
      console.warn('⚠️  GOOGLE_PUBSUB_TOPIC is not configured. Auto-renewal will be skipped.');
    }
  }

  start() {
    if (this.intervalId || !PUBSUB_TOPIC) {
      return;
    }
    console.log('⏱️  Starting Gmail watch auto-renew scheduler');
    // Run immediately on start
    this.run('startup').catch((err) => {
      console.error('❌ Gmail watch auto-renew (startup) error:', err.message);
    });
    this.intervalId = setInterval(() => {
      this.run('interval').catch((err) => {
        console.error('❌ Gmail watch auto-renew error:', err.message);
      });
    }, CHECK_INTERVAL_MS);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Stopped Gmail watch auto-renew scheduler');
    }
  }

  async run(reason = 'interval') {
    if (!PUBSUB_TOPIC) {
      return;
    }
    try {
      const configs = await EmailConfig.findActive();
      if (!configs || configs.length === 0) {
        return;
      }

      const now = Date.now();
      for (const config of configs) {
        if (!config.refreshToken) {
          continue;
        }

        const expirationTime = config.watchExpiration
          ? new Date(config.watchExpiration).getTime()
          : 0;

        const needsRenew = !expirationTime || (expirationTime - now) <= RENEW_THRESHOLD_MS;

        if (!needsRenew) {
          continue;
        }

        console.log(`🔄 Auto-renew Gmail watch for ${config.email} (reason: ${reason})`);
        const result = await watchGmail(config.refreshToken, PUBSUB_TOPIC);
        const watchExpiration = result.expiration ? new Date(Number(result.expiration)) : null;

        await EmailConfig.update(config._id.toString(), {
          watchHistoryId: result.historyId ? String(result.historyId) : null,
          watchExpiration,
        });

        console.log(`✅ Watch renewed for ${config.email}. New historyId=${result.historyId}`);
      }
    } catch (error) {
      console.error('❌ Gmail watch auto-renew failed:', error.message);
    }
  }
}

module.exports = new GmailWatchManager();

