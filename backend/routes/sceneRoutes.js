const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { saveScene, getScene } = require('../controllers/sceneController');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', limiter, saveScene);
router.get('/:id', limiter, getScene);

module.exports = router;
