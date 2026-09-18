const { test, expect, registerUser } = require('./fixtures');
const { API_BASE } = require('./config');

// Reaching the end used to do nothing: the bar filled, the controls greyed
// out, and the visitor was left on a still frame — at the moment they were
// most interested, and with no way to tell the story had even finished.
test.describe('When a story ends', () => {
  async function publish(request, token, { scenes = 1, durationSeconds = 1 } = {}) {
    const ids = [];
    for (let i = 0; i < scenes; i += 1) {
      const scene = await request.post(`${API_BASE}/api/scene`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          metadata: { title: `Cena ${i + 1}` },
          content: {
            avatar: { modelUrl: 'http://127.0.0.1:1/a.glb' },
            narrative: { text: `Cena número ${i + 1}`, language: 'pt' },
          },
        },
      });
      ids.push((await scene.json()).sceneId);
    }
    const story = await request.post(`${API_BASE}/api/story`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        metadata: { title: 'História do Pôster' },
        scenes: ids.map((sceneId, order) => ({ sceneId, order, durationSeconds, advanceOn: 'time' })),
      },
    });
    const { storyId } = await story.json();
    await request.put(`${API_BASE}/api/story/${storyId}/publish`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { isPublic: true },
    });
    return storyId;
  }

  test('the visitor is told it finished, and given somewhere to go', async ({ page, request }) => {
    test.setTimeout(60_000);
    const user = await registerUser(request);
    const storyId = await publish(request, user.token, { scenes: 2 });

    await page.goto(`/story/${storyId}`);
    await page.getByRole('button', { name: /iniciar|começar/i }).first().click();

    await expect(page.getByText(/^fim$/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /assistir de novo/i })).toBeVisible();
    // The one moment someone might want to make a story of their own.
    await expect(page.getByRole('link', { name: /criar a minha/i })).toBeVisible();
  });

  test('watching again really starts from the first scene', async ({ page, request }) => {
    test.setTimeout(60_000);
    const user = await registerUser(request);
    const storyId = await publish(request, user.token, { scenes: 2, durationSeconds: 30 });

    await page.goto(`/story/${storyId}`);
    await page.getByRole('button', { name: /iniciar|começar/i }).first().click();
    await expect(page.getByText('1/2', { exact: true })).toBeVisible();

    // Skip to the end with the controls rather than waiting out 60 seconds.
    await page.getByRole('button', { name: /próx/i }).first().click();
    await expect(page.getByText('2/2', { exact: true })).toBeVisible();
    await expect(page.getByText(/^fim$/i)).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /assistir de novo/i }).click();
    await expect(page.getByText(/^fim$/i)).toHaveCount(0);
    await expect(page.getByText('1/2', { exact: true })).toBeVisible();
  });
});
