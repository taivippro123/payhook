const express = require('express');
const router = express.Router();
const axios = require('axios');

// Helper function để chuyển số thành chữ tiếng Việt
const numberToVietnameseWords = (num) => {
  const ones = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const tens = ["", "mười", "hai mươi", "ba mươi", "bốn mươi", "năm mươi", "sáu mươi", "bảy mươi", "tám mươi", "chín mươi"];

  if (num === 0) return "không";

  const toWordsBelowThousand = (n) => {
    let result = "";

    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    const ten = Math.floor(remainder / 10);
    const unit = remainder % 10;

    if (hundred > 0) {
      result += ones[hundred] + " trăm ";
      if (remainder > 0 && ten === 0) result += "lẻ ";
    }

    if (ten > 1) {
      result += tens[ten] + (unit ? " " + ones[unit] : "");
    } else if (ten === 1) {
      result += "mười" + (unit ? " " + ones[unit] : "");
    } else if (ten === 0 && unit > 0) {
      result += ones[unit];
    }

    return result.trim();
  };

  let result = "";
  const million = Math.floor(num / 1_000_000);
  const thousand = Math.floor((num % 1_000_000) / 1_000);
  const belowThousand = num % 1_000;

  if (million > 0) {
    result += toWordsBelowThousand(million) + " triệu ";
  }

  if (thousand > 0) {
    result += toWordsBelowThousand(thousand) + " nghìn ";
  } else if (million > 0 && (belowThousand > 0 || thousand === 0)) {
    result += "không nghìn ";
  }

  if (belowThousand > 0) {
    result += toWordsBelowThousand(belowThousand);
  }

  return result.trim();
};

/**
 * @swagger
 * /api/tts/payment-success:
 *   post:
 *     summary: Generate text-to-speech audio for payment success notification
 *     tags: [TTS]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Payment amount in VND
 *     responses:
 *       200:
 *         description: Audio content generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 audioContent:
 *                   type: string
 *                   description: Base64 encoded MP3 audio
 *                 message:
 *                   type: string
 *                   description: The text that was converted to speech
 *       400:
 *         description: Missing amount parameter
 *       500:
 *         description: Error generating TTS
 */
// Handle OPTIONS preflight requests
router.options('/payment-success', (req, res) => {
  console.log('[TTS] OPTIONS preflight request received');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

router.post('/payment-success', async (req, res) => {
  try {
    console.log('[TTS] ✅ Received POST request:', {
      method: req.method,
      path: req.path,
      url: req.url,
      origin: req.headers.origin,
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent']
      }
    });

    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Thiếu số tiền" });
    }

    // Kiểm tra API key
    if (!process.env.GOOGLE_API_KEY) {
      console.error("Missing GOOGLE_API_KEY in environment variables");
      return res.status(500).json({ 
        error: "Chưa cấu hình Google API key" 
      });
    }

    // 1. Làm sạch số tiền
    const cleanAmount = parseInt(Number(amount));
    
    // 2. Chuyển số thành chữ
    const amountInWords = numberToVietnameseWords(cleanAmount);
    
    // 3. Tạo câu hoàn chỉnh - sử dụng "Đã nhận" thay vì "Thanh toán thành công" để phù hợp với payhook
    const message = `Đã nhận ${amountInWords} đồng`;

    try {
      // 4. Gọi Google TTS API với timeout
      const response = await axios.post(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_API_KEY}`,
        {
          input: { text: message },
          voice: { languageCode: "vi-VN", ssmlGender: "FEMALE" },
          audioConfig: { audioEncoding: "MP3" },
        },
        {
          timeout: 10000, // 10 second timeout
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': process.env.GOOGLE_API_KEY
          }
        }
      );

      // 5. Trả về audio content
      return res.json({ 
        audioContent: response.data.audioContent,
        message: message 
      });

    } catch (apiError) {
      console.error("Google TTS API Error:", {
        status: apiError.response?.status,
        data: apiError.response?.data,
        message: apiError.message
      });

      // Trả về lỗi cụ thể cho client
      if (apiError.response?.status === 403) {
        return res.status(500).json({
          error: "Lỗi xác thực với Google TTS API. Vui lòng kiểm tra cấu hình API key.",
          details: apiError.response.data
        });
      }

      throw apiError; // Ném lỗi để catch block bên ngoài xử lý
    }

  } catch (error) {
    console.error("TTS Processing Error:", error);
    res.status(500).json({ 
      error: "Lỗi khi xử lý text-to-speech",
      details: error.message 
    });
  }
});

/**
 * @swagger
 * /api/tts/test:
 *   post:
 *     summary: Test TTS with custom text
 *     tags: [TTS]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *                 description: Text to convert to speech
 *     responses:
 *       200:
 *         description: Audio content generated successfully
 */
router.options('/test', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

router.post('/test', async (req, res) => {
  try {
    console.log('[TTS] ✅ Received test request:', {
      method: req.method,
      path: req.path,
      url: req.url,
      origin: req.headers.origin,
      body: req.body
    });

    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Thiếu text" });
    }

    // Kiểm tra API key
    if (!process.env.GOOGLE_API_KEY) {
      console.error("Missing GOOGLE_API_KEY in environment variables");
      return res.status(500).json({ 
        error: "Chưa cấu hình Google API key" 
      });
    }

    try {
      // Gọi Google TTS API với timeout
      const response = await axios.post(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_API_KEY}`,
        {
          input: { text: text },
          voice: { languageCode: "vi-VN", ssmlGender: "FEMALE" },
          audioConfig: { audioEncoding: "MP3" },
        },
        {
          timeout: 10000, // 10 second timeout
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': process.env.GOOGLE_API_KEY
          }
        }
      );

      // Trả về audio content
      return res.json({ 
        audioContent: response.data.audioContent,
        message: text 
      });

    } catch (apiError) {
      console.error("Google TTS API Error:", {
        status: apiError.response?.status,
        data: apiError.response?.data,
        message: apiError.message
      });

      // Trả về lỗi cụ thể cho client
      if (apiError.response?.status === 403) {
        return res.status(500).json({
          error: "Lỗi xác thực với Google TTS API. Vui lòng kiểm tra cấu hình API key.",
          details: apiError.response.data
        });
      }

      throw apiError;
    }

  } catch (error) {
    console.error("TTS Processing Error:", error);
    res.status(500).json({ 
      error: "Lỗi khi xử lý text-to-speech",
      details: error.message 
    });
  }
});

module.exports = router;

