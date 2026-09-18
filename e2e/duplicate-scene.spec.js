const { test, expect, registerUser } = require('./fixtures');
const { API_BASE } = require('./config');

// Eleven scenes that differ only in their line meant rebuilding the avatar,
// the pose, the framing and the pacing eleven times.
test.describe('Duplicating a scene in a story', () => {
  async function openStory(page, request) {
    const user = await registerUser(request);
    const scene = await request.post(`${API_BASE}/api/scene`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        metadata: { title: 'Cena original' },
        content: {
          avatar: { modelUrl: 'http://127.0.0.1:1/a.glb', posePreset: 'speaker' },
          narrative: { text: 'A fala da cena original', language: 'pt' },
        },
      },
    });
    const { sceneId } = await scene.json();
    const story = await request.post(`${API_BASE}/api/story`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        metadata: { title: 'História' },
        scenes: [{ sceneId, order: 0, durationSeconds: 13, advanceOn: 'time' }],
      },
    });
    const { storyId } = await story.json();

    await page.addInitScript((t) => localStorage.setItem('auth:token', t), user.token);
    await page.goto(`/editor?storyId=${storyId}`);
    await page.locator('[data-tour="scene-canvas"]').waitFor({ timeout: 20000 });
    const skip = page.getByRole('button', { name: /pular/i });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await page.locator('[data-scene-card]').first().waitFor({ timeout: 15000 });
    return { user, storyId, sceneId };
  }

  test('the copy lands beside the original and carries its pacing', async ({ page, request }) => {
    test.setTimeout(60_000);
    const { user, storyId } = await openStory(page, request);

    await expect(page.locator('[data-scene-card]')).toHaveCount(1);
    await page.getByRole('button', { name: /duplicar esta cena/i }).first().click();
    await expect(page.locator('[data-scene-card]')).toHaveCount(2);

    // Saved, in order, with the copy's own scene id. The save button lives in
    // the História tab of the side panel, which is not the one open.
    await page.locator('[data-tour="tab-historia"]').click();
    // "Atualizar" rather than "Salvar" once the story already exists.
    await page.getByRole('button', { name: /salvar história|atualizar história/i }).click();
    await expect(page.getByText(/história salva|história atualizada/i).first())
      .toBeVisible({ timeout: 15000 });

    const stored = await request.get(`${API_BASE}/api/story/${storyId}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    const { scenes } = await stored.json();
    expect(scenes).toHaveLength(2);
    expect(scenes[1].sceneId).not.toBe(scenes[0].sceneId);
    // Copying a scene that ends after thirteen seconds should not produce one
    // that ends after eight.
    expect(scenes[1].durationSeconds).toBe(13);
    expect(scenes[1].advanceOn).toBe('time');
  });

  test('the copy is its own scene — editing it leaves the original alone', async ({ page, request }) => {
    test.setTimeout(60_000);
    const { user, sceneId } = await openStory(page, request);

    await page.getByRole('button', { name: /duplicar esta cena/i }).first().click();
    await expect(page.locator('[data-scene-card]')).toHaveCount(2);

    // Open the copy and change its line.
    await page.locator('[data-scene-card]').nth(1).getByRole('button', { name: /editar esta cena/i }).click();
    await page.locator('[data-tour="tab-fala"]').click();
    const box = page.locator('textarea').first();
    await expect(box).toHaveValue('A fala da cena original', { timeout: 15000 });
    await box.fill('Uma fala só da cópia');
    await page.getByRole('button', { name: /definir texto da fala|definir fala/i }).first().click();
    await page.waitForTimeout(6500); // past the autosave window

    const original = await request.get(`${API_BASE}/api/scene/${sceneId}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    const body = await original.json();
    expect(body.content.narrative.text, 'the original was written over').toBe('A fala da cena original');
  });
});
