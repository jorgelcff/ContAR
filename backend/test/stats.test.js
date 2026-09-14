const request = require('supertest');
const app = require('../app');
const { createAuthedUser } = require('./helpers');

// Reach numbers for whoever deployed this. Access is by address rather than a
// role, because there is no admin concept in the product and inventing one for
// a single counter is not worth it — but that makes the allow-list the whole
// security boundary, so it gets asserted directly.
describe('GET /api/stats', () => {
  const prev = process.env.ADMIN_EMAILS;
  afterEach(() => { process.env.ADMIN_EMAILS = prev; });

  it('rejects anonymous callers', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(401);
  });

  it('rejects a signed-in account that is not on the list', async () => {
    const user = await createAuthedUser();
    process.env.ADMIN_EMAILS = 'someone.else@example.com';
    const res = await request(app).get('/api/stats').set('Authorization', user.authHeader);
    expect(res.status).toBe(403);
  });

  it('rejects everyone when no list is configured', async () => {
    // Fail closed: a deployment that forgot to set ADMIN_EMAILS must expose
    // nothing, not everything.
    const user = await createAuthedUser();
    delete process.env.ADMIN_EMAILS;
    const res = await request(app).get('/api/stats').set('Authorization', user.authHeader);
    expect(res.status).toBe(403);
  });

  it('matches the address case-insensitively', async () => {
    const user = await createAuthedUser();
    process.env.ADMIN_EMAILS = user.email.toUpperCase();
    const res = await request(app).get('/api/stats').set('Authorization', user.authHeader);
    expect(res.status).toBe(200);
  });

  it('counts people, and separately those who actually made something', async () => {
    const admin = await createAuthedUser();
    process.env.ADMIN_EMAILS = `padding@example.com, ${admin.email}`;

    const before = await request(app).get('/api/stats').set('Authorization', admin.authHeader);
    expect(before.status).toBe(200);

    // Someone signs up and leaves without creating anything.
    await createAuthedUser();
    // Someone signs up and builds a scene.
    const builder = await createAuthedUser();
    await request(app)
      .post('/api/scene').set('Authorization', builder.authHeader)
      .send({ metadata: { title: 'Made something' }, content: {} });

    const after = await request(app).get('/api/stats').set('Authorization', admin.authHeader);
    expect(after.body.users).toBe(before.body.users + 2);
    expect(after.body.usersWhoCreated).toBe(before.body.usersWhoCreated + 1);
    expect(after.body.scenes).toBe(before.body.scenes + 1);
  });
});
