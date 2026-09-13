const { test, expect, registerUser } = require('./fixtures');
const { API_BASE } = require('./config');

// The onboarding tour occasionally reappeared mid-test under heavy parallel
// load (slow network responses left the app on an intermediate render for
// longer than usual) — dismiss it defensively wherever it might show, rather
// than only once at the start.
async function dismissTourIfShown(page) {
  const skipTour = page.getByRole('button', { name: /pular/i });
  if (await skipTour.isVisible().catch(() => false)) {
    await skipTour.click();
  }
}

// Regression tests for the publish/draft rework: saving a story used to be
// indistinguishable from publishing it (both buttons called the exact same
// handler), so every saved story was already reachable via its public link.
// Now a story is a private draft until explicitly published, and can be
// unpublished again — these guard the full state machine end to end.
test.describe('Story publish / draft state', () => {
  test('draft stays private; publish reveals the share link; unpublish hides it again', async ({ page, request }) => {
    test.setTimeout(60_000);
    const user = await registerUser(request);
    // handleSaveStory (which publishing calls first) refuses to save a story
    // with zero scenes — needs at least one, even a made-up id, since the
    // save endpoint only validates the UUID shape, not that it exists.
    const storyRes = await request.post(`${API_BASE}/api/story`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        metadata: { title: 'Publish Flow Story', description: '' },
        scenes: [{ sceneId: '11111111-1111-4111-8111-111111111111', order: 0 }],
      },
    });
    const { storyId } = await storyRes.json();

    // Draft: the public route must not serve it yet.
    const draftPublic = await request.get(`${API_BASE}/api/story/public/${storyId}`);
    expect(draftPublic.status()).toBe(404);

    await page.addInitScript((token) => localStorage.setItem('auth:token', token), user.token);
    await page.goto(`/editor?storyId=${storyId}`);
    await page.locator('[data-tour="tab-historia"]').waitFor({ timeout: 15000 });
    // A brand-new account triggers the onboarding tour, which overlays the
    // whole editor until dismissed.
    await dismissTourIfShown(page);
    await page.locator('[data-tour="tab-historia"]').click();
    await dismissTourIfShown(page);

    // Draft state in the UI: no share link, "Publicar" is the only action.
    await expect(page.getByRole('link', { name: /visualizar história/i })).toHaveCount(0);
    const publishBtn = page.getByRole('button', { name: /^publicar$/i });
    await expect(publishBtn).toBeVisible();

    await publishBtn.click();
    await dismissTourIfShown(page);
    await expect(page.getByText(/história publicada/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: /visualizar história/i })).toBeVisible();

    const publishedPublic = await request.get(`${API_BASE}/api/story/public/${storyId}`);
    expect(publishedPublic.status()).toBe(200);

    // Unpublish: share link disappears again, public route 404s again.
    await dismissTourIfShown(page);
    await page.getByRole('button', { name: /despublicar/i }).click();
    await expect(page.getByText(/história despublicada/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: /visualizar história/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^publicar$/i })).toBeVisible();

    const unpublishedPublic = await request.get(`${API_BASE}/api/story/public/${storyId}`);
    expect(unpublishedPublic.status()).toBe(404);
  });

  test('Stories list shows a Draft/Published badge and hides the share link for drafts', async ({ page, request }) => {
    const user = await registerUser(request);
    await request.post(`${API_BASE}/api/story`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: { metadata: { title: 'Badge Check Story', description: '' }, scenes: [] },
    });

    await page.addInitScript((token) => localStorage.setItem('auth:token', token), user.token);
    await page.goto('/stories');

    const card = page.locator('.rounded-2xl', { hasText: 'Badge Check Story' }).first();
    await expect(card).toBeVisible();
    await expect(card.getByText('Rascunho')).toBeVisible();
    await expect(card.getByText(/ainda não publicada/i)).toBeVisible();
  });
});
