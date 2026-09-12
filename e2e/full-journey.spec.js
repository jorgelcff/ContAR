const { test, expect } = require('./fixtures');

// End-to-end proof that the full user journey works: register → build an
// avatar/scene → save it → assemble a story → publish it → view the public
// story link → open it in AR. This is the longest, most sequential test in
// the suite (many real network round-trips in a row), so under full-suite
// parallelism it's the first to run into the shared E2E backend's throughput
// limit (a single dev-mode Node process) — a longer timeout, not a smaller
// one, is the right fix, since the app is left in a perfectly valid state
// each time this was observed timing out; it was just still catching up.
test('full journey: register, build a scene, save a story, view it in AR', async ({ page }) => {
  test.setTimeout(60_000);
  const email = `journey-${Date.now()}@example.com`;

  // 1. Register
  await page.goto('/login');
  await page.getByRole('button', { name: /criar uma/i }).click();
  await page.getByPlaceholder(/nome/i).fill('Journey User');
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/senha/i).fill('password123');
  await page.getByRole('button', { name: /criar conta/i }).click();
  await expect(page).toHaveURL(/\/stories/, { timeout: 15000 });

  // 2. New scene in the editor — a brand-new account triggers the onboarding
  // tour, which overlays the whole editor until dismissed. Skip it, same as a
  // real first-time user would.
  await page.goto('/editor');
  await page.locator('[data-tour="tab-avatar"]').waitFor({ timeout: 15000 });
  const skipTour = page.getByRole('button', { name: /pular/i });
  if (await skipTour.isVisible().catch(() => false)) {
    await skipTour.click();
  }

  // Load an avatar via direct URL (bypasses the live Avaturn SDK, which needs
  // a real external session — this exercises the same setAvatarUrl → GLTFLoader
  // path any creator source funnels through).
  await page.getByPlaceholder(/url do avatar glb/i).fill(`${page.url().split('/editor')[0]}/default_model.glb`);
  await page.getByRole('button', { name: 'Carregar Avatar' }).click();

  // Fala tab: set narration text
  await page.locator('[data-tour="tab-fala"]').click();
  await page.getByPlaceholder(/texto da fala/i).fill('Esta é uma jornada de teste completa.');
  await page.getByRole('button', { name: 'Definir texto da fala' }).click();

  // Cena tab: title + save scene into the story
  await page.locator('[data-tour="tab-cena"]').click();
  await page.getByPlaceholder('Minha Cena').fill('Cena de Jornada E2E');
  await page.getByRole('button', { name: /concluir cena e adicionar/i }).click();
  await expect(page.getByText(/^Cena 1 adicionada/i)).toBeVisible({ timeout: 10000 });

  // História tab: title, save — saving alone must NOT publish it
  await page.locator('[data-tour="tab-historia"]').click();
  await page.getByPlaceholder('Minha História').fill('História de Jornada E2E');
  await page.getByRole('button', { name: /salvar história/i }).click();
  await expect(page.getByText(/história salva/i)).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('link', { name: /visualizar história/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^publicar$/i })).toBeVisible();

  // Publishing is what actually makes the share link live
  await page.getByRole('button', { name: /^publicar$/i }).click();
  await expect(page.getByText(/história publicada/i).first()).toBeVisible({ timeout: 10000 });

  const previewLink = page.getByRole('link', { name: /visualizar história/i });
  await expect(previewLink).toBeVisible({ timeout: 10000 });
  const storyHref = await previewLink.getAttribute('href');
  expect(storyHref).toMatch(/\/story\//);

  // 3. Visit the public story page directly (simulates a viewer opening the
  // shared link — no auth, fresh navigation)
  await page.goto(storyHref);
  await expect(page.getByRole('heading', { name: 'História de Jornada E2E' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('1 cena')).toBeVisible();

  // 4. Follow the "View in AR" link from the public story page
  const arLink = page.getByRole('link', { name: /ver em ar|view in ar/i }).first();
  await expect(arLink).toBeVisible({ timeout: 10000 });
  const arHref = await arLink.getAttribute('href');
  expect(arHref).toMatch(/^\/ar\?/);

  await page.goto(arHref);
  // AR page renders a live camera/3D view — assert no crash (no error boundary
  // text) and that the page settled on the AR route.
  await expect(page).toHaveURL(/\/ar\?/);
  await expect(page.getByText(/error|erro inesperado/i)).toHaveCount(0);
});
