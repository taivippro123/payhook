const express = require('express');
const cors = require('cors');
const http = require('http');
const { URL } = require('url');
const { WebSocketServer } = require('ws');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { connectDB, closeDB, getDB } = require('./db');
const { authenticate, decodeToken } = require('./middleware/auth');
const User = require('./models/user');
const wsHub = require('./services/wsHub');
const gmailWatchManager = require('./services/gmailWatchManager');
const { startDLQProcessor, stopDLQProcessor } = require('./services/dlqProcessor');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - Cần thiết cho fly.io và các reverse proxy
// Fly.io sử dụng proxy, cần trust để express-rate-limit có thể lấy đúng IP
// Trust only first proxy (fix rate limiter warning)
app.set('trust proxy', 1);

// CORS configuration - different policies for different endpoints
app.use((req, res, next) => {
  // Public QR endpoint - allow all origins
  if (req.path.startsWith('/api/qr')) {
    return cors({
      origin: '*', // Allow all origins for QR endpoint
      methods: ['GET', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
    })(req, res, next);
  }
  
  // Public TTS endpoint - allow all origins (used by service worker)
  // Service workers may not send origin header, so allow requests without origin
  if (req.path.startsWith('/api/tts')) {
    return cors({
      origin: function (origin, callback) {
        // Allow requests with no origin (service workers, mobile apps, etc.)
        if (!origin) return callback(null, true);
        // Allow all origins for TTS
        return callback(null, true);
      },
      methods: ['POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
      credentials: false, // No credentials needed for TTS
    })(req, res, next);
  }
  
  // Other endpoints - restricted to allowed frontend URLs
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'https://www.payhook.codes',
    'https://payhook.codes',
    'https://payhook.vercel.app', // Keep old domain for backward compatibility
  ].filter(Boolean); // Remove undefined values
  
  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })(req, res, next);
});

app.use(express.json());

// Kết nối database khi server khởi động
connectDB().catch((error) => {
  console.error('Failed to connect to database:', error);
  process.exit(1);
});

// Routes
const authRoutes = require('./routes/auth');
const emailConfigRoutes = require('./routes/emailConfigs');
const transactionRoutes = require('./routes/transactions');
const userRoutes = require('./routes/users');
const qrRoutes = require('./routes/qr');
const webhookLogRoutes = require('./routes/webhookLogs');
const gmailOAuthRoutes = require('./routes/gmailOAuth');
const gmailWebhookRoutes = require('./routes/gmailWebhook');
const pushNotificationRoutes = require('./routes/pushNotifications');
const ttsRoutes = require('./routes/tts');
const { apiLimiter, authLimiter, ttsLimiter } = require('./middleware/rateLimiter');

// Apply rate limiting
// Exclude TTS from general API limiter (will use its own limiter)
app.use('/api/', (req, res, next) => {
  // Skip rate limiting for TTS endpoint (will use its own limiter)
  if (req.path.startsWith('/api/tts')) {
    return next();
  }
  return apiLimiter(req, res, next);
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
// Logging middleware for TTS (for debugging)
app.use('/api/tts', (req, res, next) => {
  console.log('[TTS Middleware] Request received:', {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl,
    origin: req.headers.origin,
    ip: req.ip,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    }
  });
  next();
});

app.use('/api/tts', ttsLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/email-configs', emailConfigRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/webhook-logs', webhookLogRoutes);
app.use('/api/auth', gmailOAuthRoutes); // OAuth routes
app.use('/api/gmail', gmailWebhookRoutes); // Pub/Sub webhook
app.use('/api/push', pushNotificationRoutes); // Push notifications
app.use('/api/tts', ttsRoutes); // Text-to-speech

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Payhook API Documentation',
}));

app.get('/', (req, res) => {
  res.json({
    message: 'Payhook API',
    version: '2.0.0',
    endpoints: {
      auth: '/api/auth',
      emailConfigs: '/api/email-configs',
      transactions: '/api/transactions',
    },
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Database connection status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: number
 *                   example: 1
 */
app.get('/health', async (req, res) => {
  try {
    const db = await getDB();
    const stats = await db.command({ ping: 1 });
    res.json({ ok: stats.ok });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', async (ws, req) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    if (!token) {
      ws.close(4401, 'Token required');
      return;
    }

    let decoded;
    try {
      decoded = decodeToken(token);
    } catch (error) {
      ws.close(4401, 'Invalid token');
      return;
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      ws.close(4403, 'User not found');
      return;
    }

    wsHub.registerClient(ws, {
      userId: decoded.userId,
      username: decoded.username || user.username,
      role: decoded.role || user.role || 'user',
    });
  } catch (error) {
    console.error('WS connection error:', error.message);
    try {
      ws.close(1011, 'Internal server error');
    } catch (closeError) {
      // ignore
    }
  }
});

server.listen(PORT, async () => {
  console.log(`\n🚀 Server running on port ${PORT}`);

  gmailWatchManager.start();
  
  // Khởi động Dead Letter Queue processor
  startDLQProcessor();

  console.log(`\n📋 Available endpoints:`);
  console.log(`   GET  / - API info`);
  console.log(`   GET  /health - Database health check`);
  console.log(`   POST /api/auth/register - Register new user`);
  console.log(`   POST /api/auth/login - Login`);
  console.log(`   GET  /api/email-configs - Get user's email configs (auth required)`);
  console.log(`   PUT  /api/email-configs/:id - Update webhook/isActive (auth required)`);
  console.log(`   POST /api/email-configs/:id/renew-watch - Renew Gmail push (auth required)`);
  console.log(`   GET  /api/auth/google - Generate Google OAuth URL (auth required)`);
  console.log(`   POST /api/gmail/webhook - Gmail push webhook endpoint`);
  console.log(`   GET  /api/transactions - Get user's transactions (auth required)`);
  console.log(`   GET  /api/users - Get all users (admin only)`);
  console.log(`   GET  /api/users/me - Get current user profile`);
  console.log(`   PUT  /api/users/me - Update current user profile`);
  console.log(`   GET  /api/users/:id - Get user by ID`);
  console.log(`   PUT  /api/users/:id - Update user by ID`);
  console.log(`   DELETE /api/users/:id - Delete user (admin only)`);
  console.log(`   PUT  /api/users/:id/role - Update user role (admin only)`);
  console.log(`   GET  /api-docs - Swagger API documentation\n`);
});

// Đóng kết nối database và dừng email monitor khi server tắt
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  gmailWatchManager.stop();
  stopDLQProcessor();
  await closeDB();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down server...');
  gmailWatchManager.stop();
  stopDLQProcessor();
  await closeDB();
  server.close(() => process.exit(0));
});
