const rateLimit = require('express-rate-limit');

// Rate limiter cho API endpoints chung
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // Tối đa 100 requests per window
  message: 'Quá nhiều requests từ IP này, vui lòng thử lại sau 15 phút.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  trustProxy: 1, // Trust first proxy (fix warning)
});

// Rate limiter cho TTS endpoint (more lenient, used by service workers)
const ttsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 phút
  max: 30, // Tối đa 30 requests per minute (cho phép nhiều hơn vì service worker)
  message: 'Quá nhiều TTS requests, vui lòng thử lại sau.',
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: 1, // Trust first proxy (fix warning)
});

// Rate limiter cho authentication endpoints (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // Chỉ 5 lần đăng nhập/đăng ký mỗi 15 phút
  message: 'Quá nhiều lần thử đăng nhập, vui lòng thử lại sau 15 phút.',
  skipSuccessfulRequests: true, // Không đếm requests thành công
});

// Rate limiter cho webhook sending (per user)
// Sử dụng trong code, không phải middleware
const webhookRateLimit = {
  // Lưu số lượng webhooks đã gửi trong 1 giờ cho mỗi user
  userWebhookCounts: new Map(),
  
  // Kiểm tra xem user có vượt quá limit không
  checkLimit(userId, maxPerHour = 1000) {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    
    const userKey = userId.toString();
    const counts = this.userWebhookCounts.get(userKey) || [];
    
    // Lọc bỏ các counts cũ hơn 1 giờ
    const recentCounts = counts.filter(timestamp => timestamp > hourAgo);
    
    if (recentCounts.length >= maxPerHour) {
      return { allowed: false, remaining: 0 };
    }
    
    // Thêm count mới
    recentCounts.push(now);
    this.userWebhookCounts.set(userKey, recentCounts);
    
    return { allowed: true, remaining: maxPerHour - recentCounts.length };
  },
  
  // Cleanup old entries (gọi định kỳ)
  cleanup() {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    
    for (const [userKey, counts] of this.userWebhookCounts.entries()) {
      const recentCounts = counts.filter(timestamp => timestamp > hourAgo);
      if (recentCounts.length === 0) {
        this.userWebhookCounts.delete(userKey);
      } else {
        this.userWebhookCounts.set(userKey, recentCounts);
      }
    }
  },
};

// Cleanup mỗi 30 phút
setInterval(() => {
  webhookRateLimit.cleanup();
}, 30 * 60 * 1000);

module.exports = {
  apiLimiter,
  authLimiter,
  ttsLimiter,
  webhookRateLimit,
};

