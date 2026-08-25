const request = require('supertest');
const app = require('../app');

let counter = 0;

// Registers a fresh user and returns their id + a ready-to-use Authorization
// header, so scene/story tests don't have to repeat the auth dance.
async function createAuthedUser(overrides = {}) {
  counter += 1;
  const email = overrides.email || `test${counter}-${Date.now()}@example.com`;
  const password = overrides.password || 'password123';

  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: overrides.name || 'Test User', email, password });

  return {
    userId: res.body.user.id,
    email,
    password,
    token: res.body.token,
    authHeader: `Bearer ${res.body.token}`,
  };
}

module.exports = { createAuthedUser };
