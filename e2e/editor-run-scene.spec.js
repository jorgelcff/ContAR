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
      // By label, not text: the control is a round icon button with no words
      // in it, so it can sit beside a caption at any width.
      const btn = [...document.querySelectorAll('button')]
        .find((b) => /reproduzir cena|parar/i.test(b.getAttribute('aria-label') || ''));
      const r = btn.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top === btn || btn.contains(top);
    });
    expect(topmostIsTheButton, 'the run control is covered by something').toBe(true);
  });
});

// Narration captions are centred along the bottom of the canvas and grow
// upward. The play control was centred there too, so switching subtitles on
// put the text straight over it.
test.describe('The play control and the caption', () => {
  async function editorWithSubtitles(page, request) {
    const user = await registerUser(request);
    await page.addInitScript((token) => localStorage.setItem('auth:token', token), user.token);
    await page.goto('/editor');
    await page.locator('[data-tour="scene-canvas"]').waitFor({ timeout: 20000 });
    await dismissTourIfShown(page);
    await page.locator('[data-tour="tab-fala"]').click();
    await dismissTourIfShown(page);

    await page.locator('textarea').first().fill(
      'Uma narração comprida o bastante para a legenda ocupar bastante espaço na base do canvas e subir algumas linhas.',
    );
    await page.getByRole('button', { name: /definir texto da fala|definir fala/i }).first().click();
    await page.getByRole('button', { name: /^legenda$/i }).click();
    await page.getByTestId('narration-caption').waitFor({ timeout: 15000 });
  }

  test('they do not overlap once subtitles are on', async ({ page, request }) => {
    test.setTimeout(60_000);
    await editorWithSubtitles(page, request);

    const overlap = await page.evaluate(() => {
      const caption = document.querySelector('[data-testid="narration-caption"]');
      const play = [...document.querySelectorAll('button')]
        .find((b) => /reproduzir cena|parar/i.test(b.getAttribute('aria-label') || ''));
      if (!caption || !play) return { missing: !caption ? 'caption' : 'play' };
      const a = caption.getBoundingClientRect();
      const b = play.getBoundingClientRect();
      const intersects = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return { intersects };
    });

    expect(overlap.missing, `${overlap.missing} not found`).toBeUndefined();
    expect(overlap.intersects, 'the play control sits under the caption').toBe(false);
  });

  test('it is still reachable — nothing covers it', async ({ page, request }) => {
    test.setTimeout(60_000);
    await editorWithSubtitles(page, request);

    const topmostIsThePlay = await page.evaluate(() => {
      const play = [...document.querySelectorAll('button')]
        .find((b) => /reproduzir cena|parar/i.test(b.getAttribute('aria-label') || ''));
      const r = play.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top === play || play.contains(top);
    });
    expect(topmostIsThePlay).toBe(true);
  });
});
