const express = require('express');
const User = require('../models/user');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - email
 *             properties:
 *               username:
 *                 type: string
 *                 example: "user1"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: "password123"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user1@example.com"
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Username already exists
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({
        error: 'Missing required fields: username, password, email',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters',
      });
    }

    const user = await User.create({ username, password, email });
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    if (error.message === 'Username already exists') {
      return res.status(409).json({ error: error.message });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "user1"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res) => {
  try {
    // Check if body is parsed correctly
    if (!req.body || typeof req.body !== 'object') {
      console.error('❌ Invalid request body:', {
        body: req.body,
        contentType: req.headers['content-type'],
        rawBody: req.rawBody,
      });
      return res.status(400).json({
        error: 'Invalid request body. Expected JSON with username and password.',
      });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Missing required fields: username, password',
      });
    }

    const user = await User.findByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await User.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
      },
      token,
    });
  } catch (error) {
    console.error('❌ Login error:', {
      message: error.message,
      stack: error.stack,
      body: req.body,
    });
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
});

module.exports = router;

