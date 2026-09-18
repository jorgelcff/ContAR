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

// A scene can carry the same narration in several languages, so one QR code
// serves whoever scans it. `content` is handed to mongoose whole and
// translations is a Mixed field, so nothing in the schema checks it — the
// controller is the only thing standing between that document and whatever a
// client sends.
describe('narration in more than one language', () => {
  const withTranslations = (translations, language = 'pt') => ({
    content: {
      narrative: { text: 'Olá', audioUrl: 'https://cdn/pt.mp3', language, translations },
    },
  });

  async function save(user, body) {
    const res = await request(app)
      .post('/api/scene')
      .set('Authorization', user.authHeader)
      .send(body);
    expect(res.status).toBe(200);
    const stored = await request(app).get(`/api/scene/${res.body.sceneId}`);
    return stored.body.content.narrative;
  }

  it('stores a translation per language, each with its own audio', async () => {
    const user = await createAuthedUser();
    const narrative = await save(user, withTranslations({
      en: { text: 'Hello', audioUrl: 'https://cdn/en.mp3' },
      es: { text: 'Hola', audioUrl: 'https://cdn/es.mp3' },
    }));

    expect(narrative.language).toBe('pt');
    expect(narrative.translations.en).toEqual({ text: 'Hello', audioUrl: 'https://cdn/en.mp3' });
    expect(narrative.translations.es.audioUrl).toBe('https://cdn/es.mp3');
    // The original is untouched by any of it.
    expect(narrative.text).toBe('Olá');
  });

  it('drops languages the interface cannot label', async () => {
    const user = await createAuthedUser();
    const narrative = await save(user, withTranslations({
      en: { text: 'Hello' },
      kl: { text: 'Klingon' },
      __proto__: { text: 'nope' },
      'not a language at all': { text: 'nope' },
    }));
    expect(Object.keys(narrative.translations)).toEqual(['en']);
  });

  it('normalizes a region tag onto its language', async () => {
    const user = await createAuthedUser();
    const narrative = await save(user, withTranslations({ 'en-GB': { text: 'Hello' } }, 'pt-BR'));
    expect(narrative.translations.en.text).toBe('Hello');
    expect(narrative.language).toBe('pt');
  });

  it('ignores an empty slot the editor merely opened', async () => {
    const user = await createAuthedUser();
    const narrative = await save(user, withTranslations({
      en: { text: '', audioUrl: '' },
      es: { text: 'Hola' },
    }));
    expect(narrative.translations.en).toBeUndefined();
    expect(narrative.translations.es.text).toBe('Hola');
  });

  // An empty map is not serialized back, which is the same thing as having no
  // translations — and removing the last one really does remove it, checked
  // below rather than assumed.
  const stored = (narrative) => narrative.translations || {};

  it('refuses shapes that are not translations', async () => {
    const user = await createAuthedUser();
    for (const translations of ['a string', 42, ['en'], null]) {
      expect(stored(await save(user, withTranslations(translations)))).toEqual({});
    }
    expect(stored(await save(user, withTranslations({ en: 'Hello' })))).toEqual({});
  });

  it('a translation removed from a scene stays removed', async () => {
    const user = await createAuthedUser();
    const created = await request(app)
      .post('/api/scene')
      .set('Authorization', user.authHeader)
      .send(withTranslations({ en: { text: 'Hello' } }));
    const { sceneId } = created.body;

    const added = await request(app).get(`/api/scene/${sceneId}`);
    expect(added.body.content.narrative.translations.en.text).toBe('Hello');

    await request(app)
      .post('/api/scene')
      .set('Authorization', user.authHeader)
      .send({ sceneId, ...withTranslations({}) });

    const after = await request(app).get(`/api/scene/${sceneId}`);
    expect(stored(after.body.content.narrative)).toEqual({});
  });

  it('bounds what one scene can store', async () => {
    const user = await createAuthedUser();
    const narrative = await save(user, withTranslations({
      en: { text: 'x'.repeat(9000), audioUrl: `https://cdn/${'y'.repeat(3000)}.mp3` },
    }));
    expect(narrative.translations.en.text.length).toBe(5000);
    expect(narrative.translations.en.audioUrl.length).toBe(2000);
  });

  it('leaves a scene saved before any of this existed alone', async () => {
    const user = await createAuthedUser();
    const res = await request(app)
      .post('/api/scene')
      .set('Authorization', user.authHeader)
      .send({ content: { narrative: { text: 'Uma cena antiga', audioUrl: 'https://cdn/old.mp3' } } });
    expect(res.status).toBe(200);

    const saved = await request(app).get(`/api/scene/${res.body.sceneId}`);
    expect(saved.body.content.narrative.text).toBe('Uma cena antiga');
    expect(saved.body.content.narrative.language).toBe('');
    expect(stored(saved.body.content.narrative)).toEqual({});
  });
});
