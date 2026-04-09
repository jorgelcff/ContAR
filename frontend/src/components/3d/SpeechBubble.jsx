import React, { useEffect, useState } from 'react';
import * as THREE from 'three';

/**
 * SpeechBubble — HTML overlay that projects the avatar's head position
 * into screen space every 50 ms, so the bubble always "floats" above
 * the avatar as the camera moves.
 *
 * Props:
 *   text       – string to display (falsy → hidden)
 *   avatarRef  – React ref containing the THREE.Object3D avatar
 *   camera     – THREE.Camera
 *   renderer   – THREE.WebGLRenderer (used for canvas dimensions)
 */
export default function SpeechBubble({ text, avatarRef, camera, renderer }) {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!text || !avatarRef || !camera || !renderer) {
      setPos(null);
      return;
    }

    const update = () => {
      const model = avatarRef.current;
      if (!model) { setPos(null); return; }

      // Compute world-space point just above the avatar's bounding box
      const box = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const headPos = new THREE.Vector3(center.x, box.max.y + 0.12, center.z);

      // Project to NDC
      const ndc = headPos.clone().project(camera);

      // Only show if in front of the camera
      if (ndc.z >= 1) { setPos(null); return; }

      const canvas = renderer.domElement;
      setPos({
        x: (ndc.x * 0.5 + 0.5) * canvas.clientWidth,
        y: (-ndc.y * 0.5 + 0.5) * canvas.clientHeight,
      });
    };

    update();
    const id = setInterval(update, 50);
    return () => clearInterval(id);
  }, [text, avatarRef, camera, renderer]);

  if (!text || !pos) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y - 16,
        transform: 'translate(-50%, -100%)',
        pointerEvents: 'none',
        zIndex: 10,
        maxWidth: 220,
      }}
    >
      {/* Bubble body */}
      <div className="bg-white text-gray-900 rounded-2xl px-3 py-2 text-sm shadow-xl leading-snug break-words">
        {text}
      </div>
      {/* Tail */}
      <div
        style={{
          position: 'absolute',
          bottom: -8,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '8px solid white',
        }}
      />
    </div>
  );
}
