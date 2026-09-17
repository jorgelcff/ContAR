const express = require('express');
const router = express.Router();
const { saveStory, getStory, listStories, getPublicStory, setStoryPublished, deleteStory } = require('../controllers/storyController');
const { requireAuth, optionalAuth } = require('../middleware/authMiddleware');
const { readLimiter, writeLimiter } = require('../middleware/rateLimits');


router.post('/',           writeLimiter(), requireAuth, saveStory);
router.get('/',            readLimiter(),  requireAuth, listStories);
router.get('/public/:id',  readLimiter(),  optionalAuth, getPublicStory);
router.get('/:id',         readLimiter(),  requireAuth, getStory);
router.put('/:id/publish', writeLimiter(), requireAuth, setStoryPublished);
router.delete('/:id',      writeLimiter(), requireAuth, deleteStory);

module.exports = router;
