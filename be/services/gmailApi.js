const { google } = require('googleapis');
const { getOAuth2Client } = require('./gmailOAuth');
const { simpleParser } = require('mailparser');
const { parseMailToTransaction } = require('./emailParser');

/**
 * Lấy Gmail API client cho user
 * @param {string} refreshToken - Refresh token của user
 * @returns {Promise<gmail_v1.Gmail>}
 */
async function getGmailClient(refreshToken) {
  const auth = getOAuth2Client(refreshToken);
  return google.gmail({ version: 'v1', auth });
}

/**
 * Đăng ký push notifications cho Gmail
 * @param {string} refreshToken - Refresh token của user
 * @param {string} topicName - Pub/Sub topic name (ví dụ: projects/PROJECT_ID/topics/gmail-notifications)
 * @returns {Promise<Object>} { historyId, expiration }
 */
async function watchGmail(refreshToken, topicName) {
  try {
    const gmail = await getGmailClient(refreshToken);
    
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: topicName,
        labelIds: ['INBOX'], // Chỉ watch INBOX
      },
    });

    return {
      historyId: response.data.historyId,
      expiration: response.data.expiration,
    };
  } catch (error) {
    console.error('❌ Gmail watch error:', error.message);
    throw error;
  }
}

/**
 * Lấy email mới từ Gmail dựa trên historyId
 * @param {string} refreshToken - Refresh token của user
 * @param {string} startHistoryId - History ID bắt đầu
 * @returns {Promise<Object>} { emails: Array, newHistoryId: string }
 */
async function getNewEmails(refreshToken, startHistoryId) {
  try {
    const gmail = await getGmailClient(refreshToken);
    
    // Lấy history changes
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: startHistoryId,
      historyTypes: ['messageAdded'],
      labelIds: ['INBOX'],
    });

    const history = historyResponse.data.history || [];
    const messageIds = [];
    
    // Lấy tất cả message IDs từ history
    for (const record of history) {
      if (record.messagesAdded) {
        for (const msg of record.messagesAdded) {
          messageIds.push(msg.message.id);
        }
      }
    }
    
    // Lấy historyId mới nhất từ response (nếu có) hoặc dùng startHistoryId
    // Gmail API có thể trả về nextPageToken và historyId trong response
    const newHistoryId = String(historyResponse.data.historyId || startHistoryId);

    if (messageIds.length === 0) {
      return { emails: [], newHistoryId };
    }

    // Lấy chi tiết các messages
    const emails = [];
    for (const messageId of messageIds) {
      try {
        const messageResponse = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'raw', // Lấy raw email để parse
        });

        // Parse raw email
        const rawEmail = Buffer.from(messageResponse.data.raw, 'base64');
        const mail = await simpleParser(rawEmail);

        // Lọc chỉ email từ CAKE
        const from = mail.from?.text || mail.from?.value?.[0]?.address || '';
        const subject = mail.subject || '';
        
        if (from.includes('cake.vn') || subject.includes('[CAKE]')) {
          emails.push({
            id: messageId,
            threadId: messageResponse.data.threadId,
            subject: mail.subject,
            from: from,
            date: mail.date ? new Date(mail.date).toISOString() : null,
            text: mail.text,
            html: mail.html,
            raw: mail,
          });
        }
      } catch (error) {
        console.error(`❌ Error getting message ${messageId}:`, error.message);
      }
    }

    return { emails, newHistoryId };
  } catch (error) {
    console.error('❌ Get new emails error:', error.message);
    throw error;
  }
}

/**
 * Lấy profile của user để lấy email address
 * @param {string} refreshToken - Refresh token của user
 * @returns {Promise<string>} Email address
 */
async function getUserEmail(refreshToken) {
  try {
    const gmail = await getGmailClient(refreshToken);
    const profile = await gmail.users.getProfile({ userId: 'me' });
    return profile.data.emailAddress;
  } catch (error) {
    console.error('❌ Get user email error:', error.message);
    throw error;
  }
}

module.exports = {
  getGmailClient,
  watchGmail,
  getNewEmails,
  getUserEmail,
};

