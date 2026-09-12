const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // The E2E backend is a single Node process — real, but deliberately
  // lightweight (in-memory Mongo, cheap bcrypt cost — see serve-e2e.js). At
  // full default parallelism (one worker per CPU core) the register/scene
  // -heavy tests could still pile up requests faster than it drains them,
  // occasionally timing out. Capped, the same suite is reliably green.
  workers: 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Both servers point at a throwaway in-memory MongoDB (see
  // backend/scripts/serve-e2e.js) — this suite never touches the real
  // Atlas database, on purpose.
  webServer: [
    {
      command: 'npm run serve:e2e --prefix backend',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev --prefix frontend -- --port 5173',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      // Force these regardless of frontend/.env — a developer's local .env
      // commonly points VITE_API_BASE_URL at a deployed backend (or sets
      // VITE_BASE_PATH for a subpath deploy) for manual testing. Without this
      // override the E2E frontend silently calls that real backend instead of
      // the disposable one above, which both breaks tests that mint a token
      // against the local backend and — far worse — creates real accounts and
      // data against production.
      env: { VITE_API_BASE_URL: 'http://localhost:3001', VITE_BASE_PATH: '' },
    },
  ],
});
