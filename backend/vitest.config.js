const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.js'],
    testTimeout: 20000,
    // Generous, because a cold mongod start now waits up to a minute.
    hookTimeout: 90000,
    // Each file boots its own mongod; letting every file start at once is what
    // made them time out. Four at a time keeps the suite parallel without the
    // stampede.
    poolOptions: { threads: { maxThreads: 4 } },
  },
});
