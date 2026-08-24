const jwt = require('jsonwebtoken');
const { getAuthSecret } = require('../config/auth');

function requireAuth(req, res, next) {
  const header = String(req.headers?.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, getAuthSecret());
    req.user = {
      userId: String(payload.userId || ''),
      email: String(payload.email || ''),
    };

    if (!req.user.userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
