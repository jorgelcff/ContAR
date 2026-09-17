const { v4: uuidv4 } = require('uuid');
const Story = require('../models/Story');
const User = require('../models/User');

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
      { _id: 0, storyId: 1, metadata: 1, scenes: 1, isPublic: 1, createdAt: 1, updatedAt: 1 }
    )
      .sort({ updatedAt: -1 })
      .limit(100);

    return res.json({
      stories: stories.map((s) => ({
        storyId:    s.storyId,
        metadata:   s.metadata,
        sceneCount: Array.isArray(s.scenes) ? s.scenes.length : 0,
        isPublic:   Boolean(s.isPublic),
        createdAt:  s.createdAt,
        updatedAt:  s.updatedAt,
      })),
    });
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
      { _id: 0, storyId: 1, metadata: 1, scenes: 1, isPublic: 1, ownerId: 1, createdAt: 1, updatedAt: 1 }
    );
    // Same "not found" response whether the story doesn't exist or is just
    // not published yet — this must not leak which of the two is true.
    //
    // The author is the exception. Publishing decides who *else* can open the
    // link; it should not stand between authors and a look at what they are
    // building. Without this the "View" button on their own story list, and the
    // browser preview in the editor, both dead-ended on 404.
    const isAuthor = Boolean(req.user?.userId) && req.user.userId === story?.ownerId;
    if (!story || (!story.isPublic && !isAuthor)) {
      return res.status(404).json({ error: 'Story not found' });
    }

    const { ownerId: _ownerId, ...publicStory } = story.toObject();
    return res.json(publicStory);
  } catch (err) {
    console.error('getPublicStory error:', err);
    return res.status(500).json({ error: 'Failed to load story' });
  }
}

// PUT /api/story/:id/publish — owner-only visibility toggle. Separate from
// saveStory on purpose: editing content should never silently change whether
// the story is reachable via its public link.
async function setStoryPublished(req, res) {
  try {
    const ownerId = String(req.user?.userId || '');
    if (!ownerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const storyId = safeString(req.params?.id);
    if (!storyId || !UUID_RE.test(storyId)) {
      return res.status(400).json({ error: 'Invalid story ID' });
    }

    const isPublic = Boolean(req.body?.isPublic);

    // Publishing is the one action that puts something of this account's on the
    // open internet under a shareable link, so it is what confirming the
    // address buys. Everything else stays open — someone trying the app should
    // not be blocked behind a message sitting in a spam folder. Unpublishing is
    // always allowed: taking your own content down must never require a working
    // mailbox.
    if (isPublic) {
      const user = await User.findById(ownerId).select('emailVerified').lean();
      if (!user?.emailVerified) {
        return res.status(403).json({
          error: 'Confirm your email address before publishing',
          code: 'EMAIL_NOT_VERIFIED',
        });
      }
    }

    const story = await Story.findOneAndUpdate(
      { storyId, ownerId },
      { isPublic },
      { returnDocument: 'after' }
    );
    if (!story) {
      return res.status(404).json({ error: 'Story not found or not yours' });
    }

    return res.json({ storyId: story.storyId, isPublic: story.isPublic });
  } catch (err) {
    console.error('setStoryPublished error:', err);
    return res.status(500).json({ error: 'Failed to update story visibility' });
  }
}

async function deleteStory(req, res) {
  try {
    const storyId = safeString(req.params?.id);
    const ownerId = String(req.user?.userId || '');
    if (!storyId || !UUID_RE.test(storyId)) return res.status(400).json({ error: 'Invalid story ID' });

    const result = await Story.deleteOne({ storyId, ownerId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Story not found or not yours' });
    return res.json({ deleted: true });
  } catch (err) {
    console.error('deleteStory error:', err);
    return res.status(500).json({ error: 'Failed to delete story' });
  }
}

module.exports = { saveStory, getStory, listStories, getPublicStory, setStoryPublished, deleteStory };
