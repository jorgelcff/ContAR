const { v4: uuidv4 } = require('uuid');
const Story = require('../models/Story');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeString(val) {
  return typeof val === 'string' ? val : undefined;
}

function sanitizeStoryScenes(rawScenes) {
  if (!Array.isArray(rawScenes)) return [];

  const scenes = rawScenes
    .map((item, index) => {
      const sceneId = safeString(item?.sceneId);
      if (!sceneId || !UUID_RE.test(sceneId)) return null;

      const order = Number.isFinite(item?.order) ? Number(item.order) : index;
      const durationSeconds = Number.isFinite(item?.durationSeconds)
        ? Math.max(0, Number(item.durationSeconds))
        : 0;

      return {
        sceneId,
        order,
        transitionText: safeString(item?.transitionText) || '',
        durationSeconds,
        markerUrl: safeString(item?.markerUrl) || '',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));

  return scenes;
}

async function saveStory(req, res) {
  try {
    const body = req.body || {};
    const ownerId = String(req.user?.userId || '');
    if (!ownerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const rawId = safeString(body.storyId);
    const storyId = rawId && UUID_RE.test(rawId) ? rawId : uuidv4();

    const metadata =
      body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? {
            title: safeString(body.metadata.title) || 'Untitled Story',
            description: safeString(body.metadata.description) || '',
            language: safeString(body.metadata.language) || 'en',
          }
        : { title: 'Untitled Story', description: '', language: 'en' };

    const scenes = sanitizeStoryScenes(body.scenes);

    const story = await Story.findOneAndUpdate(
      { storyId, ownerId },
      { storyId, ownerId, metadata, scenes },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    return res.json({ storyId: story.storyId, sceneCount: story.scenes.length });
  } catch (err) {
    console.error('saveStory error:', err);
    return res.status(500).json({ error: 'Failed to save story' });
  }
}

async function getStory(req, res) {
  try {
    const ownerId = String(req.user?.userId || '');
    if (!ownerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const storyId = safeString(req.params?.id);
    if (!storyId || !UUID_RE.test(storyId)) {
      return res.status(400).json({ error: 'Invalid story ID' });
    }

    const story = await Story.findOne({ storyId, ownerId });
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    return res.json(story);
  } catch (err) {
    console.error('getStory error:', err);
    return res.status(500).json({ error: 'Failed to load story' });
  }
}

async function listStories(_req, res) {
  try {
    const ownerId = String(_req.user?.userId || '');
    if (!ownerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const stories = await Story.find(
      { ownerId },
      { _id: 0, storyId: 1, metadata: 1, createdAt: 1, updatedAt: 1 }
    )
      .sort({ updatedAt: -1 })
      .limit(100);

    return res.json({ stories });
  } catch (err) {
    console.error('listStories error:', err);
    return res.status(500).json({ error: 'Failed to list stories' });
  }
}

async function getPublicStory(req, res) {
  try {
    const storyId = safeString(req.params?.id);
    if (!storyId || !UUID_RE.test(storyId)) {
      return res.status(400).json({ error: 'Invalid story ID' });
    }

    const story = await Story.findOne(
      { storyId },
      { _id: 0, storyId: 1, metadata: 1, scenes: 1, createdAt: 1, updatedAt: 1 }
    );
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    return res.json(story);
  } catch (err) {
    console.error('getPublicStory error:', err);
    return res.status(500).json({ error: 'Failed to load story' });
  }
}

module.exports = { saveStory, getStory, listStories, getPublicStory };
