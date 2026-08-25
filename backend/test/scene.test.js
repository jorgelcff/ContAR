const request = require('supertest');
const app = require('../app');
const { createAuthedUser } = require('./helpers');

const sampleScene = {
  metadata: { title: 'Test Scene', theme: '' },
  content: {
    avatar: { modelUrl: 'https://example.com/avatar.glb', posePreset: 'idle' },
    narrative: { text: 'Hello', audioUrl: '', displayMode: 'bubble' },
  },
};

describe('POST /api/scene', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/scene').send(sampleScene);
    expect(res.status).toBe(401);
  });

  it('creates a scene owned by the caller and returns a UUID sceneId', async () => {
    const user = await createAuthedUser();
    const res = await request(app)
      .post('/api/scene')
      .set('Authorization', user.authHeader)
      .send(sampleScene);

    expect(res.status).toBe(200);
    expect(res.body.sceneId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('updates the same scene in place when sceneId is passed again (upsert, not duplicate)', async () => {
    const user = await createAuthedUser();
    const first = await request(app)
      .post('/api/scene')
      .set('Authorization', user.authHeader)
      .send(sampleScene);

    const updated = await request(app)
      .post('/api/scene')
      .set('Authorization', user.authHeader)
      .send({ ...sampleScene, sceneId: first.body.sceneId, metadata: { title: 'Renamed' } });

    expect(updated.body.sceneId).toBe(first.body.sceneId);

    const list = await request(app).get('/api/scene').set('Authorization', user.authHeader);
    expect(list.body.scenes).toHaveLength(1);
    expect(list.body.scenes[0].metadata.title).toBe('Renamed');
  });

  it('ignores a client-supplied sceneId that is not a valid UUID (mints a real one instead)', async () => {
    const user = await createAuthedUser();
    const res = await request(app)
      .post('/api/scene')
      .set('Authorization', user.authHeader)
      .send({ ...sampleScene, sceneId: 'not-a-uuid' });

    expect(res.status).toBe(200);
    expect(res.body.sceneId).not.toBe('not-a-uuid');
  });
});

describe('GET /api/scene/:id', () => {
  it('is public — no auth required to view a scene', async () => {
    const user = await createAuthedUser();
    const created = await request(app)
      .post('/api/scene')
      .set('Authorization', user.authHeader)
      .send(sampleScene);

    const res = await request(app).get(`/api/scene/${created.body.sceneId}`);
    expect(res.status).toBe(200);
    expect(res.body.sceneId).toBe(created.body.sceneId);
  });

  it('returns 404 for a well-formed but unknown UUID', async () => {
    const res = await request(app).get('/api/scene/11111111-1111-4111-8111-111111111111');
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await request(app).get('/api/scene/not-a-uuid');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/scene', () => {
  it('only lists scenes owned by the caller', async () => {
    const owner = await createAuthedUser();
    const other = await createAuthedUser();

    await request(app).post('/api/scene').set('Authorization', owner.authHeader).send(sampleScene);
    await request(app).post('/api/scene').set('Authorization', other.authHeader).send(sampleScene);

    const res = await request(app).get('/api/scene').set('Authorization', owner.authHeader);
    expect(res.body.scenes).toHaveLength(1);
  });
});

describe('DELETE /api/scene/:id', () => {
  it("rejects deleting another user's scene", async () => {
    const owner = await createAuthedUser();
    const intruder = await createAuthedUser();
    const created = await request(app)
      .post('/api/scene')
      .set('Authorization', owner.authHeader)
      .send(sampleScene);

    const res = await request(app)
      .delete(`/api/scene/${created.body.sceneId}`)
      .set('Authorization', intruder.authHeader);

    expect(res.status).toBe(404);
  });

  it('deletes a scene the caller owns', async () => {
    const user = await createAuthedUser();
    const created = await request(app)
      .post('/api/scene')
      .set('Authorization', user.authHeader)
      .send(sampleScene);

    const res = await request(app)
      .delete(`/api/scene/${created.body.sceneId}`)
      .set('Authorization', user.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    const getRes = await request(app).get(`/api/scene/${created.body.sceneId}`);
    expect(getRes.status).toBe(404);
  });
});
