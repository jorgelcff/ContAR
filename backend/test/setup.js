const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Tests must never touch the real (Atlas) database — point mongoose at a
// throwaway in-memory instance before any test file's requests can run.
process.env.AUTH_JWT_SECRET = 'test_only_secret_do_not_use_in_prod';
process.env.NODE_ENV = 'test';

let mongod;

// Every test file starts its own mongod, and vitest runs files in parallel, so
// a handful of them race to boot at once on one machine. The library's default
// launch window is ten seconds, which several of them missed — the whole file
// then failed before a single test ran, reported as "N tests skipped", which
// reads like a catastrophe rather than a slow start. A longer window and one
// retry cost nothing when things are healthy.
const LAUNCH_TIMEOUT_MS = 60_000;

async function startMongo(attemptsLeft = 2) {
  try {
    return await MongoMemoryServer.create({ instance: { launchTimeout: LAUNCH_TIMEOUT_MS } });
  } catch (err) {
    if (attemptsLeft <= 0) throw err;
    console.warn(`[test] mongod did not start (${err.message}) — retrying`);
    return startMongo(attemptsLeft - 1);
  }
}

beforeAll(async () => {
  mongod = await startMongo();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  // Isolate tests from each other without paying to restart the server.
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  // Guarded: when the start above failed outright there is nothing to stop,
  // and the resulting TypeError buried the real reason the file failed.
  if (mongod) await mongod.stop();
});
