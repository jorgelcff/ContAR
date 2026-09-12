const { test, expect } = require('./fixtures');
const AxeBuilder = require('@axe-core/playwright').default;

// Formalizes the ad-hoc axe-core contrast audit run manually during the
// design-system consolidation (13 accent-color families collapsed to 4, plus
// a full light/dark WCAG AA pass) into a permanent regression suite, so a
// future unmapped color or low-contrast text/background pairing fails CI
// instead of waiting for someone to notice.
//
// Scoped to the single 'color-contrast' rule (not a full a11y audit) to match
// what was actually manually verified: WCAG AA text/background contrast
// across every page and both themes.
async function contrastViolations(page) {
  const results = await new AxeBuilder({ page })
    .withRules(['color-contrast'])
    .analyze();
  return results.violations;
}

function describe(violations) {
  return violations
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')} — ${v.help}`)
    .join('\n');
}

for (const theme of ['light', 'dark']) {
  test.describe(`axe color-contrast — ${theme} theme — public pages`, () => {
    test.use({ theme });

    test('landing page', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const violations = await contrastViolations(page);
      expect(violations, describe(violations)).toEqual([]);
    });

    test('login page', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      const violations = await contrastViolations(page);
      expect(violations, describe(violations)).toEqual([]);
    });

    test('AR mode-selection page', async ({ page }) => {
      await page.goto('/ar');
      await page.waitForLoadState('networkidle');
      const violations = await contrastViolations(page);
      expect(violations, describe(violations)).toEqual([]);
    });
  });

  test.describe(`axe color-contrast — ${theme} theme — authenticated pages`, () => {
    test.use({ theme });

    test('stories list', async ({ authedPage }) => {
      await authedPage.goto('/stories');
      await authedPage.waitForLoadState('networkidle');
      const violations = await contrastViolations(authedPage);
      expect(violations, describe(violations)).toEqual([]);
    });

    test('scenes list', async ({ authedPage }) => {
      await authedPage.goto('/scenes');
      await authedPage.waitForLoadState('networkidle');
      const violations = await contrastViolations(authedPage);
      expect(violations, describe(violations)).toEqual([]);
    });

    test('account page', async ({ authedPage }) => {
      await authedPage.goto('/account');
      await authedPage.waitForLoadState('networkidle');
      const violations = await contrastViolations(authedPage);
      expect(violations, describe(violations)).toEqual([]);
    });

    // The editor's 3D viewport keeps a render loop running, so the page never
    // truly reaches networkidle — wait for a concrete UI landmark instead,
    // matching the pattern already used by e2e/contrast.spec.js.
    test('editor — Avatar, Fala, Cena and História tabs', async ({ authedPage }) => {
      await authedPage.goto('/editor');
      await authedPage.locator('[data-tour="tab-fala"]').waitFor();

      const avatarViolations = await contrastViolations(authedPage);
      expect(avatarViolations, describe(avatarViolations)).toEqual([]);

      for (const tab of ['tab-fala', 'tab-cena', 'tab-historia']) {
        await authedPage.locator(`[data-tour="${tab}"]`).click();
        const violations = await contrastViolations(authedPage);
        expect(violations, `${tab}: ${describe(violations)}`).toEqual([]);
      }
    });
  });
}
