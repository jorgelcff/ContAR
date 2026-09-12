const request = require('supertest');
const app = require('../app');
const { createAuthedUser } = require('./helpers');

describe('PUT /api/avatar/user-link', () => {
  it('rejects requests with no token', async () => {
    const res = await request(app).put('/api/avatar/user-link').send({ avaturnUserId: 'abc123' });
    expect(res.status).toBe(401);
  });

  it('rejects a missing avaturnUserId', async () => {
    const user = await createAuthedUser();
    const res = await request(app)
      .put('/api/avatar/user-link')
      .set('Authorization', user.authHeader)
      .send({});

    expect(res.status).toBe(400);
  });

  it('links the Avaturn user id to the account, and it appears on /api/auth/me', async () => {
    const user = await createAuthedUser();

    const linkRes = await request(app)
      .put('/api/avatar/user-link')
      .set('Authorization', user.authHeader)
      .send({ avaturnUserId: 'avaturn-user-xyz' });

    expect(linkRes.status).toBe(200);
    expect(linkRes.body.avaturnUserId).toBe('avaturn-user-xyz');

    const meRes = await request(app).get('/api/auth/me').set('Authorization', user.authHeader);
    expect(meRes.body.user.avaturnUserId).toBe('avaturn-user-xyz');
  });

  it('overwrites a previously linked id when the user creates a new Avaturn identity', async () => {
    const user = await createAuthedUser();
    await request(app)
      .put('/api/avatar/user-link')
      .set('Authorization', user.authHeader)
      .send({ avaturnUserId: 'first-id' });

    const res = await request(app)
      .put('/api/avatar/user-link')
      .set('Authorization', user.authHeader)
      .send({ avaturnUserId: 'second-id' });

    expect(res.status).toBe(200);
    expect(res.body.avaturnUserId).toBe('second-id');
  });
});
