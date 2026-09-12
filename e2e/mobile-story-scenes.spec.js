const { test, expect, VIEWPORTS } = require('./fixtures');

// StoryBuilderPanel (the desktop scene-list manager) is hidden md:block and
// its reordering is drag/mouse-only, so mobile users had no way at all to
// see, reorder, edit, or remove scenes from a story. MobileStoryScenes is
// the touch-friendly counterpart, rendered only below md. LeftPanel renders
// its whole tab content twice (once inside the always-in-DOM desktop aside,
// once inside the mobile drawer), so every query here is scoped to the
// :visible instance to avoid matching the hidden desktop copy too.
test.describe('Editor — mobile story scene list', () => {
  test.use({ viewport: VIEWPORTS.mobile });
  // Two scenes added in sequence, each a real round-trip — under full-suite
  // parallelism this can outrun the default timeout on the shared E2E
  // backend even though every step succeeds; see full-journey.spec.js.
  test.describe.configure({ timeout: 60_000 });

  test('scenes can be seen, reordered with tap buttons, and removed', async ({ authedPage }) => {
    await authedPage.goto('/editor');
    const bottomNav = authedPage.locator('nav');
    await bottomNav.waitFor({ timeout: 15000 });

    await bottomNav.getByText('Cena').click();
    for (const title of ['Primeira Cena', 'Segunda Cena']) {
      await authedPage.getByPlaceholder('Minha Cena').last().fill(title);
      await authedPage.getByRole('button', { name: /concluir cena e adicionar/i }).click();
      await authedPage.waitForTimeout(400);
    }

    await bottomNav.getByText('História').click();

    const list = authedPage.locator('[data-testid="mobile-story-scenes"]:visible');
    await expect(list).toBeVisible();
    const upButtons = list.locator('button[title="Mover para cima"]');
    await expect(upButtons).toHaveCount(2);
    await expect(list.getByText('#1 Primeira Cena')).toBeVisible();
    await expect(list.getByText('#2 Segunda Cena')).toBeVisible();

    // Move the second scene up — one tap, no drag needed.
    await upButtons.nth(1).click();
    await expect(list.getByText('#1 Segunda Cena')).toBeVisible();
    await expect(list.getByText('#2 Primeira Cena')).toBeVisible();

    // Remove the first row (now "Segunda Cena" after the reorder above).
    await list.locator('button[title="Remover da história"]').first().click();
    await expect(list.getByText(/remover esta cena da história/i)).toBeVisible();
    await list.getByRole('button', { name: /^remover$/i }).click();
    await expect(list.getByText('#1 Primeira Cena')).toBeVisible();
    await expect(list.getByText(/segunda cena/i)).toHaveCount(0);
  });
});
