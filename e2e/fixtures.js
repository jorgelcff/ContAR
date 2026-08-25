const base = require('@playwright/test');

const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

const AUTH_TOKEN_KEY = 'auth:token';

async function registerUser(request) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request.post('http://localhost:3001/api/auth/register', {
    data: { name: 'E2E User', email, password: 'password123' },
  });
  const body = await res.json();
  return { email, password: 'password123', token: body.token, userId: body.user?.id };
}

// Extends the base test with:
//   - `theme`: pass via test.use({ theme: 'light' }) — defaults to dark.
//   - `authedPage`: a page pre-logged-in as a fresh, disposable user (registered
//     directly against the E2E backend's in-memory database — see
//     backend/scripts/serve-e2e.js). Never touches the real account/database.
const test = base.test.extend({
  theme: ['dark', { option: true }],

  page: async ({ page, theme }, use) => {
    await page.addInitScript((t) => {
      localStorage.setItem('contar:theme', t);
    }, theme);
    await use(page);
  },

  authedPage: async ({ page, request, theme }, use) => {
    const user = await registerUser(request);
    await page.addInitScript(
      ({ key, token, t }) => {
        localStorage.setItem(key, token);
        localStorage.setItem('contar:theme', t);
        // A brand-new user would otherwise see the onboarding + tour modals on
        // first editor visit — irrelevant to what these tests check.
        localStorage.setItem('avaturn:onboarding:done', '1');
        localStorage.setItem('contar:tour-done', '1');
      },
      { key: AUTH_TOKEN_KEY, token: user.token, t: theme },
    );
    await use(page);
  },
});

const expect = base.expect;

module.exports = { test, expect, VIEWPORTS, registerUser };
