const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { saveScene, listScenes, getScene } = require('../controllers/sceneController');
const { requireAuth } = require('../middleware/authMiddleware');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/',    limiter, requireAuth, saveScene);
router.get('/',    limiter, requireAuth, listScenes);
router.get('/:id', limiter, getScene);

module.exports = router;
