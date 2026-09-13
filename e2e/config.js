// The E2E stack runs on its own ports so it can never attach to a Docker (or
// plain `npm run dev`) stack that happens to be up on the usual 3001/5173.
// Sharing them was silently wrong in two ways: the suite ran against whatever
// image was last built rather than the working tree, and it hit the production
// auth rate limit (100 requests / 15 min) instead of the disposable backend's
// 2000, so a long run failed with "Too many requests" that looked like real
// regressions. It also wrote test users and stories into the dev database.
const API_PORT = 3101;
const APP_PORT = 5273;

const API_BASE = `http://localhost:${API_PORT}`;
const APP_BASE = `http://localhost:${APP_PORT}`;

module.exports = { API_PORT, APP_PORT, API_BASE, APP_BASE };
