const { v4: uuidv4 } = require('uuid');
const Scene = require('../models/Scene');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeString(val) {
  return typeof val === 'string' ? val : undefined;
}

// POST /api/scene — save or update a scene
async function saveScene(req, res) {
  try {
    const body = req.body || {};
    const rawId = safeString(body.sceneId);
    const id = rawId && UUID_RE.test(rawId) ? rawId : uuidv4();
    const ownerId = req.user?.userId || '';

    const metadata =
      body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? body.metadata : {};
    const content =
      body.content && typeof body.content === 'object' && !Array.isArray(body.content)
        ? body.content : {};

    const scene = await Scene.findOneAndUpdate(
      { sceneId: id },
      { sceneId: id, ownerId, metadata, content, updatedAt: new Date() },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    res.json({ sceneId: scene.sceneId });
  } catch (err) {
    console.error('saveScene error:', err);
    res.status(500).json({ error: 'Failed to save scene' });
  }
}

// GET /api/scene — list scenes owned by the authenticated user
async function listScenes(req, res) {
  try {
    const ownerId = req.user?.userId || '';
    const scenes = await Scene.find({ ownerId })
      .select('sceneId metadata content.avatar.modelUrl content.avatar.posePreset createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50);

    res.json({
      scenes: scenes.map((s) => ({
        sceneId: s.sceneId,
        metadata: s.metadata,
        avatarUrl: s.content?.avatar?.modelUrl || '',
        posePreset: s.content?.avatar?.posePreset || 'idle',
        updatedAt: s.updatedAt,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    console.error('listScenes error:', err);
    res.status(500).json({ error: 'Failed to list scenes' });
  }
}

// GET /api/scene/:id — load a scene by ID (public)
async function getScene(req, res) {
  try {
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

// DELETE /api/scene/:id — delete a scene (owner only)
async function deleteScene(req, res) {
  try {
    const id      = safeString(req.params.id);
    const ownerId = req.user?.userId || '';
    if (!id || !UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid scene ID' });

    const result = await Scene.deleteOne({ sceneId: id, ownerId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Scene not found or not yours' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('deleteScene error:', err);
    res.status(500).json({ error: 'Failed to delete scene' });
  }
}

module.exports = { saveScene, listScenes, getScene, deleteScene };
