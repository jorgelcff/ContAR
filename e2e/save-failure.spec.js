const { test, expect, registerUser } = require('./fixtures');

// The editor autosaves every few seconds, so what it does when a save does not
// land decides whether the user loses work. The handling existed but nothing
// exercised it — these drive the two ways a save goes wrong.
test.describe('When a save does not land', () => {
  test('a failed autosave warns and keeps the text on screen', async ({ page, request }) => {
    test.setTimeout(60_000);
    const user = await registerUser(request);
    await page.addInitScript((token) => {
      localStorage.setItem('auth:token', token);
      localStorage.setItem('avaturn:onboarding:done', '1');
      localStorage.setItem('contar:tour-done', '1');
    }, user.token);

    await page.route('**/api/scene', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' });
        return;
      }
      await route.continue();
    });

    await page.goto('/editor');
    await page.locator('[data-tour="tab-cena"]').click();
    const title = page.getByPlaceholder('Minha Cena').first();
    await title.fill('Trabalho que não pode sumir');

    // Autosave is debounced a few seconds; the warning follows the failure.
    await expect(page.getByText(/não foi possível salvar|falha ao salvar|erro ao salvar/i).first())
      .toBeVisible({ timeout: 25_000 });

    // The edit is still in the editor — a failed save must not discard it.
    await expect(title).toHaveValue('Trabalho que não pode sumir');
  });

  test('a scene changed elsewhere is reported instead of being overwritten', async ({ page, request }) => {
    test.setTimeout(60_000);
    const user = await registerUser(request);
    await page.addInitScript((token) => {
      localStorage.setItem('auth:token', token);
      localStorage.setItem('avaturn:onboarding:done', '1');
      localStorage.setItem('contar:tour-done', '1');
    }, user.token);

    // Stand in for another tab having saved after this one loaded.
    await page.route('**/api/scene', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'This scene was changed somewhere else' }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/editor');
    await page.locator('[data-tour="tab-cena"]').click();
    await page.getByPlaceholder('Minha Cena').first().fill('Editando em duas abas');

    await expect(page.getByText(/outra aba|outro dispositivo/i).first())
      .toBeVisible({ timeout: 25_000 });
  });
});
