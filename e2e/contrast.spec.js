const { test, expect } = require('./fixtures');
const { contrastRatioOf } = require('./contrast-utils');

const WCAG_AA_NORMAL_TEXT = 4.5;

// Regression tests for the light-theme contrast bugs found during a manual
// UX audit: literal `bg-black/*` / `text-white` Tailwind utilities were never
// covered by index.css's light-theme token remap, so a few overlay panels
// went text-on-same-color invisible specifically in light mode.
test.describe('light theme contrast regressions', () => {
  test.use({ theme: 'light' });

  test('AR mode-selection "Requisitos" box text is legible (was bg-black/30 + text-gray-400)', async ({ page }) => {
    await page.goto('/ar');
    await page.waitForLoadState('networkidle');

    const requirement = page.getByText('iPhone ou Android com câmera').first();
    await expect(requirement).toBeVisible();
    const ratio = await contrastRatioOf(requirement);
    expect(ratio, 'contrast ratio of the first AR requirement line').toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  test('editor narration caption is legible (was bg-black/70 + text-white flipped to near-black text)', async ({ authedPage }) => {
    await authedPage.goto('/editor');
    // The 3D viewport keeps a render loop running, so the page never truly
    // reaches networkidle — wait for a concrete UI landmark instead.
    await authedPage.locator('[data-tour="tab-fala"]').waitFor();

    await authedPage.locator('[data-tour="tab-fala"]').click();
    await authedPage.getByRole('button', { name: 'Legenda' }).click();
    await authedPage.getByPlaceholder(/texto da fala/i).fill('Teste de contraste da legenda.');
    await authedPage.getByRole('button', { name: 'Definir texto da fala' }).click();

    const caption = authedPage.getByTestId('narration-caption');
    await expect(caption).toBeVisible();
    const ratio = await contrastRatioOf(caption);
    expect(ratio, 'contrast ratio of the editor narration caption').toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });
});
