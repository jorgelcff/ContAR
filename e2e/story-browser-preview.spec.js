const { test, expect, registerUser } = require('./fixtures');
const { API_BASE } = require('./config');

// Watching a story used to mean publishing it first. The public story route
// 404'd on anything unpublished — for the author too — so the "View" button on
// their own story list dead-ended, the editor hid its preview link entirely,
// and the only way to see what you had built was a phone pointed at the room.
// These pin the browser path: an author can watch a draft, and a draft is still
// invisible to everyone else.
test.describe('Watching a story in the browser, without AR', () => {
  async function createDraft(request, token, title) {
    const res = await request.post(`${API_BASE}/api/story`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        metadata: { title, description: '' },
        scenes: [{ sceneId: '11111111-1111-4111-8111-111111111111', order: 0 }],
      },
    });
    return (await res.json()).storyId;
  }

  test('the author can open an unpublished story, and it is marked private', async ({ page, request }) => {
    const user = await registerUser(request);
    const storyId = await createDraft(request, user.token, 'Draft Preview Story');

    await page.addInitScript((token) => localStorage.setItem('auth:token', token), user.token);
    await page.goto(`/story/${storyId}`);

    // Two headings carry the title: the top bar and the start overlay.
    await expect(page.getByRole('heading', { name: 'Draft Preview Story' }).first()).toBeVisible({ timeout: 15000 });
    // Marked, so the author does not hand this URL to someone it 404s for.
    await expect(page.getByText(/prévia privada|private preview/i)).toBeVisible();
  });

  test('a signed-out visitor still cannot open that draft', async ({ page, request }) => {
    const user = await registerUser(request);
    const storyId = await createDraft(request, user.token, 'Hidden Draft Story');

    await page.goto(`/story/${storyId}`);
    await expect(page.getByText('Hidden Draft Story')).toHaveCount(0);
  });

  test('a published story opens for a signed-out visitor with no private badge', async ({ page, request }) => {
    const user = await registerUser(request);
    const storyId = await createDraft(request, user.token, 'Shared Story');
    await request.put(`${API_BASE}/api/story/${storyId}/publish`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: { isPublic: true },
    });

    await page.goto(`/story/${storyId}`);
    await expect(page.getByRole('heading', { name: 'Shared Story' }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/prévia privada|private preview/i)).toHaveCount(0);
  });
});
