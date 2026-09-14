const { test, expect, registerUser } = require('./fixtures');
const { API_BASE } = require('./config');

const AVATAR = 'https://cdn.jsdelivr.net/gh/c-frame/valid-avatars-glb/avatars/Black/Black_F_1_Casual.glb';

// Playback settings used to exist only in the editor: animSpeed, animLoopOnce,
// vrmExpression and the custom .vrma were never written to the scene, and the
// single-scene viewer additionally ignored the narration display mode. A scene
// therefore replayed with defaults rather than as it was authored.
test.describe('Scene playback settings persist', () => {
  test('the viewer renders narration in the mode the scene was saved with', async ({ page, request }) => {
    test.setTimeout(60_000);
    const user = await registerUser(request);

    const res = await request.post(`${API_BASE}/api/scene`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        metadata: { title: 'Subtitle Scene' },
        content: {
          avatar: { modelUrl: AVATAR, posePreset: 'neutral' },
          narrative: { text: 'Bem-vindos à aula.', displayMode: 'subtitle' },
        },
      },
    });
    const { sceneId } = await res.json();

    await page.goto(`/scene/${sceneId}`);
    await expect(page.getByTestId('narration-caption')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('narration-bubble')).toHaveCount(0);
  });

  test('rigging tools stay out of the public viewer', async ({ page, request }) => {
    const user = await registerUser(request);
    const res = await request.post(`${API_BASE}/api/scene`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        metadata: { title: 'No Rig Tools' },
        content: { avatar: { modelUrl: AVATAR }, narrative: { text: 'Olá.' } },
      },
    });
    const { sceneId } = await res.json();

    await page.goto(`/scene/${sceneId}`);
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Ossos/ })).toHaveCount(0);
  });

  test('the backend stores the avatar playback settings', async ({ request }) => {
    const user = await registerUser(request);
    const auth = { Authorization: `Bearer ${user.token}` };

    const saved = await request.post(`${API_BASE}/api/scene`, {
      headers: auth,
      data: {
        metadata: { title: 'Playback Settings' },
        content: {
          avatar: {
            modelUrl: AVATAR,
            posePreset: 'walk',
            animSpeed: 2.5,
            animLoopOnce: true,
            vrmExpression: 'happy',
            vrmaUrl: 'https://example.com/dance.vrma',
          },
          narrative: { text: 'Olá.' },
        },
      },
    });
    const { sceneId } = await saved.json();

    const reloaded = await (await request.get(`${API_BASE}/api/scene/${sceneId}`, { headers: auth })).json();
    const avatar = reloaded.content.avatar;
    expect(avatar.animSpeed).toBe(2.5);
    expect(avatar.animLoopOnce).toBe(true);
    expect(avatar.vrmExpression).toBe('happy');
    expect(avatar.vrmaUrl).toBe('https://example.com/dance.vrma');
  });
});
