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

  it("refuses to write over another account's scene", async () => {
    // The upsert used to match on sceneId alone and set ownerId to the caller,
    // so posting a sceneId you had merely seen took the scene over: it left the
    // owner's list and joined yours. Scene ids are public — they are the
    // /scene/:id share link — so sharing a scene gave it away.
    const owner = await createAuthedUser();
    const attacker = await createAuthedUser();

    const created = await request(app)
      .post('/api/scene')
      .set('Authorization', owner.authHeader)
      .send(sampleScene);
    const { sceneId } = created.body;

    const hijack = await request(app)
      .post('/api/scene')
      .set('Authorization', attacker.authHeader)
      .send({ ...sampleScene, sceneId, metadata: { title: 'Taken over' } });
    expect(hijack.status).toBe(403);

    // The scene is untouched and still the owner's.
    const after = await request(app).get(`/api/scene/${sceneId}`);
    expect(after.body.metadata.title).toBe('Test Scene');

    const ownerList = await request(app).get('/api/scene').set('Authorization', owner.authHeader);
    expect(ownerList.body.scenes.map((s) => s.sceneId)).toContain(sceneId);

    const attackerList = await request(app).get('/api/scene').set('Authorization', attacker.authHeader);
    expect(attackerList.body.scenes.map((s) => s.sceneId)).not.toContain(sceneId);
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
  it('reports a conflict instead of overwriting a newer save from another tab', async () => {
    // Autosave fires every few seconds, so two tabs on one scene otherwise take
    // turns overwriting each other with whatever each had in memory, and
    // whoever loses never finds out.
    const user = await createAuthedUser();
    const first = await request(app)
      .post('/api/scene')
      .set('Authorization', user.authHeader)
      .send(sampleScene);
    const { sceneId, updatedAt } = first.body;
    expect(updatedAt).toBeTruthy();

    // Tab A saves, moving the scene forward.
    await request(app)
      .post('/api/scene')
      .set('Authorization', user.authHeader)
      .send({ ...sampleScene, sceneId, baseUpdatedAt: updatedAt, metadata: { title: 'From tab A' } });

    // Tab B is still working from the original version.
    const stale = await request(app)
      .post('/api/scene')
      .set('Authorization', user.authHeader)
      .send({ ...sampleScene, sceneId, baseUpdatedAt: updatedAt, metadata: { title: 'From tab B' } });

    expect(stale.status).toBe(409);
    const after = await request(app).get(`/api/scene/${sceneId}`);
    expect(after.body.metadata.title).toBe('From tab A');
  });

  it('still saves when the client sends no base version (older clients)', async () => {
    const user = await createAuthedUser();
    const created = await request(app)
      .post('/api/scene').set('Authorization', user.authHeader).send(sampleScene);
    const res = await request(app)
      .post('/api/scene').set('Authorization', user.authHeader)
      .send({ ...sampleScene, sceneId: created.body.sceneId, metadata: { title: 'No version' } });
    expect(res.status).toBe(200);
  });

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
