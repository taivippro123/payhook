// TPBank email parser
// Input: plain text or HTML
// Output: normalized transaction object

function normalizeCurrencyToNumber(value) {
  if (!value) return null;
  // Remove HTML tags first
  const cleanValue = value.toString().replace(/<[^>]*>/g, '').trim();
  const digits = cleanValue
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/[^\d-]/g, '');
  if (!digits) return null;
  return Number(digits);
}

function normalizeText(text) {
  if (!text) return '';
  // Remove HTML tags and collapse whitespace
  const collapsed = text
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return collapsed;
}

// Extract field from HTML table or plain text
function extractField(text, label, nextLabels = []) {
  // Try HTML table first (TPBank uses tables)
  const htmlMatch = extractFromHtmlTable(text, label);
  if (htmlMatch) return htmlMatch;
  
  // Fallback to plain text extraction
  const source = normalizeText(text);
  const labelPattern = label
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s*');
  let nextPattern = '';
  if (nextLabels.length > 0) {
    const nextUnion = nextLabels
      .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'))
      .join('|');
    nextPattern = `(?=\\s*(?:${nextUnion})\\s*:)`;
  } else {
    nextPattern = '$';
  }
  const regex = new RegExp(`${labelPattern}\\s*[:：]\\s*(.*?)\\s*${nextPattern}`, 'i');
  const match = source.match(regex);
  return match ? match[1].trim() : null;
}

// Extract value from HTML table row
function extractFromHtmlTable(html, label) {
  if (!html) return null;
  
  // Pattern: <td>Label</td><td>Value</td> or similar
  const labelEscaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Try multiple patterns
  const patterns = [
    // Pattern 1: <td>Phát sinh</td><td>10,000 VND</td>
    new RegExp(`<td[^>]*>\\s*${labelEscaped}\\s*</td>\\s*<td[^>]*>\\s*([^<]+)\\s*</td>`, 'i'),
    // Pattern 2: <td class="col-left">Phát sinh</td><td class="col-right">10,000 VND</td>
    new RegExp(`<td[^>]*>\\s*${labelEscaped}\\s*</td>\\s*<td[^>]*class="[^"]*col-right[^"]*"[^>]*>\\s*([^<]+)\\s*</td>`, 'i'),
    // Pattern 3: Label: Value in same cell
    new RegExp(`<td[^>]*>\\s*${labelEscaped}\\s*[:：]\\s*([^<]+)\\s*</td>`, 'i'),
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

// Parse TPBank notification email
function parseTpbankEmail({ subject, from, text, html }) {
  // Ưu tiên HTML vì TPBank dùng HTML table
  const content = html || text || '';
  const labels = [
    'Số giao dịch',
    'Số tài khoản',
    'Chủ tài khoản',
    'Phát sinh',
    'Phí',
    'Thuế VAT',
    'Số dư',
    'Số dư khả dụng',
    'Nội dung',
    'Thời điểm thực hiện',
  ];

  const nexts = (label) => labels.filter((l) => l !== label);

  const transactionId = extractField(content, 'Số giao dịch', nexts('Số giao dịch'));
  const accountNumberMasked = extractField(content, 'Số tài khoản', nexts('Số tài khoản'));
  const accountHolder = extractField(content, 'Chủ tài khoản', nexts('Chủ tài khoản'));
  const amountStr = extractField(content, 'Phát sinh', nexts('Phát sinh'));
  const feeStr = extractField(content, 'Phí', nexts('Phí'));
  const vatStr = extractField(content, 'Thuế VAT', nexts('Thuế VAT'));
  const balanceStr = extractField(content, 'Số dư', nexts('Số dư'));
  const availableBalanceStr = extractField(content, 'Số dư khả dụng', nexts('Số dư khả dụng'));
  const description = extractField(content, 'Nội dung', nexts('Nội dung'));
  const executedAt = extractField(content, 'Thời điểm thực hiện', nexts('Thời điểm thực hiện'));

  const parsed = {
    bank: 'TPBank',
    subject,
    from,
    transactionId: transactionId || null,
    accountNumberMasked: accountNumberMasked || null,
    accountHolder: accountHolder || null,
    amountVND: normalizeCurrencyToNumber(amountStr),
    feeVND: normalizeCurrencyToNumber(feeStr),
    vatVND: normalizeCurrencyToNumber(vatStr),
    balanceVND: normalizeCurrencyToNumber(balanceStr),
    availableBalanceVND: normalizeCurrencyToNumber(availableBalanceStr),
    description: description || null,
    executedAt: executedAt || null,
    raw: undefined,
  };

  return parsed;
}

module.exports = {
  parseTpbankEmail,
};


