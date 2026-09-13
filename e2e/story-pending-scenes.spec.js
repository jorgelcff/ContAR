const { test, expect, registerUser } = require('./fixtures');
const { API_BASE } = require('./config');

// "Concluir cena e adicionar à história" only updates the client store —
// nothing reaches the database until the story itself is saved. The editor
// re-fetches the story whenever it mounts, and used to overwrite the store with
// that database copy, so simply reloading (or opening a scene for editing from
// the scenes list) silently dropped every scene the user had just added.
test.describe('Story scenes pending save', () => {
  test('a scene added to a story survives the editor remounting', async ({ page, request }) => {
    test.setTimeout(60_000);
    const user = await registerUser(request);

    const storyRes = await request.post(`${API_BASE}/api/story`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: { metadata: { title: 'Pending Scenes Story', description: '' }, scenes: [] },
    });
    const { storyId } = await storyRes.json();

    await page.addInitScript((token) => {
      localStorage.setItem('auth:token', token);
      localStorage.setItem('avaturn:onboarding:done', '1');
      localStorage.setItem('contar:tour-done', '1');
    }, user.token);

    await page.goto(`/editor?storyId=${storyId}`);
    await page.locator('[data-tour="tab-cena"]').click();
    await page.getByPlaceholder('Minha Cena').first().fill('Cena Um');
    await page.getByRole('button', { name: /Concluir cena e adicionar/i }).click();

    const emptyState = page.getByText('Nenhuma cena nesta história ainda');
    await page.locator('[data-tour="tab-historia"]').click();
    await expect(emptyState).toHaveCount(0);

    // The remount that used to lose it.
    await page.reload();
    await page.locator('[data-tour="tab-historia"]').click();
    await expect(emptyState).toHaveCount(0);
  });
});
