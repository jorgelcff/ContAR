const { test, expect, registerUser } = require('./fixtures');
const { API_BASE } = require('./config');

const AVATAR = 'https://cdn.jsdelivr.net/gh/c-frame/valid-avatars-glb/avatars/Black/Black_F_1_Casual.glb';
// Roughly a page of narration — well past anything the layout was designed for.
const LONG_TEXT = 'palavra '.repeat(900);

// The narration overlays were width-constrained but had no height limit, so a
// long text grew until it covered the viewport and hid the very avatar it was
// narrating. Found by probing the viewer with oversized input rather than by
// any existing test — the suite only ever fed it sentence-length narration.
async function sceneWith(request, token, displayMode) {
  const res = await request.post(`${API_BASE}/api/scene`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      metadata: { title: 'Long narration' },
      content: {
        avatar: { modelUrl: AVATAR },
        narrative: { text: LONG_TEXT, displayMode },
      },
    },
  });
  return (await res.json()).sceneId;
}

test.describe('Long narration stays inside the viewport', () => {
  for (const [mode, testId] of [['subtitle', 'narration-caption'], ['bubble', 'narration-bubble']]) {
    test(`${mode} never covers the whole view`, async ({ page, request }) => {
      test.setTimeout(60_000);
      const user = await registerUser(request);
      const sceneId = await sceneWith(request, user.token, mode);

      await page.goto(`/scene/${sceneId}`);
      const overlay = page.getByTestId(testId);
      await expect(overlay).toBeVisible({ timeout: 30_000 });

      const box = await overlay.boundingBox();
      const viewport = page.viewportSize();
      // Leave the avatar at least half the height to be seen in.
      expect(box.height, `${mode} overlay is ${box.height}px tall`)
        .toBeLessThan(viewport.height * 0.5);
      expect(box.y).toBeGreaterThanOrEqual(0);
    });
  }
});
