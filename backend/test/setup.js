const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Tests must never touch the real (Atlas) database — point mongoose at a
// throwaway in-memory instance before any test file's requests can run.
process.env.AUTH_JWT_SECRET = 'test_only_secret_do_not_use_in_prod';
process.env.NODE_ENV = 'test';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  // Isolate tests from each other without paying to restart the server.
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
