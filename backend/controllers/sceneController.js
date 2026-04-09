const { v4: uuidv4 } = require('uuid');
const Scene = require('../models/Scene');

// POST /api/scene — save or update a scene
async function saveScene(req, res) {
  try {
    const { sceneId, metadata, content } = req.body;
    const id = sceneId || uuidv4();

    const scene = await Scene.findOneAndUpdate(
      { sceneId: id },
      { sceneId: id, metadata, content },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ sceneId: scene.sceneId });
  } catch (err) {
    console.error('saveScene error:', err);
    res.status(500).json({ error: 'Failed to save scene' });
  }
}

// GET /api/scene/:id — load a scene by ID
async function getScene(req, res) {
  try {
    const scene = await Scene.findOne({ sceneId: req.params.id });
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    res.json(scene);
  } catch (err) {
    console.error('getScene error:', err);
    res.status(500).json({ error: 'Failed to load scene' });
  }
}

module.exports = { saveScene, getScene };
