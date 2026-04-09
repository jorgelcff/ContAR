const { v4: uuidv4 } = require('uuid');
const Avatar = require('../models/Avatar');

// POST /api/avatar — store an avatar URL
async function saveAvatar(req, res) {
  try {
    const { modelUrl } = req.body;
    if (!modelUrl) return res.status(400).json({ error: 'modelUrl is required' });

    const avatarId = uuidv4();
    const avatar = await Avatar.create({ avatarId, modelUrl });
    res.status(201).json({ avatarId: avatar.avatarId });
  } catch (err) {
    console.error('saveAvatar error:', err);
    res.status(500).json({ error: 'Failed to save avatar' });
  }
}

module.exports = { saveAvatar };
