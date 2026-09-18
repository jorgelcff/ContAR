const { test, expect, registerUser } = require('./fixtures');
const { API_BASE } = require('./config');

// The scenario this exists for: a QR code left at a poster in a session the
// author is not attending. Whoever scans it gets whatever language their own
// browser asks for, because there is nobody standing there to switch it.
test.describe('One story, several languages', () => {
  async function publishStory(request, token) {
    const scene = await request.post(`${API_BASE}/api/scene`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        metadata: { title: 'Cena' },
        content: {
          // A host that refuses instantly: a real one spends the test's budget
        // waiting for a fetch that was never going to succeed.
        avatar: { modelUrl: 'http://127.0.0.1:1/a.glb' },
          narrative: {
            text: 'Olá, seja bem-vindo ao ContAR',
            audioUrl: 'http://127.0.0.1:1/pt.wav',
            language: 'pt',
            translations: {
              en: { text: 'Hello, welcome to ContAR', audioUrl: 'http://127.0.0.1:1/en.wav' },
              es: { text: 'Hola, bienvenido a ContAR' },
            },
          },
        },
      },
    });
    const { sceneId } = await scene.json();

    const story = await request.post(`${API_BASE}/api/story`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { metadata: { title: 'Multi' }, scenes: [{ sceneId, order: 0, durationSeconds: 30 }] },
    });
    const { storyId } = await story.json();
    await request.put(`${API_BASE}/api/story/${storyId}/publish`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { isPublic: true },
    });
    return storyId;
  }

  const cases = [
    ['pt-BR', false],
    ['en-US', false],
    ['es-ES', false],
    // A browser asking for a language the interface does not carry is put into
    // English, so this visitor gets the English narration rather than the
    // Portuguese original — the better outcome, and worth pinning.
    ['de-DE', false],
    // French the interface does speak, and this story has no French narration.
    // The original plays and the viewer says so instead of substituting in
    // silence.
    ['fr-FR', true],
  ];

  for (const [locale, isFallback] of cases) {
    test(`a visitor whose browser is ${locale} gets the right narration`, async ({ browser, request }) => {
      // Registering, building a scene, a story and publishing it, then loading
      // the viewer — more than the default allows under parallel load.
      test.setTimeout(60_000);
      const user = await registerUser(request);
      const storyId = await publishStory(request, user.token);

      const ctx = await browser.newContext({ locale });
      const page = await ctx.newPage();
      await page.goto(`/story/${storyId}`);
      await expect(page.getByRole('heading', { name: 'Multi' }).first()).toBeVisible({ timeout: 15000 });

      const fallbackNotice = page.getByText(
        /tocando o original|playing the original|reproduciendo el original|lecture de l'original/i,
      );
      if (isFallback) await expect(fallbackNotice).toBeVisible();
      else await expect(fallbackNotice).toHaveCount(0);

      await ctx.close();
    });
  }

  test('a visitor can switch language, and only to ones that exist', async ({ browser, request }) => {
    test.setTimeout(60_000);
    const user = await registerUser(request);
    const storyId = await publishStory(request, user.token);

    const ctx = await browser.newContext({ locale: 'pt-BR' });
    const page = await ctx.newPage();
    await page.goto(`/story/${storyId}`);
    await expect(page.getByRole('heading', { name: 'Multi' }).first()).toBeVisible({ timeout: 15000 });

    // Not `select` — the header's interface-language switcher is the first one
    // on the page, and picking it made this assert against the wrong control.
    const picker = page.getByTestId('narration-language');
    await expect(picker).toBeVisible();
    const offered = await picker.locator('option').allInnerTexts();
    // French was never written, so it is not offered — a switcher that
    // dead-ends the visitor is worse than no switcher.
    expect(offered.sort()).toEqual(['EN', 'ES', 'PT']);

    await picker.selectOption('en');
    await expect(page.getByText(/tocando o original|playing the original/i)).toHaveCount(0);

    await ctx.close();
  });
});

// Authoring side: the picker in the Fala tab is what makes one scene carry
// several languages at all.
test.describe('Writing a scene in more than one language', () => {
  async function openFala(page) {
    await page.locator('[data-tour="scene-canvas"]').waitFor({ timeout: 20000 });
    const skip = page.getByRole('button', { name: /pular/i });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await page.locator('[data-tour="tab-fala"]').click();
    if (await skip.isVisible().catch(() => false)) await skip.click();
  }

  test('a line typed in one language does not follow you into the next', async ({ page, request }) => {
    test.setTimeout(60_000);
    const user = await registerUser(request);
    await page.addInitScript((t) => localStorage.setItem('auth:token', t), user.token);
    await page.goto('/editor');
    await openFala(page);

    const box = page.locator('textarea').first();
    await box.fill('Olá, bem-vindo ao ContAR');
    await page.getByRole('button', { name: /^EN$/ }).first().click();

    // The defect this pins: the Portuguese draft stayed in the box and looked
    // like it had become the English line.
    await expect(box).toHaveValue('');

    await box.fill('Hello, welcome to ContAR');
    await page.getByRole('button', { name: /^PT$/ }).first().click();
    // And back again — neither language has eaten the other.
    await expect(box).toHaveValue('Olá, bem-vindo ao ContAR');
  });
});
