const { v4: uuidv4, validate: uuidValidate } = require('uuid');
const Scene = require('../models/Scene');

// UUID v4 pattern — used to sanitise the sceneId coming from the client
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Safely extract a string value from user input.
 * Returns undefined when the value is not a plain string.
 */
function safeString(val) {
  return typeof val === 'string' ? val : undefined;
}

// POST /api/scene — save or update a scene
async function saveScene(req, res) {
  try {
    const body = req.body || {};

    // Validate the incoming sceneId is a real UUID (prevents NoSQL operator injection)
    const rawId = safeString(body.sceneId);
    const id = rawId && UUID_RE.test(rawId) ? rawId : uuidv4();

    // Only allow plain-object metadata / content (reject arrays, Mongo operators, etc.)
    const metadata =
      body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? body.metadata
        : {};
    const content =
      body.content && typeof body.content === 'object' && !Array.isArray(body.content)
        ? body.content
        : {};

    const scene = await Scene.findOneAndUpdate(
      { sceneId: id },
      { sceneId: id, metadata, content },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
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
    // Reject non-UUID route parameters to prevent NoSQL operator injection
    const id = safeString(req.params.id);
    if (!id || !UUID_RE.test(id)) {
      return res.status(400).json({ error: 'Invalid scene ID' });
    }

    const scene = await Scene.findOne({ sceneId: id });
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    res.json(scene);
  } catch (err) {
    console.error('getScene error:', err);
    res.status(500).json({ error: 'Failed to load scene' });
  }
}

module.exports = { saveScene, getScene };
