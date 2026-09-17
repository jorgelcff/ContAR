const { test, expect, registerUser } = require('./fixtures');

async function dismissTourIfShown(page) {
  const skipTour = page.getByRole('button', { name: /pular/i });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
}

// Seeing a scene the way a viewer will meant saving it and opening the viewer
// in another tab. The control has to be on the canvas — reachable whichever
// side panel is open, and on a phone.
test.describe('Running a scene inside the editor', () => {
  test('the control is there, and says why it cannot play an empty scene', async ({ page, request }) => {
    const user = await registerUser(request);
    await page.addInitScript((token) => localStorage.setItem('auth:token', token), user.token);
    await page.goto('/editor');
    await page.locator('[data-tour="scene-canvas"]').waitFor({ timeout: 20000 });
    await dismissTourIfShown(page);

    const run = page.getByRole('button', { name: /reproduzir cena/i });
    await expect(run).toBeVisible();
    // Nothing to narrate yet.
    await expect(run).toBeDisabled();
  });

  test('typing narration enables it, and it turns into a stop control', async ({ page, request }) => {
    const user = await registerUser(request);
    await page.addInitScript((token) => localStorage.setItem('auth:token', token), user.token);
    await page.goto('/editor');
    await page.locator('[data-tour="scene-canvas"]').waitFor({ timeout: 20000 });
    await dismissTourIfShown(page);

    await page.locator('[data-tour="tab-fala"]').click();
    await dismissTourIfShown(page);
    const textarea = page.locator('textarea').first();
    await textarea.fill('Olá, esta é uma cena de teste.');
    await page.getByRole('button', { name: /definir texto da fala|definir fala/i }).first().click();

    const run = page.getByRole('button', { name: /reproduzir cena/i });
    await expect(run).toBeEnabled();
  });

  test('it sits over the canvas at phone width without pushing the layout', async ({ page, request }) => {
    const user = await registerUser(request);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((token) => localStorage.setItem('auth:token', token), user.token);
    await page.goto('/editor');
    await page.locator('[data-tour="scene-canvas"]').waitFor({ timeout: 20000 });
    await dismissTourIfShown(page);

    const run = page.getByRole('button', { name: /reproduzir cena/i });
    await expect(run).toBeVisible();
    const box = await run.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // Visible is not the same as reachable: it first sat underneath the bottom
    // navigation, which Playwright still reports as visible but a thumb cannot
    // press. Whatever is on top at the button's centre has to be the button.
    const topmostIsTheButton = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /reproduzir cena/i.test(b.textContent || ''));
      const r = btn.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top === btn || btn.contains(top);
    });
    expect(topmostIsTheButton, 'the run control is covered by something').toBe(true);
  });
});
