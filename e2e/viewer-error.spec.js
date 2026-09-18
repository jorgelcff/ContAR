const { test, expect, registerUser } = require('./fixtures');

const MISSING = '/story/22222222-2222-4222-8222-222222222222';

// This is the screen someone gets after scanning a code off a poster when the
// link does not work. It used to be one red English sentence and nothing else.
test.describe('When a story will not load', () => {
  test('a missing story explains itself and offers somewhere to go', async ({ page }) => {
    await page.goto(MISSING);

    await expect(page.getByRole('heading', { name: /não está disponível/i })).toBeVisible({ timeout: 15000 });
    // Not the raw server string, and not in English to a Portuguese browser.
    await expect(page.getByText('Story not found')).toHaveCount(0);

    // The offer that matters: they came to see a narrator and still can.
    await expect(page.getByRole('link', { name: /ver um narrador/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /o que é o contar/i })).toBeVisible();
    // Retrying a story that is gone would just fail again.
    await expect(page.getByRole('button', { name: /tentar de novo/i })).toHaveCount(0);
  });

  test('the demo link actually reaches the editor', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(MISSING);
    await page.getByRole('link', { name: /ver um narrador/i }).click();
    await expect(page).toHaveURL(/\/experimentar$/);
    await expect(page.getByText(/experimentando o contar/i)).toBeVisible();
  });

  test('a connection that failed offers to try again, and the retry works', async ({ page }) => {
    // Every attempt fails while the route is installed. Failing only the first
    // is not deterministic here: React re-runs effects in development, so the
    // load fires twice and the second one would sail through.
    await page.route('**/api/story/public/**', (route) => route.abort('failed'));
    await page.goto(MISSING);
    await expect(page.getByRole('heading', { name: /não foi possível alcançar/i })).toBeVisible({ timeout: 15000 });

    // Let it through, then retry: the screen has to change rather than stay
    // stuck on the failure it already showed.
    await page.unroute('**/api/story/public/**');
    await page.getByRole('button', { name: /tentar de novo/i }).click();
    await expect(page.getByRole('heading', { name: /não está disponível/i })).toBeVisible({ timeout: 15000 });
  });

  test('an author is told their story may simply not be published', async ({ page, request }) => {
    const user = await registerUser(request);
    await page.addInitScript((t) => localStorage.setItem('auth:token', t), user.token);
    await page.goto(MISSING);

    await expect(page.getByText(/talvez ainda não esteja publicada/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: /abrir minhas histórias/i })).toBeVisible();
  });

  test('a signed-out visitor is not told about publishing, which means nothing to them', async ({ page }) => {
    await page.goto(MISSING);
    await expect(page.getByRole('heading', { name: /não está disponível/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/talvez ainda não esteja publicada/i)).toHaveCount(0);
  });
});
