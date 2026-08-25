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
