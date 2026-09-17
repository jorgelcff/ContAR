const express = require('express');
const router = express.Router();
const { saveScene, listScenes, getScene, deleteScene } = require('../controllers/sceneController');
const { requireAuth } = require('../middleware/authMiddleware');
const { readLimiter, writeLimiter } = require('../middleware/rateLimits');


router.post('/',       writeLimiter(), requireAuth, saveScene);
router.get('/',        readLimiter(),  requireAuth, listScenes);
router.get('/:id',     readLimiter(),  getScene);
router.delete('/:id',  writeLimiter(), requireAuth, deleteScene);

module.exports = router;
