// Boots the API against a throwaway in-memory MongoDB instead of the real
// Atlas cluster. Used only by the E2E test suite (see playwright.config.js) —
// never run this against a real MONGODB_URI.
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'e2e_only_secret_do_not_use_in_prod';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
// A full E2E run registers a fresh disposable user per test — well over the
// production default of 100/15min. Without this, the shared register+login
// limiter silently 429s partway through the suite, and every test after that
// point fails in a way that looks unrelated to rate limiting.
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX || '2000';
// bcrypt's cost factor is deliberately CPU-expensive — the right call for
// real passwords, but a fresh-user-per-test suite doesn't need production
// -grade hashing and the cost was enough to bottleneck this single-threaded
// dev process under parallel test load (requests queuing up, some timing out
// with ECONNRESET). A low cost here only weakens throwaway E2E accounts in
// an in-memory DB that's destroyed when the process exits.
process.env.BCRYPT_COST = process.env.BCRYPT_COST || '4';
// This process loads the real backend/.env, so it inherits real SMTP
// credentials. A suite run registers dozens of throwaway users, and sending is
// gated on these being present — leaving them set would fire that many real
// messages from the developer's own mailbox at fake addresses on every run.
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
// Which leaves no mailbox to click a confirmation link in, and publishing now
// requires a confirmed account. Opt-in, and only ever set here.
process.env.AUTO_VERIFY_EMAIL = '1';

const app = require('../app');

const PORT = process.env.PORT || 3001;

(async () => {
  // Same launch window as the unit-test setup: the library's ten-second
  // default was missed often enough on this machine to fail whole runs before
  // a single test executed, and the symptom (a webServer that "was not able to
  // start") points nowhere near the cause.
  const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  await mongoose.connect(mongod.getUri());
  console.log('[e2e] in-memory MongoDB ready');

  app.listen(PORT, () => console.log(`[e2e] backend running on port ${PORT}`));

  const shutdown = async () => {
    await mongoose.disconnect();
    await mongod.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
