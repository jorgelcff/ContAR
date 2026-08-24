# ContAR — Frontend

React 19 + Three.js SPA that implements ContAR's scene editor, story viewer, and Augmented Reality modes. Full setup, environment variables, and architecture overview live in the [root README](../README.md).

## Running standalone

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs to dist/
npm run lint
```

Requires the backend running (default `http://localhost:3001`) for authentication, scene/story persistence, TTS, and media upload. See `.env.example` for the Avaturn SDK direct-mode variables (bypassing the backend).

## Structure

```text
src/
├── pages/            routed pages (Editor, AR, Viewer, Stories, Account, Login...)
│   └── ar/            logic shared across AR modes (arShared.jsx, PseudoARScene.jsx)
├── components/
│   ├── 3d/             SceneCanvas (Three.js engine) and SpeechBubble
│   └── ui/             editor panels and modals (LeftPanel, StoryBuilderPanel, TimelinePanel...)
├── controllers/        domain logic decoupled from the UI (see below)
├── store/              useSceneStore.js — global state (Zustand + persist)
├── api/                sceneApi.js — HTTP client for the backend
├── hooks/               useAudio, useTTS, useScene, useDeviceOrientation
├── auth/                AuthContext.jsx — session/JWT
├── context/             ThemeContext, ToastContext
├── utils/                BoneMapper, posePresets, syntheticJaw, text
└── data/                 sceneTemplates.js — ready-made scene presets
```

## Core modules

- **`components/3d/SceneCanvas.jsx`** — Three.js rendering engine: loads the avatar (GLB/VRM), applies transform/pose, manages lights/camera/controls, and integrates the controllers below.
- **`utils/BoneMapper.js`** — automatically detects the avatar's rig standard (Mixamo, VRM, CC3, or generic) via heuristics on bone names, and exposes a canonical mapping used by poses and animations.
- **`controllers/LipSyncController.js`** — lip synchronization: timeline mode (Azure TTS visemes) and heuristic mode (amplitude/frequency via the Web Audio API for imported audio).
- **`controllers/AnimationController.js`** — manages Three.js's `AnimationMixer`, crossfading between poses/animations and procedural micro-animations (blinking, breathing, gestures).
- **`utils/posePresets.js`** — library of static poses (hands on hips, arms crossed, salute...) applied via bone rotation.
- **`utils/syntheticJaw.js`** — injects a synthetic jaw into T1 avatars (no morph targets/jaw bone) to enable lip sync where the original rig doesn't support it.
- **`store/useSceneStore.js`** — single source of truth for editing state (avatar, transform, pose, speech, story, scenes), with partial persistence to `localStorage`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | production build into `dist/` |
| `npm run lint` | ESLint (config in `eslint.config.js`) |

## Notes

- Internationalized in 4 languages (PT/EN/ES/FR) via `i18next`, configured in `src/i18n.js`.
- `npm run lint` currently reports pre-existing errors (see "Current validation status" in the root README).
