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

// The panel grew from two headline numbers into a drop-off funnel and a daily
// signup series. The funnel is the part worth pinning: each stage counts
// *people*, not rows, so one person with four scenes must not read as four.
describe('GET /api/stats — funnel and trend', () => {
  const prev = process.env.ADMIN_EMAILS;
  afterEach(() => { process.env.ADMIN_EMAILS = prev; });

  async function statsFor(user) {
    process.env.ADMIN_EMAILS = user.email;
    const res = await request(app).get('/api/stats').set('Authorization', user.authHeader);
    expect(res.status).toBe(200);
    return res.body;
  }

  it('counts people per stage, not rows', async () => {
    const admin = await createAuthedUser();
    const before = await statsFor(admin);

    // One person, three scenes and two stories, one of them published.
    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post('/api/scene')
        .set('Authorization', admin.authHeader)
        .send({ avatarUrl: `https://example.com/a${i}.glb` });
    }
    const storyRes = await request(app)
      .post('/api/story')
      .set('Authorization', admin.authHeader)
      .send({ metadata: { title: 'S' }, scenes: [{ sceneId: '11111111-1111-4111-8111-111111111111', order: 0 }] });
    await request(app)
      .put(`/api/story/${storyRes.body.storyId}/publish`)
      .set('Authorization', admin.authHeader)
      .send({ isPublic: true });

    const after = await statsFor(admin);
    expect(after.scenes).toBe(before.scenes + 3);
    // Three scenes, one creator.
    expect(after.usersWhoCreated).toBe(before.usersWhoCreated + 1);
    expect(after.usersWhoPublished).toBe(before.usersWhoPublished + 1);
  });

  it('never reports a stage larger than the population it is drawn against', async () => {
    // Every bar is a share of the registered total, so no stage may exceed it.
    // Deliberately not asserted: that each stage fits inside the one above.
    // Saving a story only validates the shape of its scene ids, not that those
    // scenes exist or belong to the author — so someone can in principle
    // publish without owning a scene, and pinning a nesting the code does not
    // enforce would be a test asserting a coincidence.
    const admin = await createAuthedUser();
    const s = await statsFor(admin);
    expect(s.verifiedUsers).toBeLessThanOrEqual(s.users);
    expect(s.usersWhoCreated).toBeLessThanOrEqual(s.users);
    expect(s.usersWhoPublished).toBeLessThanOrEqual(s.users);
  });

  it('returns one row per day for the whole window, quiet days included', async () => {
    const admin = await createAuthedUser();
    const s = await statsFor(admin);

    expect(s.signupsByDay).toHaveLength(30);
    expect(s.signupsByDay.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))).toBe(true);
    expect(s.signupsByDay.every((d) => Number.isInteger(d.count))).toBe(true);
    // Ascending, ending today.
    const dates = s.signupsByDay.map((d) => d.date);
    expect([...dates].sort()).toEqual(dates);
    expect(dates[29]).toBe(new Date().toISOString().slice(0, 10));
    // The admin just registered, so today is not empty.
    expect(s.signupsByDay[29].count).toBeGreaterThan(0);
    expect(s.lastSignupAt).toBeTruthy();
  });
});

// Each content route counts its own traffic. They used to share one limiter
// instance — one counter of 100 per IP per fifteen minutes across listing,
// reading, saving and deleting together — which behind a single NAT is 100 for
// a whole room while the editor autosaves every five idle seconds.
describe('content rate limits', () => {
  it('gives reads and writes separate budgets', async () => {
    const user = await createAuthedUser();
    const read = await request(app).get('/api/scene').set('Authorization', user.authHeader);
    const write = await request(app)
      .post('/api/scene')
      .set('Authorization', user.authHeader)
      .send({ avatarUrl: 'https://example.com/a.glb' });

    expect(read.status).toBe(200);
    expect(write.status).toBe(200);
    // Different policies mean different limiter instances, so one cannot drain
    // the other.
    expect(read.headers['ratelimit-limit']).not.toBe(write.headers['ratelimit-limit']);
  });

  it('does not let listing scenes eat into the budget for saving them', async () => {
    const user = await createAuthedUser();
    const before = await request(app)
      .post('/api/scene')
      .set('Authorization', user.authHeader)
      .send({ avatarUrl: 'https://example.com/b.glb' });
    const remainingBefore = Number(before.headers['ratelimit-remaining']);

    for (let i = 0; i < 12; i += 1) {
      await request(app).get('/api/scene').set('Authorization', user.authHeader);
    }

    const after = await request(app)
      .post('/api/scene')
      .set('Authorization', user.authHeader)
      .send({ avatarUrl: 'https://example.com/c.glb' });

    expect(after.status).toBe(200);
    // Twelve reads in between, and the write budget moved by exactly one.
    expect(Number(after.headers['ratelimit-remaining'])).toBe(remainingBefore - 1);
  });
});
