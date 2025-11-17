const nodemailer = require('nodemailer');
const { parseCakeEmail } = require('../parsers/cake');

let cachedTransporter = null;

function ensureEnvVar(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = ensureEnvVar('TEST_EMAIL_SMTP_HOST');
  const port = parseInt(process.env.TEST_EMAIL_SMTP_PORT || '587', 10);
  const secure = process.env.TEST_EMAIL_SMTP_SECURE === 'true' || port === 465;
  const user = ensureEnvVar('TEST_EMAIL_SMTP_USER');
  const pass = ensureEnvVar('TEST_EMAIL_SMTP_PASS');

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return cachedTransporter;
}

function formatVnd(amount) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount));
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function randomNumeric(length) {
  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += Math.floor(Math.random() * 10);
  }
  return value;
}

function buildCakeSampleData(overrides = {}) {
  const now = overrides.executedAt ? new Date(overrides.executedAt) : new Date();
  const amount = typeof overrides.amountVND === 'number'
    ? overrides.amountVND
    : (Math.floor(Math.random() * 4_000_000) + 200_000);

  const signedAmount = amount >= 0 ? amount : -Math.abs(amount);
  const formattedAmount = `${signedAmount >= 0 ? '+' : '-'}${formatVnd(Math.abs(signedAmount))}`;

  return {
    recipientName: overrides.recipientName || 'Phan Võ Thành Tài',
    receiverAccount: overrides.receivedAccount || '03586827700 - Tài khoản thanh toán',
    senderAccount: overrides.senderAccount || `0${randomNumeric(9)}`,
    senderName: overrides.senderName || 'MOMOIBFT',
    senderBank: overrides.senderBank || 'VPB',
    transactionType: overrides.transactionType || 'Chuyển tiền ngoài CAKE',
    transactionId: overrides.transactionId || randomNumeric(12),
    executedAt: formatDateTime(now),
    amountText: overrides.amountText || formattedAmount,
    feeText: overrides.feeText || '0 ₫',
    description: overrides.description || 'KHÁCH HÀNG DEMO chuyển tiền qua Payhook',
    supportPhone: overrides.supportPhone || '1900 638686',
    supportEmail: overrides.supportEmail || 'chat@cake.vn',
    subject: overrides.subject || '[CAKE] Thông báo giao dịch thành công',
    heroTitle: overrides.heroTitle || 'Tiết kiệm online lãi cao ngất ngưởng',
    heroSubtitle: overrides.heroSubtitle || 'Lãi tiết kiệm ngay',
  };
}

function buildCakeHtmlBody(data) {
  return `
  <!doctype html>
  <html lang="vi">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${data.subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden;">
        <tr>
          <td style="background: linear-gradient(135deg, #ff4da5, #ff8c37); padding: 24px; color: #fff;">
            <h1 style="margin: 0; font-size: 24px;">Ngân hàng số CAKE by VPBank</h1>
            <p style="margin: 8px 0 0; font-size: 16px;">${data.heroTitle}</p>
            <p style="margin: 4px 0 0; font-size: 14px;">${data.heroSubtitle}</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px;">
            <p>Chào ${data.recipientName},</p>
            <p>Cake xin thông báo tài khoản của bạn vừa mới phát sinh giao dịch như sau:</p>
            <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse: collapse; font-size: 14px;">
              <tr>
                <td colspan="2" style="background-color: #f9fafb; font-weight: bold;">Thông tin tài khoản</td>
              </tr>
              <tr>
                <td style="width: 40%; color: #6b7280;">Tài khoản nhận</td>
                <td>${data.receiverAccount}</td>
              </tr>
              <tr>
                <td style="color: #6b7280;">Tài khoản chuyển</td>
                <td>${data.senderAccount}</td>
              </tr>
              <tr>
                <td style="color: #6b7280;">Tên người chuyển</td>
                <td>${data.senderName}</td>
              </tr>
              <tr>
                <td style="color: #6b7280;">Ngân hàng chuyển</td>
                <td>${data.senderBank}</td>
              </tr>
              <tr>
                <td colspan="2" style="background-color: #f9fafb; font-weight: bold;">Thông tin giao dịch</td>
              </tr>
              <tr>
                <td style="color: #6b7280;">Loại giao dịch</td>
                <td>${data.transactionType}</td>
              </tr>
              <tr>
                <td style="color: #6b7280;">Mã giao dịch</td>
                <td>${data.transactionId}</td>
              </tr>
              <tr>
                <td style="color: #6b7280;">Ngày giờ giao dịch</td>
                <td>${data.executedAt}</td>
              </tr>
              <tr>
                <td style="color: #6b7280;">Số tiền</td>
                <td style="color: ${data.amountText.startsWith('+') ? '#16a34a' : '#dc2626'}; font-weight: bold; font-size: 16px;">
                  ${data.amountText} ₫
                </td>
              </tr>
              <tr>
                <td style="color: #6b7280;">Phí giao dịch</td>
                <td>${data.feeText}</td>
              </tr>
              <tr>
                <td style="color: #6b7280;">Nội dung giao dịch</td>
                <td>${data.description}</td>
              </tr>
            </table>
            <p style="margin-top: 24px;">Cảm ơn bạn đã sử dụng dịch vụ của Cake by VPBank.</p>
            <p>Thân mến,<br />Cake Team</p>
            <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
            <p style="font-size: 12px; color: #6b7280;">
              Cần hỗ trợ? Gọi ${data.supportPhone} hoặc email ${data.supportEmail}<br />
              Đây là email tự động, vui lòng không trả lời.
            </p>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

function buildCakeTextBody(data) {
  return `
[CAKE] Thông báo giao dịch thành công

Tài khoản nhận: ${data.receiverAccount}
Tài khoản chuyển: ${data.senderAccount}
Tên người chuyển: ${data.senderName}
Ngân hàng chuyển: ${data.senderBank}

Loại giao dịch: ${data.transactionType}
Mã giao dịch: ${data.transactionId}
Ngày giờ giao dịch: ${data.executedAt}
Số tiền: ${data.amountText} ₫
Phí giao dịch: ${data.feeText}
Nội dung giao dịch: ${data.description}

Cake Team
`.trim();
}

function buildCakeTestEmail(overrides = {}) {
  const data = buildCakeSampleData(overrides);
  const html = buildCakeHtmlBody(data);
  const text = buildCakeTextBody(data);
  const parsedTransaction = parseCakeEmail({
    subject: data.subject,
    from: 'no-reply@cake.vn',
    text,
    html,
  });

  return {
    subject: data.subject,
    from: 'Ngân hàng số Cake by VPBank <no-reply@cake.vn>',
    html,
    text,
    sampleData: data,
    parsedTransaction,
  };
}

async function sendCakeTestEmail({ to, overrides = {}, headers = {} }) {
  if (!to) {
    throw new Error('Destination email is required to send test email');
  }

  const transporter = getTransporter();
  const email = buildCakeTestEmail(overrides);

  const info = await transporter.sendMail({
    from: process.env.TEST_EMAIL_FROM || email.from,
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    headers: {
      'X-Payhook-Test-Email': 'cake-demo',
      ...headers,
    },
  });

  return {
    messageId: info.messageId,
    envelope: info.envelope,
    sample: {
      preview: email.sampleData,
      parsedTransaction: email.parsedTransaction,
    },
  };
}

module.exports = {
  sendCakeTestEmail,
  buildCakeTestEmail,
};


