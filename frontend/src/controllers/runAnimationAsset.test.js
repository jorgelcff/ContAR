import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationController } from './AnimationController';

// public/animations/run.glb is a stripped-down (bones only, no mesh) export
// carrying just the "Run" clip from three.js's bundled Soldier.glb — a
// Mixamo-rigged asset already redistributed under three.js's own examples.
// This pins the file's shape so a future re-export can't silently break the
// "Run" pose the way the missing original run.glb did (see posePresets.js
// ANIMATION_FALLBACK_CHAIN and its tests).
describe('bundled run.glb animation asset', () => {
  it('loads as a single "Run" clip on a Mixamo-named skeleton', async () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.join(__dirname, '../../public/animations/run.glb');
    const buf = fs.readFileSync(filePath);
    // jsdom's test environment has its own ArrayBuffer/Uint8Array realm,
    // distinct from Node's — `buf.buffer` fails GLTFLoader's `instanceof
    // ArrayBuffer` check there. Re-wrapping with the ambient Uint8Array
    // copies the bytes into that realm's own buffer.
    const arrayBuffer = new Uint8Array(buf).buffer;

    const gltf = await new Promise((resolve, reject) => {
      new GLTFLoader().parse(arrayBuffer, '', resolve, reject);
    });

    expect(gltf.animations).toHaveLength(1);
    expect(gltf.animations[0].name).toBe('Run');

    // This is a "Without Skin" Mixamo-style export (see AnimationController's
    // attachSourceRestPose comment): with no SkinnedMesh/skin left in the
    // file, the joints load as plain Object3D rather than THREE.Bone, and the
    // retargeter matches them by name instead of `isBone`.
    let skeletonNodeCount = 0;
    let hips = null;
    gltf.scene.traverse((node) => {
      if (/^mixamorig/i.test(node.name || '')) skeletonNodeCount += 1;
      if (/hips$/i.test(node.name || '')) hips = node;
      // The point of stripping the source file was to drop the mesh/skin —
      // pin that so nobody re-adds a multi-megabyte export by mistake.
      expect(Boolean(node.isMesh || node.isSkinnedMesh)).toBe(false);
    });
    expect(skeletonNodeCount).toBeGreaterThan(40);
    expect(hips).not.toBeNull();

    // Plays on its own (un-retargeted) skeleton without throwing — a basic
    // guard against a corrupt export the JSON checks above wouldn't catch.
    const controller = new AnimationController(gltf.scene, gltf.animations);
    expect(() => controller.play('Run', 0, { retarget: false })).not.toThrow();
    for (let i = 0; i < 30; i += 1) controller.update(1 / 30);
  });
});
