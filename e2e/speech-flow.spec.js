const { test, expect } = require('./fixtures');

// Regression tests for the Fala tab: it used to have two independent
// "generate voice" UIs stacked in the same panel (a top button wired to the
// raw, uncommitted textarea value, and AudioPanel's own flow wired to the
// committed speechText) — both called the same generateTTS API. Removed the
// duplicate; this locks in that it doesn't come back.
test.describe('Editor — Fala tab', () => {
  test('has exactly one voice-generation entry point, not two', async ({ authedPage }) => {
    await authedPage.goto('/editor');
    // The 3D viewport keeps a render loop going, so the page never truly
    // reaches networkidle — wait for the tab bar instead.
    await authedPage.locator('[data-tour="tab-fala"]').waitFor();
    await authedPage.locator('[data-tour="tab-fala"]').click();

    // The removed button's exact label — must never reappear.
    await expect(authedPage.getByRole('button', { name: 'Gerar Voz (TTS)' })).toHaveCount(0);

    // Typing text should not need a separate "commit" step to reach the one
    // remaining generation button — it's driven by the committed speechText,
    // reachable via "Definir texto da fala".
    await authedPage.getByPlaceholder(/texto da fala/i).fill('Ola, este e um teste.');
    await authedPage.getByRole('button', { name: 'Definir texto da fala' }).click();

    await expect(authedPage.getByRole('button', { name: 'Gerar fala' })).toBeVisible();
  });

  test('the upload/record controls show translated labels, not raw i18n keys', async ({ authedPage }) => {
    await authedPage.goto('/editor');
    // The 3D viewport keeps a render loop going, so the page never truly
    // reaches networkidle — wait for the tab bar instead.
    await authedPage.locator('[data-tour="tab-fala"]').waitFor();
    await authedPage.locator('[data-tour="tab-fala"]').click();

    const bodyText = await authedPage.locator('body').innerText();
    // These keys existed in AudioPanel.jsx but were never defined in i18n.js,
    // so they rendered as their own raw key name instead of a label.
    for (const rawKey of ['audioUpload', 'audioStartRec', 'audioStopRec', 'audioPlay', 'audioPause', 'audioStop']) {
      expect(bodyText, `raw i18n key "${rawKey}" should not be visible`).not.toContain(rawKey);
    }
  });
});
