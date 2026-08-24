# ContAR — Frontend

SPA React 19 + Three.js que implementa o editor de cenas, o viewer de histórias e os modos de Realidade Aumentada do ContAR. Setup, variáveis de ambiente e visão geral da arquitetura completa estão no [README da raiz](../README.md).

## Rodando isoladamente

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/
npm run lint
```

Requer o backend rodando (padrão `http://localhost:3001`) para autenticação, persistência de cenas/histórias, TTS e upload de mídia. Veja `.env.example` para as variáveis do modo direto do Avaturn SDK (sem passar pelo backend).

## Estrutura

```text
src/
├── pages/            páginas roteadas (Editor, AR, Viewer, Stories, Account, Login...)
│   └── ar/            lógica compartilhada entre os modos AR (arShared.jsx, PseudoARScene.jsx)
├── components/
│   ├── 3d/             SceneCanvas (motor Three.js) e SpeechBubble
│   └── ui/             painéis e modais do editor (LeftPanel, StoryBuilderPanel, TimelinePanel...)
├── controllers/        lógica de domínio desacoplada da UI (ver abaixo)
├── store/              useSceneStore.js — estado global (Zustand + persist)
├── api/                sceneApi.js — client HTTP para o backend
├── hooks/               useAudio, useTTS, useScene, useDeviceOrientation
├── auth/                AuthContext.jsx — sessão/JWT
├── context/             ThemeContext, ToastContext
├── utils/                BoneMapper, posePresets, syntheticJaw, text
└── data/                 sceneTemplates.js — presets de cena prontos
```

## Módulos centrais

- **`components/3d/SceneCanvas.jsx`** — motor de renderização Three.js: carrega o avatar (GLB/VRM), aplica transform/pose, gerencia luzes/câmera/controles e integra os controllers abaixo.
- **`utils/BoneMapper.js`** — detecta automaticamente o padrão de rig do avatar (Mixamo, VRM, CC3 ou genérico) por heurística nos nomes dos ossos e expõe um mapeamento canônico usado por poses e animações.
- **`controllers/LipSyncController.js`** — sincronização labial: modo timeline (visemas do Azure TTS) e modo heurístico (amplitude/frequência via Web Audio API para áudio importado).
- **`controllers/AnimationController.js`** — gerencia o `AnimationMixer` do Three.js, crossfade entre poses/animações e micro-animações procedurais (piscar, respiração, gestos).
- **`utils/posePresets.js`** — biblioteca de poses estáticas (mãos no quadril, braços cruzados, saudação...) aplicadas via rotação de ossos.
- **`utils/syntheticJaw.js`** — injeta uma mandíbula sintética em avatares T1 (sem morph targets/bone de mandíbula) para viabilizar lip sync onde o rig original não suporta.
- **`store/useSceneStore.js`** — única fonte de verdade do estado de edição (avatar, transform, pose, fala, história, cenas), com persistência parcial em `localStorage`.

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Vite dev server com HMR |
| `npm run build` | build de produção em `dist/` |
| `npm run lint` | ESLint (config em `eslint.config.js`) |

## Notas

- Internacionalização em 4 idiomas (PT/EN/ES/FR) via `i18next`, configurado em `src/i18n.js`.
- `npm run lint` atualmente reporta erros preexistentes (ver seção "Estado atual de validação" no README da raiz).
