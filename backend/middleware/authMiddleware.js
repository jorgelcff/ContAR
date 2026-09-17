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

// Reads the token when there is one and moves on when there isn't. For routes
// that are open to everyone but show the owner more than a stranger — the
// public story link, which doubles as the author's own preview. A bad or
// expired token is treated as no token rather than an error: a stale token
// sitting in someone's browser must not break a link that works signed out.
function optionalAuth(req, _res, next) {
  const header = String(req.headers?.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return next();

  try {
    const payload = jwt.verify(token, getAuthSecret());
    const userId = String(payload.userId || '');
    if (userId) req.user = { userId, email: String(payload.email || '') };
  } catch {
    // Anonymous.
  }
  return next();
}

module.exports = { requireAuth, optionalAuth };
