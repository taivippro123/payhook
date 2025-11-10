const jwt = require('jsonwebtoken');
const User = require('../models/user');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Middleware xác thực JWT token
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No token provided:', req.path);
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Kiểm tra user còn tồn tại
      const user = await User.findById(decoded.userId);
      if (!user) {
        console.log('❌ User not found:', decoded.userId);
        return res.status(401).json({ error: 'User not found' });
      }

      req.user = {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role || 'user',
      };
      
      next();
    } catch (error) {
      console.log('❌ Token verification failed:', error.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Tạo JWT token
 * @param {Object} user - { _id, username, role }
 * @returns {string} JWT token
 */
function generateToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      username: user.username,
      role: user.role || 'user',
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Middleware kiểm tra quyền admin
 */
function isAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

module.exports = {
  authenticate,
  generateToken,
  isAdmin,
};

