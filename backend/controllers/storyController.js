const { v4: uuidv4 } = require('uuid');
const Story = require('../models/Story');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Where a link was handed out, as a short tag the author chooses when they
// print the QR. Bounded on purpose: it becomes a key in a Mixed field, so an
// unbounded one is arbitrary strings written into the document by anyone who
// can construct a URL.
const SOURCE_RE = /^[a-z0-9_-]{1,24}$/;
// Legal by the pattern above and still not safe to use as a key: these land in
// a document that JavaScript later spreads and reads back.
const RESERVED_SOURCES = new Set(['__proto__', 'constructor', 'prototype']);

function safeSource(val) {
  const tag = String(val || '').trim().toLowerCase();
  if (!SOURCE_RE.test(tag) || RESERVED_SOURCES.has(tag)) return 'direct';
  return tag;
}

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
        advanceOn: safeString(item?.advanceOn) === 'time' ? 'time' : 'narration',
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
      { _id: 0, storyId: 1, metadata: 1, scenes: 1, isPublic: 1, views: 1, completions: 1, viewsBySource: 1, createdAt: 1, updatedAt: 1 }
    )
      .sort({ updatedAt: -1 })
      .limit(100);

    return res.json({
      stories: stories.map((s) => ({
        storyId:    s.storyId,
        metadata:   s.metadata,
        sceneCount: Array.isArray(s.scenes) ? s.scenes.length : 0,
        isPublic:   Boolean(s.isPublic),
        views:      Number(s.views) || 0,
        completions: Number(s.completions) || 0,
        viewsBySource: s.viewsBySource || {},
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

    // Count the visit, but only a real one: the author checking their own
    // draft is not an audience, and a story nobody can open has no public
    // reach to measure. Fire-and-forget — a counter must never be the reason
    // a page fails to load.
    if (story.isPublic && !isAuthor) {
      const source = safeSource(req.query?.from);
      Story.updateOne(
        { storyId },
        {
          $inc: { views: 1, [`viewsBySource.${source}`]: 1 },
          $set: { lastViewedAt: new Date() },
        },
      ).catch((err) => console.error('view count failed:', err.message));
    }

    const { ownerId: _ownerId, ...publicStory } = story.toObject();
    return res.json(publicStory);
  } catch (err) {
    console.error('getPublicStory error:', err);
    return res.status(500).json({ error: 'Failed to load story' });
  }
}

// POST /api/story/:id/finished — the visitor reached the last scene.
// Separate from the view count because it answers a different question, and
// happens at a different moment. Open to anonymous callers for the same reason
// the public link is: the audience this measures has no account.
async function markStoryFinished(req, res) {
  try {
    const storyId = safeString(req.params?.id);
    if (!storyId || !UUID_RE.test(storyId)) {
      return res.status(400).json({ error: 'Invalid story ID' });
    }

    const story = await Story.findOne({ storyId }, { isPublic: 1, ownerId: 1 });
    // Same silence as the public fetch: never reveal whether a story exists.
    if (!story || !story.isPublic) return res.json({ ok: true });
    // An author watching their own story through is not an audience.
    if (req.user?.userId && req.user.userId === story.ownerId) return res.json({ ok: true });

    await Story.updateOne({ storyId }, { $inc: { completions: 1 } });
    return res.json({ ok: true });
  } catch (err) {
    console.error('markStoryFinished error:', err);
    // Never a reason for the viewer to show an error — this is bookkeeping.
    return res.json({ ok: true });
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

module.exports = {
  markStoryFinished, saveStory, getStory, listStories, getPublicStory, setStoryPublished, deleteStory };
