const { test, expect, registerUser } = require('./fixtures');
const { API_BASE } = require('./config');

// The cards in "Cenas na história" are a fixed width in a horizontal strip, so
// a control added to a row that already had three pushed the card's own text
// out past its edge. Anything put in one of these rows has to be checked
// against the card that holds it, not against the viewport.
test.describe('Scene cards in a story', () => {
  async function openStory(page, request, advanceOn) {
    const user = await registerUser(request);
    const scene = await request.post(`${API_BASE}/api/scene`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        metadata: { title: 'Uma cena com um título razoavelmente longo' },
        content: {
          avatar: { modelUrl: 'http://127.0.0.1:1/a.glb' },
          narrative: { text: 'Fala', language: 'pt' },
        },
      },
    });
    const { sceneId } = await scene.json();
    const story = await request.post(`${API_BASE}/api/story`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        metadata: { title: 'História' },
        scenes: [{ sceneId, order: 0, durationSeconds: 8, advanceOn }],
      },
    });
    const { storyId } = await story.json();

    await page.addInitScript((t) => localStorage.setItem('auth:token', t), user.token);
    await page.goto(`/editor?storyId=${storyId}`);
    await page.locator('[data-tour="scene-canvas"]').waitFor({ timeout: 20000 });
    const skip = page.getByRole('button', { name: /pular/i });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await page.locator('select').filter({ hasText: /segundos|narração/ }).first().waitFor({ timeout: 15000 });
  }

  /** Every control, measured against the card it sits in. */
  async function spillage(page) {
    return page.evaluate(() => {
      const card = document.querySelector('[data-scene-card]');
      if (!card) return ['o card não foi encontrado'];
      const c = card.getBoundingClientRect();
      const out = [];
      // Controls only. Text in here is truncated by an ancestor's overflow, so
      // its box legitimately extends past the card while no pixel of it does —
      // measuring that would fail on something that looks perfectly fine. The
      // regression being guarded is a row of controls too wide to fit.
      for (const el of card.querySelectorAll('select, input, button')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.right > c.right + 1) out.push(`${el.tagName} passa ${Math.round(r.right - c.right)}px da borda direita`);
        if (r.left < c.left - 1) out.push(`${el.tagName} passa ${Math.round(c.left - r.left)}px da borda esquerda`);
      }
      return out;
    });
  }

  for (const advanceOn of ['time', 'narration']) {
    test(`nothing spills out of the card when it ends by ${advanceOn}`, async ({ page, request }) => {
      test.setTimeout(60_000);
      await openStory(page, request, advanceOn);
      expect(await spillage(page)).toEqual([]);
    });
  }

  test('the seconds box is there for a timed scene and gone for a narrated one', async ({ page, request }) => {
    test.setTimeout(60_000);
    await openStory(page, request, 'time');
    const seconds = page.locator('input[type="number"]');
    await expect(seconds.first()).toBeVisible();

    // Not disabled — removed. A greyed-out box still reads as something to
    // fill in, and here it means nothing at all.
    await page.locator('select').filter({ hasText: /segundos|narração/ }).first().selectOption('narration');
    await expect(seconds).toHaveCount(0);
    await expect(page.getByText(/dura o tempo da narração/i)).toBeVisible();
  });
});
