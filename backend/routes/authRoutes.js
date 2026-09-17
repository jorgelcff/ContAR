const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const router = express.Router();
const { register, login, me, forgotPassword, resetPassword, verifyEmail, resendVerification, updateAccount, changePassword } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

const WINDOW_MS = 15 * 60 * 1000;

// Configurable via env so the E2E backend (which registers a fresh disposable
// user per test — dozens per run) can raise the ceiling without touching the
// production default (see backend/scripts/serve-e2e.js).
const limiter = rateLimit({ windowMs: WINDOW_MS, limit: Number(process.env.AUTH_RATE_LIMIT_MAX) || 100, standardHeaders: true, legacyHeaders: false });

// The sensitive endpoints used to share a single limiter instance, which means
// a single counter: ten requests per IP per fifteen minutes across all four of
// them together. Behind one venue's NAT — a conference room, a classroom — that
// is ten for everybody, and clicking the link in your own inbox spent the same
// budget as asking the server to mail a stranger. Each route gets its own
// counter now, and the ceiling matches what the route can actually be used for.
function perIp(defaultMax, envVar) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: Number(process.env[envVar]) || defaultMax,
    standardHeaders: true,
    legacyHeaders: false,
  });
}

// Sends mail to an address the caller names, so this is the one that genuinely
// needs a tight leash — it is the endpoint that could be pointed at someone
// else's inbox.
const forgotLimiter = perIp(30, 'AUTH_FORGOT_RATE_LIMIT_MAX');

// These spend a token the caller must already hold — 32 random bytes, not
// something to be guessed inside a window. They are throttled against brute
// force, not against volume, so a shared address can work through them.
const tokenLimiter = () => perIp(60, 'AUTH_TOKEN_RATE_LIMIT_MAX');

// Resend runs behind requireAuth, so it can be counted per account rather than
// per address: one person hammering it cannot lock out the rest of the room.
const resendLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: Number(process.env.AUTH_RESEND_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?.userId ? `user:${req.user.userId}` : ipKeyGenerator(req.ip)),
});

router.post('/register',        limiter,       register);
router.post('/login',           limiter,       login);
router.get( '/me',              limiter,       requireAuth, me);
router.post('/forgot-password',       forgotLimiter,  forgotPassword);
router.post('/reset-password',        tokenLimiter(), resetPassword);
router.post('/verify-email',          tokenLimiter(), verifyEmail);
// requireAuth first, so the limiter above can see who is asking.
router.post('/resend-verification',   requireAuth, resendLimiter, resendVerification);
router.put( '/account',               limiter,       requireAuth, updateAccount);
router.put( '/change-password',       limiter,       requireAuth, changePassword);

module.exports = router;
