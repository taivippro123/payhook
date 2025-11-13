const { sendWebhook } = require('./webhookSender');
const DeadLetterQueue = require('../models/deadLetterQueue');

/**
 * Process dead letter queue entries
 * Chạy định kỳ để retry các webhooks đã fail
 */
async function processDeadLetterQueue() {
  console.log('🔄 Processing dead letter queue...');
  
  try {
    // Lấy các entries cần retry
    const entries = await DeadLetterQueue.getPendingRetries(10);
    
    if (entries.length === 0) {
      console.log('✅ No entries to process in dead letter queue');
      return;
    }
    
    console.log(`📋 Found ${entries.length} entries to retry`);
    
    for (const entry of entries) {
      try {
        // Mark as retrying
        await DeadLetterQueue.updateAfterRetry(entry._id, {
          status: 'retrying',
          retryCount: entry.retryCount + 1,
        });
        
        // Retry gửi webhook
        const result = await sendWebhook(
          entry.webhookUrl,
          entry.payload,
          1, // Chỉ retry 1 lần mỗi lần process
          {
            userId: entry.userId,
            emailConfigId: entry.emailConfigId,
            transactionDocId: entry.transactionDocId,
            transactionId: entry.transactionId,
          }
        );
        
        if (result.success) {
          // Thành công, mark as resolved
          await DeadLetterQueue.markResolved(entry._id);
          console.log(`✅ Resolved DLQ entry ${entry._id}`);
        } else {
          // Vẫn fail, check xem có vượt quá max retries không
          const updatedEntry = await DeadLetterQueue.updateAfterRetry(entry._id, {
            status: entry.retryCount + 1 >= 3 ? 'failed' : 'pending',
            retryCount: entry.retryCount + 1,
            error: result.error,
          });
          
          if (updatedEntry.status === 'failed') {
            console.log(`❌ DLQ entry ${entry._id} marked as failed after max retries`);
          } else {
            console.log(`⏳ DLQ entry ${entry._id} will retry later`);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing DLQ entry ${entry._id}:`, error.message);
        
        // Update entry với error mới
        await DeadLetterQueue.updateAfterRetry(entry._id, {
          status: entry.retryCount + 1 >= 3 ? 'failed' : 'pending',
          retryCount: entry.retryCount + 1,
          error: error.message,
        });
      }
    }
    
    // Cleanup old entries (resolved/failed > 30 days)
    try {
      const deletedCount = await DeadLetterQueue.deleteOldEntries(30);
      if (deletedCount > 0) {
        console.log(`🗑️  Deleted ${deletedCount} old DLQ entries`);
      }
    } catch (cleanupError) {
      console.error('❌ Error cleaning up old DLQ entries:', cleanupError.message);
    }
  } catch (error) {
    console.error('❌ Error processing dead letter queue:', error.message);
  }
}

// Chạy mỗi 30 phút
let dlqInterval = null;

function startDLQProcessor() {
  if (dlqInterval) {
    clearInterval(dlqInterval);
  }
  
  // Chạy ngay lập tức
  processDeadLetterQueue();
  
  // Sau đó chạy mỗi 30 phút
  dlqInterval = setInterval(() => {
    processDeadLetterQueue();
  }, 30 * 60 * 1000);
  
  console.log('✅ Dead letter queue processor started (runs every 30 minutes)');
}

function stopDLQProcessor() {
  if (dlqInterval) {
    clearInterval(dlqInterval);
    dlqInterval = null;
  }
  console.log('⏹️  Dead letter queue processor stopped');
}

module.exports = {
  processDeadLetterQueue,
  startDLQProcessor,
  stopDLQProcessor,
};

