const { test, expect, VIEWPORTS } = require('./fixtures');

// Regression test: Header.jsx's logout button was the one nav item missing
// the responsive treatment its siblings had, so it clipped off the right
// edge below ~640px (fixed by making the control row wrap).
test.describe('Header — logout button stays on-screen', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  for (const path of ['/editor', '/scenes', '/stories', '/account']) {
    test(`"Sair" is fully visible on ${path} at ${VIEWPORTS.mobile.width}px`, async ({ authedPage }) => {
      await authedPage.goto(path);

      // /editor keeps a 3D render loop going, so it never truly reaches
      // networkidle — the logout button itself is the readiness signal.
      const logout = authedPage.getByRole('button', { name: 'Sair' });
      await expect(logout).toBeVisible();

      const box = await logout.boundingBox();
      expect(box.x + box.width, '"Sair" right edge vs viewport width').toBeLessThanOrEqual(VIEWPORTS.mobile.width);
    });
  }
});
