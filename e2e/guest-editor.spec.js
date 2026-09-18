const { test, expect } = require('./fixtures');

// The funnel leaked hardest here: someone watches a story, taps "make your
// own", and lands on a sign-up form having touched nothing. At a stand that is
// where almost everyone stops.
test.describe('Trying the editor without an account', () => {
  test('a stranger gets a character and a line, with no account and no redirect', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/experimentar');

    // Not bounced to login the way /editor would.
    await expect(page).toHaveURL(/\/experimentar$/);
    await expect(page.getByText(/experimentando o contar|trying contar/i)).toBeVisible();
    await page.locator('[data-tour="scene-canvas"]').waitFor({ timeout: 20000 });

    // Seeded, so the studio is not empty — an empty studio demonstrates nothing.
    await page.locator('[data-tour="tab-fala"]').click();
    const box = page.locator('textarea').first();
    await expect(box).not.toHaveValue('');
  });

  test('the words can be changed and played without signing in', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/experimentar');
    await page.locator('[data-tour="scene-canvas"]').waitFor({ timeout: 20000 });
    await page.locator('[data-tour="tab-fala"]').click();

    await page.locator('textarea').first().fill('Uma frase que eu acabei de escrever');
    await page.getByRole('button', { name: /definir texto da fala|definir fala/i }).first().click();

    // The browser's own voice needs no server, so this is the part that has to
    // work before anyone is asked for anything.
    await expect(page.getByRole('button', { name: /reproduzir cena/i })).toBeEnabled();
  });

  test('saving asks for an account instead of failing silently', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/experimentar');
    await page.locator('[data-tour="scene-canvas"]').waitFor({ timeout: 20000 });
    await page.locator('[data-tour="tab-historia"]').click();

    await page.getByRole('button', { name: /adicionar cena|salvar história/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('link', { name: /criar conta/i })).toBeVisible();

    // And it is an invitation, not a wall: they can go back to playing.
    await dialog.getByRole('button', { name: /continuar explorando/i }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('nothing is autosaved, so nothing 401s in the background', async ({ page }) => {
    test.setTimeout(60_000);
    const writes = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/api\/scene/.test(r.url())) writes.push(r.url());
    });

    await page.goto('/experimentar');
    await page.locator('[data-tour="scene-canvas"]').waitFor({ timeout: 20000 });
    await page.locator('[data-tour="tab-fala"]').click();
    await page.locator('textarea').first().fill('Editando sem conta nenhuma');
    // Autosave fires five idle seconds after a change — wait past it.
    await page.waitForTimeout(8000);

    expect(writes, 'a guest has nowhere to autosave to').toEqual([]);
  });
});
