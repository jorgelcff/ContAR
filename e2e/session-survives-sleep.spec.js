const { test, expect, registerUser } = require('./fixtures');

// A suspended host takes the better part of a minute to come back, and the
// first person through the door pays for it. That cold start used to read as
// "signed out": every failure deleted the stored token, so they landed on the
// login screen and reloading did not help either, because the token was gone.
test.describe('A session when the server is asleep', () => {
  test('a cold start waits instead of signing the person out', async ({ page, request }) => {
    test.setTimeout(60_000);
    const user = await registerUser(request);
    await page.addInitScript((t) => localStorage.setItem('auth:token', t), user.token);

    // The shape of a host that has not finished booting.
    let asleep = true;
    await page.route('**/api/auth/me', (route) => (
      asleep ? route.fulfill({ status: 502, body: 'Bad Gateway' }) : route.continue()
    ));

    await page.goto('/stories');

    await expect(page.getByRole('heading', { name: /acordando o servidor|waking the server/i }))
      .toBeVisible({ timeout: 20000 });
    // Not the login page, and the token is still there.
    await expect(page).toHaveURL(/\/stories$/);
    expect(await page.evaluate(() => localStorage.getItem('auth:token'))).toBe(user.token);

    // Once it is up, the session carries on — no re-login.
    asleep = false;
    await page.getByRole('button', { name: /tentar agora|try now/i }).click();
    await expect(page.getByRole('heading', { name: /minhas histórias|my stories/i }))
      .toBeVisible({ timeout: 20000 });
  });

  test('it recovers on its own, without anyone pressing anything', async ({ page, request }) => {
    test.setTimeout(60_000);
    const user = await registerUser(request);
    await page.addInitScript((t) => localStorage.setItem('auth:token', t), user.token);

    let attempts = 0;
    await page.route('**/api/auth/me', (route) => {
      attempts += 1;
      // Fails the first two tries, like a service still booting.
      return attempts <= 2 ? route.fulfill({ status: 503, body: '' }) : route.continue();
    });

    await page.goto('/stories');
    await expect(page.getByRole('heading', { name: /minhas histórias|my stories/i }))
      .toBeVisible({ timeout: 30000 });
    expect(attempts, 'it should have retried rather than given up').toBeGreaterThan(1);
  });

  test('a token the server actually rejects does end the session, and says why', async ({ page, request }) => {
    test.setTimeout(60_000);
    const user = await registerUser(request);
    await page.addInitScript((t) => localStorage.setItem('auth:token', t), user.token);

    // 401 is the one answer that means this token is no good.
    await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, body: '' }));

    await page.goto('/stories');
    await expect(page).toHaveURL(/\/login\?expired=1$/, { timeout: 20000 });
    await expect(page.getByText(/sua sessão terminou|your session ended/i)).toBeVisible();
    // And this time the token really is discarded.
    expect(await page.evaluate(() => localStorage.getItem('auth:token'))).toBeNull();
  });
});
