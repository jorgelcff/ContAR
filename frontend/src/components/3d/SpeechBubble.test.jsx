import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as THREE from 'three';
import SpeechBubble from './SpeechBubble';

// Regression test for a real bug: the bubble used `bg-white text-gray-900`.
// index.css's light-theme remap turns --color-gray-900 into pure white (it's
// meant for card *backgrounds*), so any `text-gray-900` usage silently became
// white-on-white in light mode. Fixed to `text-black`, which the remap never
// touches. This doesn't exercise the CSS cascade itself (jsdom has no real
// layout engine) — it locks in that the broken class never comes back.
function renderBubble() {
  const avatarRef = { current: new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1)) };
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 1, 3);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld();
  const renderer = { domElement: { clientWidth: 800, clientHeight: 600 } };

  return render(
    <SpeechBubble text="Ola, mundo!" avatarRef={avatarRef} camera={camera} renderer={renderer} />
  );
}

describe('SpeechBubble', () => {
  it('renders the bubble text once positioned over the avatar', async () => {
    renderBubble();
    await waitFor(() => expect(screen.getByTestId('narration-bubble')).toBeInTheDocument());
    expect(screen.getByText('Ola, mundo!')).toBeInTheDocument();
  });

  it('never uses text-gray-900 on the white bubble (invisible in light theme)', async () => {
    renderBubble();
    const bubble = await screen.findByTestId('narration-bubble');
    expect(bubble.className).not.toMatch(/\btext-gray-900\b/);
    expect(bubble.className).toMatch(/\bbg-white\b/);
  });
});
