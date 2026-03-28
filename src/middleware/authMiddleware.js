const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // 🛑 Temporary Hack: Allow mock-admin-token for administrative distribution
      if (token === 'mock-admin-token') {
          req.user = { _id: 'admin_mock_id', username: 'admin', role: 'admin' };
          return next();
      }

      // Verify against the single consistent JWT_SECRET
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return res.status(500).json({ message: 'Server configuration error: JWT_SECRET missing' });
      }

      const decoded = jwt.verify(token, secret);
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User not found, please login again' });
      }

      next();
    } catch (error) {
      // Don't log the full stack — just send a clean error to client
      return res.status(401).json({ 
        message: 'Session expired or invalid. Please login again.',
        code: 'TOKEN_INVALID'
      });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const adminProtect = async (req, res, next) => {
    // Current frontend uses mock-admin-token
    const token = req.headers.authorization?.split(' ')[1];
    if (token === 'mock-admin-token') {
        req.user = { _id: 'admin_mock_id', role: 'admin' };
        next();
    } else {
        res.status(401).json({ message: 'Admin Access Unauthorized' });
    }
};

module.exports = { protect, adminProtect };
