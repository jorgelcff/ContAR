const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { saveStory, getStory, listStories, getPublicStory, deleteStory } = require('../controllers/storyController');
const { requireAuth } = require('../middleware/authMiddleware');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/',           limiter, requireAuth, saveStory);
router.get('/',            limiter, requireAuth, listStories);
router.get('/public/:id',  limiter, getPublicStory);
router.get('/:id',         limiter, requireAuth, getStory);
router.delete('/:id',      limiter, requireAuth, deleteStory);

module.exports = router;
