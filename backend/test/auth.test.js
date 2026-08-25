const request = require('supertest');
const app = require('../app');
const { createAuthedUser } = require('./helpers');

describe('POST /api/auth/register', () => {
  it('rejects missing email or password', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('rejects passwords under 6 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@example.com', password: '123' });
    expect(res.status).toBe(400);
  });

  it('creates a user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('ada@example.com');
    // Never leak the password hash to the client.
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('rejects wrong credentials', async () => {
    await createAuthedUser({ email: 'login1@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login1@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('rejects an email that was never registered', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('logs in with correct credentials', async () => {
    await createAuthedUser({ email: 'login2@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login2@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });
});

describe('GET /api/auth/me', () => {
  it('rejects requests with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a garbage token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('returns the current user for a valid token', async () => {
    const user = await createAuthedUser({ email: 'me@example.com' });
    const res = await request(app).get('/api/auth/me').set('Authorization', user.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@example.com');
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('returns the same generic message for an unregistered email (no enumeration)', async () => {
    // Deliberately an email with no account — the controller returns early
    // before attempting to send mail, so this never touches SMTP.
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'unregistered@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/instruções/i);
  });
});
