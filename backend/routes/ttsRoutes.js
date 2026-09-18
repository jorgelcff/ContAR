const express = require('express');
const router = express.Router();
const { generateTTS } = require('../controllers/ttsController');
const { requireAuth } = require('../middleware/authMiddleware');
const { perAccountLimiter } = require('../middleware/rateLimits');

// TTS calls an external paid API, so the ceiling stays tight — but it is now a
// ceiling per account instead of per address. Thirty generations shared by
// everyone behind one venue's NAT meant the first person to explore voices
// spent the budget for the whole room; thirty each costs the same per person
// and locks nobody out. requireAuth runs first so the limiter can see who is
// asking.
router.post('/generate', requireAuth, perAccountLimiter(30, 'TTS_RATE_LIMIT_MAX'), generateTTS);

module.exports = router;
