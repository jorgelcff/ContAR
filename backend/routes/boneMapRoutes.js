const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { mapBones } = require('../controllers/boneMapController');

// Bone mapping is called once per unknown avatar — 20 req/min is generous
const limiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

router.post('/map', limiter, mapBones);

module.exports = router;
