const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { register, login, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', limiter, register);
router.post('/login', limiter, login);
router.get('/me', limiter, requireAuth, me);

module.exports = router;
