const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { generateTTS } = require('../controllers/ttsController');
const { requireAuth } = require('../middleware/authMiddleware');

// TTS calls hit an external paid API — tighter window than general routes.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/generate', limiter, requireAuth, generateTTS);

module.exports = router;
