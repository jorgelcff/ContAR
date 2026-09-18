const request = require('supertest');
const app = require('../app');
const { createAuthedUser } = require('./helpers');

// The routes that cost money or storage had no tests at all. Two properties
// matter here and neither was pinned: that they cannot be reached without an
// account, and that their budget is counted per account rather than per
// address — behind one venue's NAT the latter is one budget for the room.
describe('the endpoints that spend money', () => {
  const routes = [
    { name: 'TTS',          method: 'post',   path: '/api/tts/generate',  body: { text: 'olá' } },
    { name: 'bone mapping', method: 'post',   path: '/api/bones/map',     body: { bones: ['Hips'] } },
    { name: 'audio upload', method: 'post',   path: '/api/media/audio',   body: {} },
    { name: 'audio delete', method: 'delete', path: '/api/media/audio',   body: { url: 'https://x/y.mp3' } },
    { name: 'model upload', method: 'post',   path: '/api/media/model',   body: {} },
  ];

  for (const route of routes) {
    it(`${route.name} refuses anonymous callers`, async () => {
      const res = await request(app)[route.method](route.path).send(route.body);
      expect(res.status).toBe(401);
    });
  }

  // Bone mapping was the one genuinely open door: no account, just a POST, and
  // it asks OpenAI to name a rig's bones. A rate limit bounded how fast the
  // credit could be spent, not who could spend it.
  it('bone mapping is not reachable with a bad token either', async () => {
    const res = await request(app)
      .post('/api/bones/map')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ bones: ['Hips'] });
    expect(res.status).toBe(401);
  });
});

describe('bone mapping, once signed in', () => {
  const prevKey = process.env.OPENAI_API_KEY;
  afterEach(() => {
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
  });

  async function post(user, body) {
    return request(app).post('/api/bones/map').set('Authorization', user.authHeader).send(body);
  }

  it('validates the request before it ever reaches OpenAI', async () => {
    const user = await createAuthedUser();
    // Deliberately with a key present: these must be refused on their own
    // merits, not because the deployment happens to be unconfigured.
    process.env.OPENAI_API_KEY = 'sk-not-a-real-key';

    expect((await post(user, {})).status).toBe(400);
    expect((await post(user, { bones: [] })).status).toBe(400);
    expect((await post(user, { bones: 'Hips' })).status).toBe(400);
    // Length caps: the array, and each name — 300 unbounded strings would be a
    // blank cheque against the key.
    expect((await post(user, { bones: new Array(301).fill('Hips') })).status).toBe(400);
    expect((await post(user, { bones: ['x'.repeat(101)] })).status).toBe(400);
  });

  it('says the feature is unconfigured rather than failing obscurely', async () => {
    const user = await createAuthedUser();
    delete process.env.OPENAI_API_KEY;
    const res = await post(user, { bones: ['Hips', 'Spine'] });
    expect(res.status).toBe(503);
  });
});

describe('budgets are per account, not per address', () => {
  // Same address, two accounts: one spending its budget must not touch the
  // other's. This is the whole point of the change — a room shares an IP.
  it('counts TTS separately for each account', async () => {
    const first = await createAuthedUser();
    const second = await createAuthedUser();

    const a = await request(app).post('/api/tts/generate')
      .set('Authorization', first.authHeader).send({ text: 'um' });
    const b = await request(app).post('/api/tts/generate')
      .set('Authorization', second.authHeader).send({ text: 'dois' });

    expect(Number(a.headers['ratelimit-remaining'])).toBe(Number(b.headers['ratelimit-remaining']));
  });

  it('spends one account\'s upload budget without touching another\'s', async () => {
    const heavy = await createAuthedUser();
    const quiet = await createAuthedUser();

    let heavyRemaining = null;
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).post('/api/media/audio').set('Authorization', heavy.authHeader);
      heavyRemaining = Number(res.headers['ratelimit-remaining']);
    }
    const quietRes = await request(app).post('/api/media/audio').set('Authorization', quiet.authHeader);
    const quietRemaining = Number(quietRes.headers['ratelimit-remaining']);

    expect(quietRemaining).toBeGreaterThan(heavyRemaining);
  });
});

// The isolation used to be accidental: the suite never reached the real media
// account or mailbox because app.js happens not to load dotenv, and because no
// test happens to attach a file. Both are true today and neither is enforced
// by anything. Adding `require('dotenv').config()` to app.js is a one-line
// change that looks harmless and would hand every test run the production
// credentials — this is what would fail.
describe('the test environment holds no real credentials', () => {
  const mustBeEmpty = [
    'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
    'SMTP_USER', 'SMTP_PASS',
    'OPENAI_API_KEY', 'AZURE_SPEECH_KEY', 'ELEVENLABS_API_KEY',
  ];

  for (const name of mustBeEmpty) {
    it(`${name} is not set`, () => {
      expect(
        process.env[name] || '',
        `${name} is set during tests — a run could reach the real service`,
      ).toBe('');
    });
  }

  it('uploads fall back to disk, so nothing can reach the real media account', async () => {
    const { cloudinaryConfigured } = require('../config/cloudinary');
    expect(cloudinaryConfigured, 'tests must never upload to the real account').toBe(false);
  });
});
