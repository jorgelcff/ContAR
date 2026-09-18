const request = require('supertest');
const app = require('../app');
const { createAuthedUser } = require('./helpers');

// A sweep rather than a feature test. Every avatar route proxies the Avaturn
// API using the server's own AVATURN_API_TOKEN, and all but one shipped without
// requireAuth — an open proxy onto a paid account, including two delete routes.
// Most have no caller in the app at all, which is exactly why it went unnoticed,
// so this asserts the gate directly instead of waiting for a feature to cover it.
const AVATAR_ROUTES = [
  ['put', '/api/avatar/user-link'],
  ['post', '/api/avatar/user/new'],
  ['delete', '/api/avatar/user/someone'],
  ['post', '/api/avatar/session'],
  ['get', '/api/avatar/list'],
  ['post', '/api/avatar/new'],
  ['get', '/api/avatar/abc/customization'],
  ['put', '/api/avatar/abc/customization'],
  ['delete', '/api/avatar/users/someone/avatars/abc'],
  ['post', '/api/avatar/render'],
  ['post', '/api/avatar/export'],
];

describe('avatar proxy requires a session', () => {
  for (const [method, path] of AVATAR_ROUTES) {
    it(`${method.toUpperCase()} ${path} rejects anonymous callers`, async () => {
      const res = await request(app)[method](path).send({});
      expect(res.status).toBe(401);
    });
  }
});

// Endpoints that mutate or list per-user data must key off the caller, never off
// an id the caller supplies — that is how the scene upsert let one account take
// another's scene over.
describe('write routes are scoped to the caller', () => {
  it('a scene cannot be saved over by another account', async () => {
    const owner = await createAuthedUser();
    const other = await createAuthedUser();
    const created = await request(app)
      .post('/api/scene').set('Authorization', owner.authHeader)
      .send({ metadata: { title: 'Mine' }, content: {} });

    const res = await request(app)
      .post('/api/scene').set('Authorization', other.authHeader)
      .send({ sceneId: created.body.sceneId, metadata: { title: 'Theirs' }, content: {} });
    expect(res.status).toBe(403);
  });

  it('a story cannot be saved over by another account', async () => {
    const owner = await createAuthedUser();
    const other = await createAuthedUser();
    const created = await request(app)
      .post('/api/story').set('Authorization', owner.authHeader)
      .send({ metadata: { title: 'Mine' }, scenes: [] });

    await request(app)
      .post('/api/story').set('Authorization', other.authHeader)
      .send({ storyId: created.body.storyId, metadata: { title: 'Theirs' }, scenes: [] });

    // Whatever the status, the owner's story must not have been rewritten.
    const after = await request(app)
      .get(`/api/story/${created.body.storyId}`).set('Authorization', owner.authHeader);
    expect(after.body.metadata.title).toBe('Mine');
  });

  it('media upload requires a session', async () => {
    for (const [method, path] of [['post', '/api/media/audio'], ['post', '/api/media/model'], ['delete', '/api/media/audio']]) {
      const res = await request(app)[method](path).send({});
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it('speech synthesis requires a session', async () => {
    const res = await request(app).post('/api/tts/generate').send({ text: 'hello' });
    expect(res.status).toBe(401);
  });
});

// This was left open so the public viewer and AR could upgrade the mapping for
// rigs the regex mapper cannot place. Being open also meant anyone who could
// send a POST could spend the deployment's OpenAI credit, which bounded inputs
// do not address — they cap what one request costs, not who may make one. It
// is gated now; an anonymous viewer keeps playback on the generic mapping.
// The input bounds still apply once signed in, and are asserted in
// paidRoutes.test.js alongside the rest of the spending routes.
describe('AI bone mapping is gated', () => {
  it('refuses a caller with no session', async () => {
    const res = await request(app)
      .post('/api/bones/map')
      .send({ bones: ['Hips', 'Spine'] });
    expect(res.status).toBe(401);
  });

  it('refuses even a well-formed request, so the bounds are not the only guard', async () => {
    const res = await request(app)
      .post('/api/bones/map')
      .send({ bones: Array.from({ length: 400 }, (_, i) => `Bone${i}`) });
    expect(res.status).toBe(401);
  });
});
