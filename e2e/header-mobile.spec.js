const { test, expect, registerUser } = require('./fixtures');

// Scenes, Stories, AR and Account were marked `hidden sm:inline-flex` with
// nothing taking their place below 640px, so a phone anywhere outside the
// editor had no way to reach any of them.
test.describe('The header on a phone', () => {
  const PHONE = { width: 390, height: 844 };

  async function signedIn(page, request) {
    const user = await registerUser(request);
    await page.addInitScript((t) => localStorage.setItem('auth:token', t), user.token);
  }

  test('every destination the desktop row offers is reachable', async ({ page, request }) => {
    test.setTimeout(60_000);
    await signedIn(page, request);
    await page.setViewportSize(PHONE);
    await page.goto('/stories');
    await page.getByRole('button', { name: /^menu$/i }).waitFor({ timeout: 15000 });

    // Closed by default — it must not cover the page it sits on.
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.getByRole('button', { name: /^menu$/i }).click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    for (const name of [/cenas/i, /histórias/i, /^ar$/i, /conta/i]) {
      await expect(menu.getByRole('menuitem', { name })).toBeVisible();
    }
  });

  test('choosing something navigates and closes the panel behind it', async ({ page, request }) => {
    test.setTimeout(60_000);
    await signedIn(page, request);
    await page.setViewportSize(PHONE);
    await page.goto('/stories');
    await page.getByRole('button', { name: /^menu$/i }).click();
    await page.getByRole('menuitem', { name: /cenas/i }).click();

    await expect(page).toHaveURL(/\/scenes$/);
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('it closes on Escape and on a click outside', async ({ page, request }) => {
    test.setTimeout(60_000);
    await signedIn(page, request);
    await page.setViewportSize(PHONE);
    await page.goto('/stories');

    await page.getByRole('button', { name: /^menu$/i }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.getByRole('button', { name: /^menu$/i }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.mouse.click(10, 400);
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('a signed-out visitor is offered only what they can actually open', async ({ page }) => {
    await page.setViewportSize(PHONE);
    // Not the landing page: it has its own navigation and does not render the
    // shared header at all. /ar does, and is reachable without an account.
    await page.goto('/ar');
    await page.getByRole('button', { name: /^menu$/i }).click();

    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: /^ar$/i })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /cenas|conta/i })).toHaveCount(0);
  });

  test('the desktop row is unchanged, and the menu button stays out of it', async ({ page, request }) => {
    test.setTimeout(60_000);
    await signedIn(page, request);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/stories');
    await page.getByRole('link', { name: /cenas/i }).first().waitFor({ timeout: 15000 });

    await expect(page.getByRole('button', { name: /^menu$/i })).toHaveCount(0);
  });
});

// The confirm-your-email banner had no way out. Confirming is what unlocks
// publishing, so it should come back — but being stuck with it while working
// is its own kind of rude.
//
// The E2E backend confirms accounts on creation (nothing here has a mailbox to
// click a link in), so the unconfirmed state is stubbed at /api/auth/me rather
// than manufactured in the database.
test.describe('Dismissing the confirm-your-email banner', () => {
  const unverified = (user) => async (route) => route.fulfill({
    json: { user: { id: 'u1', name: 'Test', email: user.email, emailVerified: false, createdAt: new Date().toISOString() } },
  });

  test('the X hides it, and it stays hidden for the rest of the visit', async ({ page, request }) => {
    test.setTimeout(60_000);
    const user = await registerUser(request);
    await page.route('**/api/auth/me', unverified(user));
    await page.addInitScript((t) => localStorage.setItem('auth:token', t), user.token);
    await page.goto('/stories');

    const banner = page.getByTestId('verify-email-banner');
    await expect(banner).toBeVisible({ timeout: 15000 });

    await banner.getByRole('button', { name: /esconder|hide|ocultar|masquer/i }).click();
    await expect(banner).toHaveCount(0);

    await page.goto('/account');
    await expect(banner).toHaveCount(0);
  });

  test('a fresh session sees it again — it is a nudge, not a decision', async ({ browser, request }) => {
    test.setTimeout(60_000);
    const user = await registerUser(request);

    const open = async () => {
      const ctx = await browser.newContext();
      await ctx.route('**/api/auth/me', unverified(user));
      await ctx.addInitScript((t) => localStorage.setItem('auth:token', t), user.token);
      const page = await ctx.newPage();
      await page.goto('/stories');
      return { ctx, page };
    };

    const first = await open();
    const banner1 = first.page.getByTestId('verify-email-banner');
    await expect(banner1).toBeVisible({ timeout: 15000 });
    await banner1.getByRole('button', { name: /esconder|hide|ocultar|masquer/i }).click();
    await expect(banner1).toHaveCount(0);
    await first.ctx.close();

    const second = await open();
    await expect(second.page.getByTestId('verify-email-banner')).toBeVisible({ timeout: 15000 });
    await second.ctx.close();
  });
});
