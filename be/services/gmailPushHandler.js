const { getNewEmails } = require('./gmailApi');
const { parseMailToTransaction } = require('./emailParser');
const EmailConfig = require('../models/emailConfig');
const Transaction = require('../models/transaction');
const { broadcastTransaction } = require('./wsHub');
const { sendWebhook } = require('./webhookSender');
const User = require('../models/user');
const { sendPushNotification } = require('../routes/pushNotifications');

// Helper function để serialize transaction
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
 * Xử lý Gmail push notification từ Pub/Sub
 * @param {Object} pubsubMessage - Pub/Sub message từ Gmail
 * @returns {Promise<void>}
 */
async function handleGmailPush(pubsubMessage) {
  try {
    // Decode Pub/Sub message
    const messageData = JSON.parse(
      Buffer.from(pubsubMessage.message.data, 'base64').toString()
    );

    // Lấy email address từ message
    const emailAddress = messageData.emailAddress;
    if (!emailAddress) {
      console.error('❌ No emailAddress in push notification');
      return;
    }

    console.log(`📬 Gmail push notification received for: ${emailAddress}`);

    // Tìm email config theo email address
    const configs = await EmailConfig.findActive();
    const config = configs.find(c => c.email === emailAddress);
    
    if (!config) {
      console.log(`⏭️  No active config found for: ${emailAddress}`);
      return;
    }

    if (!config.refreshToken) {
      console.error(`❌ No refresh token for config: ${config._id}`);
      return;
    }

    const pushHistoryId = messageData.historyId ? String(messageData.historyId) : null;

    // Luôn ưu tiên dùng watchHistoryId đã lưu (đại diện cho trạng thái cũ hơn)
    let startHistoryId = config.watchHistoryId ? String(config.watchHistoryId) : null;
    if (!startHistoryId) {
      startHistoryId = pushHistoryId;
    }

    if (!startHistoryId) {
      console.error(`❌ No watchHistoryId for config: ${config._id}`);
      return;
    }

    const { emails, newHistoryId } = await getNewEmails(config.refreshToken, startHistoryId);
    
    if (emails.length === 0) {
      console.log(`✅ No new emails for: ${emailAddress}`);
      // Vẫn update historyId để tránh xử lý lại
      if (newHistoryId && newHistoryId !== startHistoryId) {
        await EmailConfig.update(config._id.toString(), {
          watchHistoryId: newHistoryId,
        });
      }
      return;
    }

    console.log(`✅ Found ${emails.length} new email(s) for: ${emailAddress}`);

    // Xử lý từng email
    const userId = config.userId.toString();
    const configId = config._id.toString();

    for (const emailData of emails) {
      try {
        // Parse email thành transaction
        const parsed = parseMailToTransaction(emailData.raw);

        // Chỉ xử lý email từ CAKE
        if (parsed.bank !== 'CAKE') {
          console.log(`⏭️  Skipping non-CAKE email: ${parsed.bank}`);
          continue;
        }

        // Bỏ qua nếu số tiền âm
        if (parsed.amountVND !== null && parsed.amountVND < 0) {
          console.log(`⏭️  Skipping negative amount transaction: ${parsed.amountVND} VND`);
          continue;
        }

        // Kiểm tra transaction đã tồn tại chưa
        const exists = await Transaction.exists(
          parsed.transactionId,
          parsed.bank,
          userId
        );

        if (exists) {
          console.log(`⏭️  Transaction already exists: ${parsed.transactionId}`);
          continue;
        }

        // Tạo transaction
        const transaction = {
          ...parsed,
          emailUid: emailData.id,
          emailDate: emailData.date,
          detectedAt: new Date().toISOString(),
        };

        const saved = await Transaction.create(transaction, userId, configId);
        
        console.log(`💾 Saved transaction to DB: ${transaction.transactionId}`);

        // Broadcast qua WebSocket
        const serialized = serializeTransaction(saved);
        if (serialized) {
          broadcastTransaction(serialized, userId);
        }

        // Gửi push notification
        try {
          const amountFormatted = new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
          }).format(saved.amountVND || 0);

          await sendPushNotification(userId, {
            title: 'Giao dịch mới',
            body: `Đã nhận ${amountFormatted}`,
            icon: '/android-chrome-192x192.png',
            sound: 'default',
            tag: 'transaction-notification',
            data: {
              transactionId: saved.transactionId,
              amount: saved.amountVND,
              playSound: true,
              showNotification: true,
            },
          });
        } catch (pushError) {
          console.error('❌ Error sending push notification:', pushError.message);
          // Không throw error, chỉ log để không ảnh hưởng đến flow chính
        }

        // Update resumeFrom và lastSyncedAt
        await EmailConfig.markSynced(configId, emailData.date || new Date());

        // Gửi webhook nếu có
        if (config.webhookUrl) {
          const description = transaction.description || '';
          const payhookOrderMatch = description.match(/PAYHOOK(\d+)/i);
          
          if (payhookOrderMatch) {
            const orderId = payhookOrderMatch[1];
            
            // Lấy user email
            let userEmail = null;
            try {
              const userDoc = await User.findById(userId);
              userEmail = userDoc?.email || null;
            } catch (userErr) {
              console.warn('⚠️  Could not fetch user email:', userErr.message);
            }

            const webhookPayload = {
              event: 'transaction.detected',
              transaction: serialized,
              orderId: orderId,
              timestamp: new Date().toISOString(),
            };

            const meta = {
              userId,
              userEmail,
              emailConfigId: configId,
              emailConfigEmail: config.email,
              transactionDocId: saved._id?.toString(),
              transactionId: saved.transactionId || transaction.transactionId,
              orderId: orderId,
            };

            await sendWebhook(
              config.webhookUrl,
              webhookPayload,
              5,
              meta
            );
          }
        }

      } catch (error) {
        console.error(`❌ Error processing email ${emailData.id}:`, error.message);
      }
    }

    // Update watchHistoryId sau khi xử lý xong tất cả emails
    if (newHistoryId && newHistoryId !== startHistoryId) {
      await EmailConfig.update(config._id.toString(), {
        watchHistoryId: newHistoryId,
      });
      console.log(`✅ Updated watchHistoryId to: ${newHistoryId}`);
    }

  } catch (error) {
    console.error('❌ Error handling Gmail push:', error.message);
    console.error('❌ Error stack:', error.stack);
  }
}

module.exports = {
  handleGmailPush,
};

