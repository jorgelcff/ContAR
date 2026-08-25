const { test, expect } = require('./fixtures');

test.describe('Auth', () => {
  test('a new user can register and lands on their stories', async ({ page }) => {
    const email = `e2e-ui-${Date.now()}@example.com`;

    await page.goto('/login');
    await page.getByRole('button', { name: /criar uma/i }).click();

    await page.getByPlaceholder(/nome/i).fill('Playwright User');
    await page.getByPlaceholder(/email/i).fill(email);
    await page.getByPlaceholder(/senha/i).fill('password123');
    await page.getByRole('button', { name: /criar conta/i }).click();

    await expect(page).toHaveURL(/\/stories/);
  });

  test('rejects an incorrect password with a visible error, without navigating away', async ({ page, request }) => {
    const email = `e2e-wrongpw-${Date.now()}@example.com`;
    await request.post('http://localhost:3001/api/auth/register', {
      data: { email, password: 'password123' },
    });

    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill(email);
    await page.getByPlaceholder(/senha/i).fill('the-wrong-password');
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page.getByText(/inválid|incorret/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('an existing user can log in', async ({ page, request }) => {
    const email = `e2e-login-${Date.now()}@example.com`;
    await request.post('http://localhost:3001/api/auth/register', {
      data: { email, password: 'password123' },
    });

    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill(email);
    await page.getByPlaceholder(/senha/i).fill('password123');
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page).toHaveURL(/\/stories/);
  });

  test('logging out returns to the login page', async ({ authedPage }) => {
    await authedPage.goto('/stories');
    await authedPage.waitForLoadState('networkidle');

    await authedPage.getByRole('button', { name: 'Sair' }).click();
    await expect(authedPage).toHaveURL(/\/login/);
  });

  test('a protected route redirects to login without a session', async ({ page }) => {
    // Plain `page` (no auth fixture) — an anonymous visit to a protected route
    // must bounce to /login rather than rendering.
    await page.goto('/stories');
    await expect(page).toHaveURL(/\/login/);
  });
});
