const fs = require('fs');
const path = require('path');
const { simpleParser } = require('mailparser');
const { parseTpbankEmail } = require('../parsers/tpbank');

function detectBank({ subject, from }) {
  const subj = (subject || '').toLowerCase();
  const sender = (from && from.text ? from.text : from || '').toLowerCase();
  if (subj.includes('tpbank') || sender.includes('tpb.com.vn') || sender.includes('tpbank')) {
    return 'TPBank';
  }
  return 'UNKNOWN';
}

/**
 * Parse email object thành transaction data
 * @param {Object} mail - Mail object từ mailparser
 * @returns {Object} Parsed transaction data
 */
function parseMailToTransaction(mail) {
  const fromText = mail.from?.text || mail.from?.value?.[0]?.address || mail.from || '';
  const bank = detectBank({ subject: mail.subject, from: fromText });

  let parsed;
  if (bank === 'TPBank') {
    parsed = parseTpbankEmail({
      subject: mail.subject,
      from: fromText,
      text: mail.text,
      html: mail.html,
    });
  } else {
    parsed = {
      bank,
      subject: mail.subject,
      from: fromText,
      unsupported: true,
    };
  }

  // attach raw reference but avoid logging entire email content
  parsed.raw = {
    subject: mail.subject,
    from: fromText,
    date: mail.date ? new Date(mail.date).toISOString() : null,
  };

  return parsed;
}

/**
 * Parse từ file .eml
 * @param {string} emlFilePath - Đường dẫn file .eml
 * @returns {Promise<Object>} Parsed transaction data
 */
async function parseEmlFileToTransaction(emlFilePath) {
  const absolute = path.isAbsolute(emlFilePath)
    ? emlFilePath
    : path.join(process.cwd(), emlFilePath);
  const emlBuffer = fs.readFileSync(absolute);
  const mail = await simpleParser(emlBuffer);
  return parseMailToTransaction(mail);
}

module.exports = {
  parseEmlFileToTransaction,
  parseMailToTransaction,
};


