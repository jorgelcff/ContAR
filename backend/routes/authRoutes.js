const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { register, login, me, forgotPassword, resetPassword, verifyEmail, resendVerification, updateAccount, changePassword } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

// Configurable via env so the E2E backend (which registers a fresh disposable
// user per test — dozens per run) can raise the ceiling without touching the
// production default (see backend/scripts/serve-e2e.js).
const limiter       = rateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 100, standardHeaders: true, legacyHeaders: false });
const strictLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10,  standardHeaders: true, legacyHeaders: false });

router.post('/register',        limiter,       register);
router.post('/login',           limiter,       login);
router.get( '/me',              limiter,       requireAuth, me);
router.post('/forgot-password',       strictLimiter, forgotPassword);
router.post('/reset-password',        strictLimiter, resetPassword);
router.post('/verify-email',          strictLimiter, verifyEmail);
router.post('/resend-verification',   strictLimiter, requireAuth, resendVerification);
router.put( '/account',               limiter,       requireAuth, updateAccount);
router.put( '/change-password',       limiter,       requireAuth, changePassword);

module.exports = router;
