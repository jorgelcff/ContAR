const { test, expect, VIEWPORTS } = require('./fixtures');

async function scrollWidth(page) {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

test.describe('no horizontal overflow — public pages', () => {
  const pages = [
    { path: '/', name: 'landing' },
    { path: '/login', name: 'login' },
    { path: '/ar', name: 'AR mode menu' },
  ];

  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    test.describe(`${vpName} (${vp.width}px)`, () => {
      test.use({ viewport: vp });

      for (const { path, name } of pages) {
        test(`${name} fits the viewport`, async ({ page }) => {
          await page.goto(path);
          await page.waitForLoadState('networkidle');
          const width = await scrollWidth(page);
          expect(width, `${name} scrollWidth vs ${vp.width}px viewport`).toBeLessThanOrEqual(vp.width + 2);
        });
      }
    });
  }
});

test.describe('no horizontal overflow — authenticated pages', () => {
  const pages = [
    { path: '/editor', name: 'editor (blank)' },
    { path: '/scenes', name: 'scenes list' },
    { path: '/stories', name: 'stories list' },
    { path: '/account', name: 'account' },
  ];

  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    test.describe(`${vpName} (${vp.width}px)`, () => {
      test.use({ viewport: vp });

      for (const { path, name } of pages) {
        test(`${name} fits the viewport`, async ({ authedPage }) => {
          await authedPage.goto(path);
          if (path === '/editor') {
            // The 3D viewport keeps a render loop going, so this page never
            // truly reaches networkidle — wait for a landmark instead. The
            // tab bar itself is desktop-only (hidden md:flex), so use
            // something visible at every width: the header's logout button.
            await authedPage.getByRole('button', { name: 'Sair' }).waitFor();
          } else {
            await authedPage.waitForLoadState('networkidle');
          }
          const width = await scrollWidth(authedPage);
          expect(width, `${name} scrollWidth vs ${vp.width}px viewport`).toBeLessThanOrEqual(vp.width + 2);
        });
      }
    });
  }
});

// The one page every visitor who scans a QR code lands on, and the one that
// was not covered here — while /editor, /scenes and /account all were. They
// arrive on a phone, from a poster, with nobody to help them.
test.describe('no horizontal overflow — a shared story', () => {
  const { registerUser } = require('./fixtures');
  const { API_BASE } = require('./config');

  async function publishedStory(request) {
    const user = await registerUser(request);
    const scene = await request.post(`${API_BASE}/api/scene`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        metadata: { title: 'Cena' },
        content: {
          // Refuses instantly rather than spending the test waiting on a host
          // that was never going to answer.
          avatar: { modelUrl: 'http://127.0.0.1:1/a.glb' },
          narrative: { text: 'Uma narração longa o suficiente para testar a quebra de linha na tela', language: 'pt' },
        },
      },
    });
    const { sceneId } = await scene.json();
    const story = await request.post(`${API_BASE}/api/story`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        metadata: { title: 'Uma história com um título razoavelmente longo', description: 'E uma descrição também.' },
        scenes: [{ sceneId, order: 0, durationSeconds: 30 }],
      },
    });
    const { storyId } = await story.json();
    await request.put(`${API_BASE}/api/story/${storyId}/publish`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: { isPublic: true },
    });
    return storyId;
  }

  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    test.describe(`${vpName} (${vp.width}px)`, () => {
      test.use({ viewport: vp });

      test('the shared story page fits the viewport', async ({ page, request }) => {
        test.setTimeout(60_000);
        const storyId = await publishedStory(request);
        await page.goto(`/story/${storyId}`);
        // The canvas keeps a render loop going, so networkidle never arrives.
        await page.getByRole('heading').first().waitFor({ timeout: 20000 });
        const width = await scrollWidth(page);
        expect(width, `shared story scrollWidth vs ${vp.width}px viewport`).toBeLessThanOrEqual(vp.width + 2);
      });
    });
  }
});
