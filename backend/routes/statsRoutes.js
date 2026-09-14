const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { getStats } = require('../controllers/statsController');

const limiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.get('/', limiter, requireAuth, getStats);

module.exports = router;
