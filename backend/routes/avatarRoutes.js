const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { saveAvatar } = require('../controllers/avatarController');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', limiter, saveAvatar);

module.exports = router;
