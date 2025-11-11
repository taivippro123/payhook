// Cake by VPBank email parser
// Input: plain text or HTML
// Output: normalized transaction object (only amount parsing; sign kept)

function stripHtml(value) {
  if (!value) return '';
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeCurrencyWithSign(value) {
  if (!value) return null;
  const clean = stripHtml(value.toString());
  const signChar = clean.trim().charAt(0);
  const sign = signChar === '-' ? -1 : 1;
  const digits = clean
    .replace(/[+\-]/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/[^\d]/g, '');
  if (!digits) return null;
  return Number(digits) * sign;
}

function normalizeText(text) {
  if (!text) return '';
  return stripHtml(text);
}

function extractFromHtmlTable(html, label) {
  if (!html) return null;
  const labelEscaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<td[^>]*>\\s*${labelEscaped}\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`, 'i'),
    new RegExp(`<td[^>]*>\\s*${labelEscaped}\\s*[:：]([\\s\\S]*?)</td>`, 'i'),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1]) return stripHtml(m[1]);
  }
  // Fallback: find row containing label, then take first non-empty cell that's not the label
  const rowRegex = new RegExp(`<tr[^>]*>[\\s\\S]*?${labelEscaped}[\\s\\S]*?<\\/tr>`, 'i');
  const rowMatch = html.match(rowRegex);
  if (rowMatch) {
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const normalizedLabel = label.trim().toLowerCase();
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rowMatch[0])) !== null) {
      const text = stripHtml(tdMatch[1]);
      if (!text) continue;
      if (text.trim().toLowerCase() === normalizedLabel) continue;
      return text;
    }
  }
  return null;
}

function extractField(text, label) {
  const htmlVal = extractFromHtmlTable(text, label);
  if (htmlVal) return htmlVal;
  const src = normalizeText(text);
  const labelPattern = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
  const regex = new RegExp(`${labelPattern}\\s*[:：]\\s*(.+?)(?:\\s{2,}|$)`, 'i');
  const m = src.match(regex);
  return m ? m[1].trim() : null;
}

function parseCakeEmail({ subject, from, text, html }) {
  const content = html || text || '';

  const receivedAccount = extractField(content, 'Tài khoản nhận');
  const senderAccount = extractField(content, 'Tài khoản chuyển');
  const senderName = extractField(content, 'Tên người chuyển');
  const senderBank = extractField(content, 'Ngân hàng chuyển');
  const txnType = extractField(content, 'Loại giao dịch');
  const txnId = extractField(content, 'Mã giao dịch');
  const executedAt = extractField(content, 'Ngày giờ giao dịch');
  const amountStr = extractField(content, 'Số tiền');
  const feeStr = extractField(content, 'Phí giao dịch');
  const description = extractField(content, 'Nội dung giao dịch');

  const amountVND = normalizeCurrencyWithSign(amountStr);
  const feeVND = normalizeCurrencyWithSign(feeStr);

  return {
    bank: 'CAKE',
    subject,
    from,
    transactionId: txnId || null,
    accountNumberMasked: receivedAccount || null,
    counterpartyAccount: senderAccount || null,
    counterpartyName: senderName || null,
    counterpartyBank: senderBank || null,
    transactionType: txnType || null,
    amountVND,
    feeVND,
    description: description || null,
    executedAt: executedAt || null,
    raw: undefined,
    isIncome: typeof amountVND === 'number' ? amountVND > 0 : null,
  };
}

module.exports = {
  parseCakeEmail,
};


