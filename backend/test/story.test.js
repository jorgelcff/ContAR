const request = require('supertest');
const app = require('../app');
const { createAuthedUser } = require('./helpers');

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
  it('is public and returns the story without requiring the owner', async () => {
    const user = await createAuthedUser();
    const created = await request(app)
      .post('/api/story')
      .set('Authorization', user.authHeader)
      .send(sampleStory);

    const res = await request(app).get(`/api/story/public/${created.body.storyId}`);
    expect(res.status).toBe(200);
    expect(res.body.metadata.title).toBe('Test Story');
  });

  it('returns 404 for an unknown story', async () => {
    const res = await request(app).get('/api/story/public/22222222-2222-4222-8222-222222222222');
    expect(res.status).toBe(404);
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
