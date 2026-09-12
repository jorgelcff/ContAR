const { test, expect, VIEWPORTS } = require('./fixtures');

// Regression test: the mobile drawer's full-screen backdrop (z-40) sat above
// the bottom tab bar (z-30), so tapping a different tab while a drawer was
// open just closed the current drawer instead of switching directly to the
// new one — the tap landed on the backdrop, not the tab button underneath it.
test.describe('Editor — mobile bottom nav', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test('tapping a different tab while a drawer is open switches directly to it', async ({ authedPage }) => {
    await authedPage.goto('/editor');
    const bottomNav = authedPage.locator('nav');
    await bottomNav.waitFor({ timeout: 15000 });
    await bottomNav.getByText('Avatar').click();
    await expect(authedPage.getByPlaceholder(/url do avatar glb/i).last()).toBeVisible();

    // One tap on "Fala" must open the Fala drawer directly, not just close Avatar's.
    await bottomNav.getByText('Fala').click();
    await expect(authedPage.getByPlaceholder(/texto da fala/i).last()).toBeVisible({ timeout: 5000 });
  });
});
