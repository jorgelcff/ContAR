const { test, expect, VIEWPORTS, registerUser } = require('./fixtures');

// Regression test: StoriesPage's card grid was missing a base grid-cols-1,
// so below the sm: breakpoint the single implicit column sized to content
// instead of the container — the share-link row's irreducible width (a
// truncating URL span next to two shrink-0 buttons) dragged the whole card
// past the phone's edge (measured 552px on a 375px viewport before the fix).
test.describe('Stories — card fits the viewport on mobile', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test('a story card never renders wider than the screen', async ({ page, request }) => {
    const user = await registerUser(request);

    await request.post('http://localhost:3001/api/story', {
      headers: { Authorization: `Bearer ${user.token}` },
      data: { metadata: { title: 'E2E Story', description: '' }, scenes: [] },
    });

    await page.addInitScript(
      (token) => localStorage.setItem('auth:token', token),
      user.token,
    );
    await page.goto('/stories');
    await page.waitForLoadState('networkidle');

    const card = page.locator('.rounded-2xl', { hasText: 'E2E Story' }).first();
    await expect(card).toBeVisible();

    const box = await card.boundingBox();
    expect(box.x + box.width, 'story card right edge vs viewport width').toBeLessThanOrEqual(VIEWPORTS.mobile.width);
  });
});
