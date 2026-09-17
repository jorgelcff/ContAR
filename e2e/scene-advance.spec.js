const { test, expect, registerUser } = require('./fixtures');
const { API_BASE } = require('./config');

// Playback only ever counted seconds off a clock: a narration longer than the
// configured duration was cut off mid-sentence, a shorter one left the
// character standing in silence. A scene can now say it ends when its
// narration does. These drive the real viewer with a real audio file.

// A ~3s silent WAV, inline so the test owns its own fixture.
function silentWav(seconds) {
  const rate = 8000;
  const samples = rate * seconds;
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples * 2, 40);
  return buf;
}

async function buildStory(request, token, { advanceOn, durationSeconds }) {
  // advanceOn undefined means the field is simply not sent — the case every
  // story saved before this existed is in.
  const scene = await request.post(`${API_BASE}/api/scene`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      avatarUrl: 'https://example.com/a.glb',
      content: { narrative: { text: 'Uma fala de teste', audioUrl: 'http://127.0.0.1:1/narration.wav' } },
    },
  });
  const { sceneId } = await scene.json();

  const second = await request.post(`${API_BASE}/api/scene`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { avatarUrl: 'https://example.com/b.glb', content: { narrative: { text: 'Segunda cena' } } },
  });
  const secondId = (await second.json()).sceneId;

  const story = await request.post(`${API_BASE}/api/story`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      metadata: { title: 'Ritmo' },
      scenes: [
        { sceneId, order: 0, durationSeconds, ...(advanceOn ? { advanceOn } : {}) },
        { sceneId: secondId, order: 1, durationSeconds: 30 },
      ],
    },
  });
  return (await story.json()).storyId;
}

test.describe('When a scene gives way to the next', () => {
  test('a scene set to wait for its narration outlasts its configured seconds', async ({ page, request }) => {
    const user = await registerUser(request);
    // One second on the clock, three seconds of narration: under the old rule
    // the line was cut after a second.
    const storyId = await buildStory(request, user.token, { advanceOn: 'narration', durationSeconds: 1 });

    await page.route('**/narration.wav', (r) => r.fulfill({ body: silentWav(3), contentType: 'audio/wav' }));
    await page.addInitScript((token) => localStorage.setItem('auth:token', token), user.token);
    await page.goto(`/story/${storyId}`);
    await page.getByRole('button', { name: /começar|iniciar|start/i }).first().click();

    // Still on the first scene well past the configured second.
    await page.waitForTimeout(2000);
    // The narration text is drawn into the canvas, so the scene counter is
    // the readable signal for where playback is.
    await expect(page.getByText(/^1\/2$/)).toBeVisible();
  });

  test('a story saved before this existed now waits for its narration too', async ({ page, request }) => {
    // The default is waiting, which is what the AR player has always done.
    // This is the behaviour change: in the browser such a scene used to cut
    // its line off after the configured second.
    const user = await registerUser(request);
    const storyId = await buildStory(request, user.token, { durationSeconds: 1 });

    await page.route('**/narration.wav', (r) => r.fulfill({ body: silentWav(3), contentType: 'audio/wav' }));
    await page.addInitScript((token) => localStorage.setItem('auth:token', token), user.token);
    await page.goto(`/story/${storyId}`);
    await page.getByRole('button', { name: /começar|iniciar|start/i }).first().click();

    await page.waitForTimeout(2000);
    await expect(page.getByText(/^1\/2$/)).toBeVisible();
  });

  test('a scene left on the clock still advances on its seconds', async ({ page, request }) => {
    const user = await registerUser(request);
    const storyId = await buildStory(request, user.token, { advanceOn: 'time', durationSeconds: 1 });

    await page.route('**/narration.wav', (r) => r.fulfill({ body: silentWav(3), contentType: 'audio/wav' }));
    await page.addInitScript((token) => localStorage.setItem('auth:token', token), user.token);
    await page.goto(`/story/${storyId}`);
    await page.getByRole('button', { name: /começar|iniciar|start/i }).first().click();

    await expect(page.getByText(/^2\/2$/)).toBeVisible({ timeout: 8000 });
  });

  test('a narration that never loads does not strand the story', async ({ page, request }) => {
    const user = await registerUser(request);
    const storyId = await buildStory(request, user.token, { advanceOn: 'narration', durationSeconds: 2 });

    // The file 404s — the scene must fall back to its seconds rather than hang.
    await page.route('**/narration.wav', (r) => r.fulfill({ status: 404, body: '' }));
    await page.addInitScript((token) => localStorage.setItem('auth:token', token), user.token);
    await page.goto(`/story/${storyId}`);
    await page.getByRole('button', { name: /começar|iniciar|start/i }).first().click();

    await expect(page.getByText(/^2\/2$/)).toBeVisible({ timeout: 25000 });
  });
});
