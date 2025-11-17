const { getDB } = require('../db');
const DeadLetterQueue = require('../models/deadLetterQueue');

const MS_IN_DAY = 24 * 60 * 60 * 1000;

const TRANSACTION_RETENTION_DAYS = parseInt(process.env.TRANSACTION_RETENTION_DAYS || '90', 10);
const WEBHOOK_LOG_RETENTION_DAYS = parseInt(process.env.WEBHOOK_LOG_RETENTION_DAYS || '30', 10);
const DATA_RETENTION_INTERVAL_HOURS = parseInt(process.env.DATA_RETENTION_INTERVAL_HOURS || '6', 10);

let retentionInterval = null;
let lastRunAt = null;

async function purgeCollection(collectionName, cutoffDate, query = {}) {
  const db = await getDB();
  const collection = db.collection(collectionName);
  const deleteQuery = {
    ...query,
    createdAt: { $lt: cutoffDate },
  };

  const result = await collection.deleteMany(deleteQuery);
  console.log(
    `🧹 [DataRetention] Deleted ${result.deletedCount} documents from ${collectionName} older than ${cutoffDate.toISOString()}`
  );
  return result.deletedCount;
}

async function purgeOldTransactions() {
  const cutoff = new Date(Date.now() - TRANSACTION_RETENTION_DAYS * MS_IN_DAY);
  return purgeCollection('transactions', cutoff);
}

async function purgeOldWebhookLogs() {
  const cutoff = new Date(Date.now() - WEBHOOK_LOG_RETENTION_DAYS * MS_IN_DAY);
  return purgeCollection('webhook_logs', cutoff);
}

async function purgeOldDeadLetterEntries() {
  // Keep logic inside model (only resolved/failed entries)
  const deleted = await DeadLetterQueue.deleteOldEntries(WEBHOOK_LOG_RETENTION_DAYS);
  if (deleted > 0) {
    console.log(`🧹 [DataRetention] Deleted ${deleted} stale DLQ entries`);
  }
  return deleted;
}

async function runDataRetentionJob(trigger = 'interval') {
  console.log(`\n🧾 [DataRetention] Running cleanup job (trigger: ${trigger})`);
  try {
    await Promise.allSettled([purgeOldTransactions(), purgeOldWebhookLogs(), purgeOldDeadLetterEntries()]);
    lastRunAt = new Date();
    console.log('✅ [DataRetention] Cleanup finished');
  } catch (error) {
    console.error('❌ [DataRetention] Cleanup failed:', error.message);
  }
}

function startDataRetentionJob() {
  if (retentionInterval) {
    return;
  }

  const intervalMs = Math.max(DATA_RETENTION_INTERVAL_HOURS, 1) * 60 * 60 * 1000;

  runDataRetentionJob('startup');

  retentionInterval = setInterval(() => runDataRetentionJob('interval'), intervalMs);
  console.log(
    `⏱️  [DataRetention] Scheduler started. Interval: ${DATA_RETENTION_INTERVAL_HOURS}h, Transaction retention: ${TRANSACTION_RETENTION_DAYS}d`
  );
}

function stopDataRetentionJob() {
  if (retentionInterval) {
    clearInterval(retentionInterval);
    retentionInterval = null;
    console.log('🛑 [DataRetention] Scheduler stopped');
  }
}

module.exports = {
  startDataRetentionJob,
  stopDataRetentionJob,
  runDataRetentionJob,
  getLastDataRetentionRun: () => lastRunAt,
};


