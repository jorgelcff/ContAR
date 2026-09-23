const request = require('supertest');
const app = require('../app');
const { createAuthedUser } = require('./helpers');
const User = require('../models/User');

const VALID_SCENE_ID = '11111111-1111-4111-8111-111111111111';

const sampleStory = {
  metadata: { title: 'Test Story', description: 'A story for testing' },
  scenes: [{ sceneId: VALID_SCENE_ID, order: 0, transitionText: '', durationSeconds: 5 }],
};

describe('POST /api/story', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/story').send(sampleStory);
    expect(res.status).toBe(401);
  });

  it('creates a story and drops scene entries with invalid sceneIds', async () => {
    const user = await createAuthedUser();
    const res = await request(app)
      .post('/api/story')
      .set('Authorization', user.authHeader)
      .send({
        ...sampleStory,
        scenes: [...sampleStory.scenes, { sceneId: 'not-a-uuid', order: 1 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.sceneCount).toBe(1);
  });

  it('defaults to "Untitled Story" when no title is given', async () => {
    const user = await createAuthedUser();
    const res = await request(app)
      .post('/api/story')
      .set('Authorization', user.authHeader)
      .send({ scenes: [] });

    const story = await request(app)
      .get(`/api/story/${res.body.storyId}`)
      .set('Authorization', user.authHeader);

    expect(story.body.metadata.title).toBe('Untitled Story');
  });
});

describe('GET /api/story/:id (private)', () => {
  it("rejects fetching another user's story", async () => {
    const owner = await createAuthedUser();
    const intruder = await createAuthedUser();
    const created = await request(app)
      .post('/api/story')
      .set('Authorization', owner.authHeader)
      .send(sampleStory);

    const res = await request(app)
      .get(`/api/story/${created.body.storyId}`)
      .set('Authorization', intruder.authHeader);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/story/public/:id', () => {
  it('returns 404 for a saved story that has not been published yet', async () => {
    const user = await createAuthedUser();
    const created = await request(app)
      .post('/api/story')
      .set('Authorization', user.authHeader)
      .send(sampleStory);

    const res = await request(app).get(`/api/story/public/${created.body.storyId}`);
    expect(res.status).toBe(404);
  });

  it('is public and returns the story without requiring the owner, once published', async () => {
    const user = await createAuthedUser();
    const created = await request(app)
      .post('/api/story')
      .set('Authorization', user.authHeader)
      .send(sampleStory);

    await request(app)
      .put(`/api/story/${created.body.storyId}/publish`)
      .set('Authorization', user.authHeader)
      .send({ isPublic: true });

    const res = await request(app).get(`/api/story/public/${created.body.storyId}`);
    expect(res.status).toBe(200);
    expect(res.body.metadata.title).toBe('Test Story');
  });

  it('returns 404 for an unknown story', async () => {
    const res = await request(app).get('/api/story/public/22222222-2222-4222-8222-222222222222');
    expect(res.status).toBe(404);
  });

  // Publishing is about who *else* can see the story. It was also gating the
  // author's own preview: the "View" button in the story list, and the browser
  // preview link in the editor, both 404'd on anything not yet published — so
  // the only way to look at a story you were building was to publish it first.
  it('lets the author preview their own story before it is published', async () => {
    const user = await createAuthedUser();
    const created = await request(app)
      .post('/api/story')
      .set('Authorization', user.authHeader)
      .send(sampleStory);

    const res = await request(app)
      .get(`/api/story/public/${created.body.storyId}`)
      .set('Authorization', user.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.metadata.title).toBe('Test Story');
    expect(res.body.isPublic).toBe(false);
  });

  it('still hides an unpublished story from a different signed-in user', async () => {
    const author = await createAuthedUser();
    const stranger = await createAuthedUser();
    const created = await request(app)
      .post('/api/story')
      .set('Authorization', author.authHeader)
      .send(sampleStory);

    const res = await request(app)
      .get(`/api/story/public/${created.body.storyId}`)
      .set('Authorization', stranger.authHeader);

    expect(res.status).toBe(404);
  });

  it('ignores a junk token rather than rejecting the request', async () => {
    // A stale token in someone's browser must not break a link that works for
    // a signed-out visitor.
    const user = await createAuthedUser();
    const created = await request(app)
      .post('/api/story')
      .set('Authorization', user.authHeader)
      .send(sampleStory);
    await request(app)
      .put(`/api/story/${created.body.storyId}/publish`)
      .set('Authorization', user.authHeader)
      .send({ isPublic: true });

    const res = await request(app)
      .get(`/api/story/public/${created.body.storyId}`)
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(200);
  });
});

describe('PUT /api/story/:id/publish', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).put('/api/story/11111111-1111-4111-8111-111111111111/publish').send({ isPublic: true });
    expect(res.status).toBe(401);
  });

  it('allows publishing from an account that has not confirmed its email', async () => {
    const user = await createAuthedUser();
    await User.updateOne({ _id: user.userId }, { emailVerified: false });

    const created = await request(app)
      .post('/api/story').set('Authorization', user.authHeader)
      .send({ metadata: { title: 'Unverified' }, scenes: [] });

    const res = await request(app)
      .put(`/api/story/${created.body.storyId}/publish`)
      .set('Authorization', user.authHeader)
      .send({ isPublic: true });

    expect(res.status).toBe(200);

    // And it really is reachable.
    const pub = await request(app).get(`/api/story/public/${created.body.storyId}`);
    expect(pub.status).toBe(200);
  });

  it('lets a confirmed account publish', async () => {
    const user = await createAuthedUser();
    await User.updateOne({ _id: user.userId }, { emailVerified: true });
    const created = await request(app)
      .post('/api/story').set('Authorization', user.authHeader)
      .send({ metadata: { title: 'Verified' }, scenes: [] });

    const res = await request(app)
      .put(`/api/story/${created.body.storyId}/publish`)
      .set('Authorization', user.authHeader)
      .send({ isPublic: true });
    expect(res.status).toBe(200);
  });

  it('always allows unpublishing, verified or not', async () => {
    // Taking your own content down must never depend on a working mailbox.
    const user = await createAuthedUser();
    await User.updateOne({ _id: user.userId }, { emailVerified: true });
    const created = await request(app)
      .post('/api/story').set('Authorization', user.authHeader)
      .send({ metadata: { title: 'Taking it down' }, scenes: [] });
    await request(app)
      .put(`/api/story/${created.body.storyId}/publish`)
      .set('Authorization', user.authHeader).send({ isPublic: true });

    await User.updateOne({ _id: user.userId }, { emailVerified: false });
    const res = await request(app)
      .put(`/api/story/${created.body.storyId}/publish`)
      .set('Authorization', user.authHeader).send({ isPublic: false });
    expect(res.status).toBe(200);
  });

  it("rejects publishing another user's story", async () => {
    const owner = await createAuthedUser();
    const intruder = await createAuthedUser();
    const created = await request(app)
      .post('/api/story')
      .set('Authorization', owner.authHeader)
      .send(sampleStory);

    const res = await request(app)
      .put(`/api/story/${created.body.storyId}/publish`)
      .set('Authorization', intruder.authHeader)
      .send({ isPublic: true });

    expect(res.status).toBe(404);
  });

  it('can be toggled back to private, hiding it from the public route again', async () => {
    const user = await createAuthedUser();
    const created = await request(app)
      .post('/api/story')
      .set('Authorization', user.authHeader)
      .send(sampleStory);

    await request(app)
      .put(`/api/story/${created.body.storyId}/publish`)
      .set('Authorization', user.authHeader)
      .send({ isPublic: true });

    const unpublish = await request(app)
      .put(`/api/story/${created.body.storyId}/publish`)
      .set('Authorization', user.authHeader)
      .send({ isPublic: false });
    expect(unpublish.body.isPublic).toBe(false);

    const publicRes = await request(app).get(`/api/story/public/${created.body.storyId}`);
    expect(publicRes.status).toBe(404);
  });

  it('saving the story again afterwards does not reset its publish state', async () => {
    const user = await createAuthedUser();
    const created = await request(app)
      .post('/api/story')
      .set('Authorization', user.authHeader)
      .send(sampleStory);

    await request(app)
      .put(`/api/story/${created.body.storyId}/publish`)
      .set('Authorization', user.authHeader)
      .send({ isPublic: true });

    await request(app)
      .post('/api/story')
      .set('Authorization', user.authHeader)
      .send({ ...sampleStory, storyId: created.body.storyId, metadata: { title: 'Edited title' } });

    const publicRes = await request(app).get(`/api/story/public/${created.body.storyId}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.metadata.title).toBe('Edited title');
  });
});

describe('DELETE /api/story/:id', () => {
  it("rejects deleting another user's story", async () => {
    const owner = await createAuthedUser();
    const intruder = await createAuthedUser();
    const created = await request(app)
      .post('/api/story')
      .set('Authorization', owner.authHeader)
      .send(sampleStory);

    const res = await request(app)
      .delete(`/api/story/${created.body.storyId}`)
      .set('Authorization', intruder.authHeader);

    expect(res.status).toBe(404);
  });
});

// A scene holds until its narration finishes unless it asks for the clock.
// Waiting is the default because that is what the AR player has always done;
// counting seconds is the behaviour a scene has to opt into by name, so an
// unreadable value must land on waiting rather than silently picking the other.
describe('scene advance mode', () => {
  it('stores the timed mode when asked, and waits for the narration otherwise', async () => {
    const user = await createAuthedUser();
    const res = await request(app)
      .post('/api/story')
      .set('Authorization', user.authHeader)
      .send({
        metadata: { title: 'Advance' },
        scenes: [
          { sceneId: VALID_SCENE_ID, order: 0, advanceOn: 'narration' },
          { sceneId: VALID_SCENE_ID, order: 1, advanceOn: 'time' },
          { sceneId: VALID_SCENE_ID, order: 2 },
          { sceneId: VALID_SCENE_ID, order: 3, advanceOn: 'whatever' },
        ],
      });
    expect(res.status).toBe(200);

    const stored = await request(app)
      .get(`/api/story/${res.body.storyId}`)
      .set('Authorization', user.authHeader);
    expect(stored.body.scenes.map((s) => s.advanceOn)).toEqual([
      'narration', 'time', 'narration', 'narration',
    ]);
  });
});

// Sign-ups were the only thing counted, which misses the audience a QR code at
// a poster is for entirely: they watch and leave without ever making an
// account. Counting who opened the public link is the number that was missing.
describe('counting who watched', () => {
  async function publish(user, title = 'Contada') {
    const created = await request(app)
      .post('/api/story')
      .set('Authorization', user.authHeader)
      .send({ ...sampleStory, metadata: { title } });
    await request(app)
      .put(`/api/story/${created.body.storyId}/publish`)
      .set('Authorization', user.authHeader)
      .send({ isPublic: true });
    return created.body.storyId;
  }

  const viewsOf = async (user, storyId) => {
    const list = await request(app).get('/api/story').set('Authorization', user.authHeader);
    return list.body.stories.find((s) => s.storyId === storyId)?.views;
  };

  it('counts a visitor opening the public link', async () => {
    const author = await createAuthedUser();
    const storyId = await publish(author);

    expect(await viewsOf(author, storyId)).toBe(0);
    await request(app).get(`/api/story/public/${storyId}`);
    await request(app).get(`/api/story/public/${storyId}`);
    expect(await viewsOf(author, storyId)).toBe(2);
  });

  it('does not count the author checking their own story', async () => {
    // Previewing your own work is not an audience, and a number inflated by
    // the person reading it is worse than no number.
    const author = await createAuthedUser();
    const storyId = await publish(author);

    await request(app)
      .get(`/api/story/public/${storyId}`)
      .set('Authorization', author.authHeader);

    expect(await viewsOf(author, storyId)).toBe(0);
  });

  it('counts another signed-in person, who is an audience', async () => {
    const author = await createAuthedUser();
    const visitor = await createAuthedUser();
    const storyId = await publish(author);

    await request(app)
      .get(`/api/story/public/${storyId}`)
      .set('Authorization', visitor.authHeader);

    expect(await viewsOf(author, storyId)).toBe(1);
  });

  it('counts nothing for a story nobody can open', async () => {
    const author = await createAuthedUser();
    const created = await request(app)
      .post('/api/story')
      .set('Authorization', author.authHeader)
      .send(sampleStory);

    // A draft 404s for everyone else, so there is no public reach to measure.
    await request(app).get(`/api/story/public/${created.body.storyId}`);
    expect(await viewsOf(author, created.body.storyId)).toBe(0);
  });

  it('never lets the counter break the page', async () => {
    // The increment is fire-and-forget on purpose: a visitor who scanned a code
    // must get the story even if the write fails.
    const author = await createAuthedUser();
    const storyId = await publish(author);
    const spy = vi.spyOn(require('../models/Story'), 'updateOne')
      .mockRejectedValue(new Error('write failed'));
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await request(app).get(`/api/story/public/${storyId}`);
      expect(res.status).toBe(200);
      expect(res.body.metadata.title).toBe('Contada');
    } finally {
      spy.mockRestore();
      quiet.mockRestore();
    }
  });
});

// Opens say a link was scanned. These two say whether the story held anyone,
// and which QR code they scanned it from — the difference between a number and
// a result.
describe('where the audience came from, and whether they stayed', () => {
  async function publish(user) {
    const created = await request(app)
      .post('/api/story')
      .set('Authorization', user.authHeader)
      .send(sampleStory);
    await request(app)
      .put(`/api/story/${created.body.storyId}/publish`)
      .set('Authorization', user.authHeader)
      .send({ isPublic: true });
    return created.body.storyId;
  }

  const cardFor = async (user, storyId) => {
    const list = await request(app).get('/api/story').set('Authorization', user.authHeader);
    return list.body.stories.find((s) => s.storyId === storyId);
  };

  it('splits opens by the tag printed on the link', async () => {
    const author = await createAuthedUser();
    const storyId = await publish(author);

    await request(app).get(`/api/story/public/${storyId}?from=poster`);
    await request(app).get(`/api/story/public/${storyId}?from=poster`);
    await request(app).get(`/api/story/public/${storyId}?from=slide`);
    await request(app).get(`/api/story/public/${storyId}`);

    const card = await cardFor(author, storyId);
    expect(card.views).toBe(4);
    expect(card.viewsBySource).toEqual({ poster: 2, slide: 1, direct: 1 });
  });

  it('refuses a tag it would have to write into the document verbatim', async () => {
    const author = await createAuthedUser();
    const storyId = await publish(author);

    // The tag becomes a key in a Mixed field. Anything unrecognisable counts
    // as an untagged visit rather than creating a key of its own.
    // __proto__ and friends match the shape but must never become keys in a
    // document JavaScript later spreads and reads back.
    for (const bad of ['A Very Long Tag That Goes On', '__proto__', 'constructor', 'prototype', 'has spaces', '../escape', '']) {
      await request(app).get(`/api/story/public/${storyId}?from=${encodeURIComponent(bad)}`);
    }

    const card = await cardFor(author, storyId);
    expect(card.viewsBySource).toEqual({ direct: 7 });
  });

  it('counts a visitor who watched it through', async () => {
    const author = await createAuthedUser();
    const storyId = await publish(author);

    await request(app).post(`/api/story/${storyId}/finished`);
    await request(app).post(`/api/story/${storyId}/finished`);

    expect((await cardFor(author, storyId)).completions).toBe(2);
  });

  it('does not count the author watching their own story through', async () => {
    const author = await createAuthedUser();
    const storyId = await publish(author);

    await request(app)
      .post(`/api/story/${storyId}/finished`)
      .set('Authorization', author.authHeader);

    expect((await cardFor(author, storyId)).completions).toBe(0);
  });

  it('says nothing about a story that is not public, including whether it exists', async () => {
    const author = await createAuthedUser();
    const draft = await request(app)
      .post('/api/story')
      .set('Authorization', author.authHeader)
      .send(sampleStory);

    const onDraft = await request(app).post(`/api/story/${draft.body.storyId}/finished`);
    const onNothing = await request(app).post('/api/story/22222222-2222-4222-8222-222222222222/finished');

    // Both answer the same way — a 404 here would leak which ids are real.
    expect(onDraft.status).toBe(200);
    expect(onNothing.status).toBe(200);
    expect((await cardFor(author, draft.body.storyId)).completions).toBe(0);
  });
});
