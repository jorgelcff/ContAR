const { rateLimit } = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000;

/**
 * Rate limits for the content routes.
 *
 * Each route file used to build one limiter and hand the same instance to every
 * route in it — and one instance is one counter. So /api/scene allowed 100
 * requests per IP per fifteen minutes across listing, reading, saving and
 * deleting *together*. Behind a single NAT — a conference hall, a lab, a school
 * — that is 100 for everybody at once, while the editor autosaves every five
 * idle seconds. Three or four people building scenes in the same room would
 * exhaust it and start seeing saves fail.
 *
 * Calling these returns a NEW limiter each time, so every route counts its own
 * traffic, and both ceilings are env-configurable for a deployment that needs
 * to tighten or loosen them on the day.
 */
function readLimiter() {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: Number(process.env.CONTENT_READ_RATE_LIMIT_MAX) || 600,
    standardHeaders: true,
    legacyHeaders: false,
  });
}

function writeLimiter() {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: Number(process.env.CONTENT_WRITE_RATE_LIMIT_MAX) || 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
}

module.exports = { readLimiter, writeLimiter, WINDOW_MS };
