const request = require('supertest');
const app = require('../app');
const User = require('../models/User');

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

  // Confirmed by default: that is the state of a real user who has been
  // through registration, and publishing now requires it. Tests about the
  // verification gate itself flip this back explicitly.
  if (overrides.emailVerified !== false) {
    await User.updateOne({ _id: res.body.user.id }, { emailVerified: true });
  }

  return {
    userId: res.body.user.id,
    email,
    password,
    token: res.body.token,
    authHeader: `Bearer ${res.body.token}`,
  };
}

module.exports = { createAuthedUser };
