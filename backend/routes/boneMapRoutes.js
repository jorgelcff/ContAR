const express = require('express');
const router = express.Router();
const { mapBones } = require('../controllers/boneMapController');
const { requireAuth } = require('../middleware/authMiddleware');
const { perAccountLimiter } = require('../middleware/rateLimits');

// This endpoint asks OpenAI to name a rig's bones, and it used to be open to
// anyone on the internet — no account needed, just a POST. A rate limit is not
// a substitute for a door: it capped how fast the deployment's API credit could
// be spent, not who could spend it. The editor that calls this is behind a
// login anyway, so requiring one costs nothing and closes it.
router.post('/map', requireAuth, perAccountLimiter(20, 'BONEMAP_RATE_LIMIT_MAX', 60 * 1000), mapBones);

module.exports = router;
