// Boots the API against a throwaway in-memory MongoDB instead of the real
// Atlas cluster. Used only by the E2E test suite (see playwright.config.js) —
// never run this against a real MONGODB_URI.
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'e2e_only_secret_do_not_use_in_prod';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

const app = require('../app');

const PORT = process.env.PORT || 3001;

(async () => {
  const mongod = await MongoMemoryServer.create();
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
