const express = require('express');

const router = express.Router();

/**
 * @swagger
 * /api/qr/img:
 *   get:
 *     summary: Generate bank transfer QR image (Cake by VPBank supported)
 *     tags: [QR]
 *     parameters:
 *       - in: query
 *         name: acc
 *         schema:
 *           type: string
 *         required: true
 *         description: Số tài khoản ngân hàng
 *       - in: query
 *         name: bank
 *         schema:
 *           type: string
 *           enum: [cake, CAKE]
 *         required: false
 *         description: Ngân hàng (tạm thời chỉ hỗ trợ Cake - mặc định là cake)
 *       - in: query
 *         name: amount
 *         schema:
 *           type: number
 *         required: false
 *         description: Số tiền chuyển khoản
 *       - in: query
 *         name: des
 *         schema:
 *           type: string
 *         required: false
 *         description: Nội dung chuyển khoản
 *     responses:
 *       200:
 *         description: PNG image
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Bad request
 */
router.get('/img', async (req, res) => {
  try {
    const acc = (req.query.acc || '').trim();
    const bank = (req.query.bank || 'cake').toString().toLowerCase();
    const amount = req.query.amount ? Number(req.query.amount) : undefined;
    const des = (req.query.des || '').toString().trim();

    if (!acc) {
      return res.status(400).json({ error: 'Missing required acc' });
    }
    if (bank !== 'cake') {
      return res.status(400).json({ error: 'Unsupported bank. Currently only cake is supported.' });
    }
    if (req.query.amount && (Number.isNaN(amount) || amount < 0)) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    // Map to VietQR bank slug
    const bankSlug = 'cake';
    const baseUrl = `https://img.vietqr.io/image/${bankSlug}-${encodeURIComponent(acc)}-compact.png`;
    const url = new URL(baseUrl);
    if (amount) url.searchParams.set('amount', String(amount));
    if (des) url.searchParams.set('addInfo', des);

    // Fetch and proxy the PNG
    const upstream = await fetch(url.toString());
    if (!upstream.ok) {
      return res.status(502).json({ error: 'Upstream QR service error' });
    }
    const arrayBuf = await upstream.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.end(buf);
  } catch (error) {
    console.error('QR generate error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


