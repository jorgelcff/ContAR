const express = require('express');
const router = express.Router();
const { saveStory, getStory, listStories, getPublicStory, setStoryPublished, deleteStory, markStoryFinished } = require('../controllers/storyController');
const { requireAuth, optionalAuth } = require('../middleware/authMiddleware');
const { readLimiter, writeLimiter } = require('../middleware/rateLimits');


router.post('/',           writeLimiter(), requireAuth, saveStory);
router.get('/',            readLimiter(),  requireAuth, listStories);
router.get('/public/:id',  readLimiter(),  optionalAuth, getPublicStory);
// Bookkeeping from the public viewer, so it has to be reachable without a
// session — the audience it measures has no account.
router.post('/:id/finished', writeLimiter(), optionalAuth, markStoryFinished);
router.get('/:id',         readLimiter(),  requireAuth, getStory);
router.put('/:id/publish', writeLimiter(), requireAuth, setStoryPublished);
router.delete('/:id',      writeLimiter(), requireAuth, deleteStory);

module.exports = router;
