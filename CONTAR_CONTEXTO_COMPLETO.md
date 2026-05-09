# ContAR — Documento de Contexto Completo
**Fonte de verdade técnica e acadêmica do projeto**
**Autor:** Jorge Luiz Cunha de Freitas — jlcf@cin.ufpe.br
**Instituição:** Centro de Informática — Universidade Federal de Pernambuco (CIn/UFPE)
**Tipo:** Trabalho de Conclusão de Curso — Ciência da Computação
**Repositório:** https://github.com/jorgelcff/avaturn-threejs
**Aplicação em produção:** https://avaturn-threejs-1.onrender.com

---

## 1. IDENTIDADE E PROPÓSITO DO PROJETO

### 1.1 Nome e conceito
**ContAR** é uma plataforma web no-code para criação, publicação e compartilhamento de narradores virtuais 3D interativos. O nome é um jogo de palavras em português: *Contar* (narrar histórias) + *AR* (Augmented Reality / Realidade Aumentada).

### 1.2 Problema endereçado
Educadores e criadores de conteúdo que desejam produzir material didático com avatares 3D falantes enfrentam barreiras técnicas significativas: ferramentas como Unreal Engine, Unity ou Blender exigem programação ou modelagem especializada; soluções comerciais existentes são caras ou muito simplificadas; não há integração nativa entre criação de avatar, síntese de voz, lip sync e realidade aumentada em uma única plataforma acessível via navegador.

### 1.3 Proposta de valor
ContAR integra em um único ambiente web, sem necessidade de instalação ou código:
- Criação ou importação de avatares 3D humanoides
- Síntese de voz com IA (TTS — Text-to-Speech)
- Sincronização labial (lip sync) em tempo real com o áudio
- Montagem de histórias em sequência de cenas
- Compartilhamento via link público (sem login do espectador)
- Visualização em Realidade Aumentada via câmera do dispositivo

### 1.4 Contexto acadêmico
Título formal do TCC: *"Desenvolvimento de um Ecossistema Integrado No-Code para Autoria e Publicação de Narradores Virtuais"*

O projeto é proposto como estudo de caso de aplicação de tecnologias web modernas (WebXR, Web Audio API, Three.js, React) para democratizar a produção de conteúdo educacional interativo com avatares 3D.

---

## 2. ARQUITETURA TÉCNICA GERAL

### 2.1 Modelo arquitetural
ContAR segue uma arquitetura **cliente-servidor separado (SPA + REST API)**:

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React SPA)                      │
│  React 19 · Vite · TailwindCSS v4 · Three.js · Zustand      │
│  Porta: 5173 (dev) / 80 (prod via Docker nginx)             │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/REST (Axios)
┌────────────────────▼────────────────────────────────────────┐
│                BACKEND (Node.js + Express)                   │
│  Express 5 · JWT · Multer · Resend · Mongoose               │
│  Porta: 3001                                                 │
└────────────────────┬────────────────────────────────────────┘
                     │ MongoDB Wire Protocol
┌────────────────────▼────────────────────────────────────────┐
│                  BANCO DE DADOS (MongoDB)                    │
│  MongoDB Atlas (produção) / MongoDB 7 local (dev Docker)    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Decisão por arquitetura desacoplada
O frontend e backend são projetos independentes com suas próprias dependências (`frontend/package.json` e `backend/package.json`). Na raiz do projeto existe um `package.json` orquestrador que roda os dois simultaneamente com um único comando.

### 2.3 Infraestrutura de produção
- **Plataforma:** Render.com (PaaS)
- **Banco de dados:** MongoDB Atlas (cloud)
- **Armazenamento de arquivos:** Sistema de arquivos do servidor (volumes Docker)
- **Email:** Resend API (serviço de transacional)
- **TTS (Síntese de voz):** ElevenLabs API
- **HTTPS:** Obrigatório em produção (exigido por WebXR e Web Audio API)

---

## 3. STACK TECNOLÓGICO DETALHADO

### 3.1 Frontend

| Tecnologia | Versão | Função |
|---|---|---|
| React | 19.2.4 | Framework UI principal |
| Vite | 8.0.4 | Build tool e dev server |
| TailwindCSS | 4.2.2 | Estilização utility-first |
| Three.js | 0.183.2 | Renderização 3D (WebGL) |
| @pixiv/three-vrm | 3.5.2 | Suporte a avatares no formato VRM |
| @avaturn/sdk | 1.1.4 | Integração com criador de avatares Avaturn |
| Zustand | 5.0.13 | Gerenciamento de estado global |
| React Router DOM | 7.14.0 | Roteamento SPA |
| Axios | 1.15.0 | Cliente HTTP |
| i18next | 26.0.4 | Internacionalização |
| react-i18next | 17.0.2 | Integração React do i18next |

**Nota TailwindCSS v4:** A versão 4 introduz mudanças de API importantes: gradientes usam `bg-linear-to-r` (não `bg-gradient-to-r`), e algumas classes de largura máxima usam nomenclatura canônica diferente.

**Nota Three.js r183:** A classe `THREE.Clock` foi depreciada; o projeto usa `THREE.Timer` com `clockRef.current.update()` por frame antes de `getDelta()`.

### 3.2 Backend

| Tecnologia | Versão | Função |
|---|---|---|
| Node.js | ≥ 18 | Runtime JavaScript |
| Express | 5.2.1 | Framework web |
| Mongoose | 9.4.1 | ODM para MongoDB |
| bcryptjs | 3.0.3 | Hash de senhas |
| jsonwebtoken | 9.0.3 | Geração e validação de JWT |
| multer | 2.1.1 | Upload de arquivos (audio, GLB) |
| express-rate-limit | 8.3.2 | Rate limiting por IP |
| resend | 6.12.3 | Envio de emails transacionais |
| uuid | 13.0.0 | Geração de IDs únicos (UUID v4) |
| cors | 2.8.6 | Middleware CORS |
| dotenv | 17.4.1 | Leitura de variáveis de ambiente |

---

## 4. ESTRUTURA DE ARQUIVOS DO PROJETO

```
avaturn-threejs/
├── package.json                    # Orquestrador raiz (npm run dev roda tudo)
├── docker-compose.yml              # Serviços: mongo, backend, frontend
├── CONTAR_CONTEXTO_COMPLETO.md    # Este documento
│
├── backend/
│   ├── server.js                   # Entry point Express, CORS, MongoDB
│   ├── .env                        # Variáveis de ambiente (não versionado)
│   ├── .env.example                # Template de variáveis
│   ├── controllers/
│   │   ├── authController.js       # register, login, me, forgotPw, resetPw, verifyEmail, resendVerification, updateAccount, changePassword
│   │   ├── sceneController.js      # saveScene, listScenes, getScene, deleteScene
│   │   ├── storyController.js      # saveStory, listStories, getStory, getPublicStory, deleteStory
│   │   ├── avatarController.js     # Integração Avaturn SDK
│   │   └── ttsController.js        # Proxy para ElevenLabs API
│   ├── models/
│   │   ├── User.js                 # Schema MongoDB do usuário
│   │   ├── Scene.js                # Schema MongoDB da cena
│   │   ├── Story.js                # Schema MongoDB da história
│   │   └── Avatar.js               # Schema MongoDB do avatar
│   ├── routes/
│   │   ├── authRoutes.js           # /api/auth/*
│   │   ├── sceneRoutes.js          # /api/scene/*
│   │   ├── storyRoutes.js          # /api/story/*
│   │   ├── mediaRoutes.js          # /api/media/audio, /api/media/model
│   │   ├── avatarRoutes.js         # /api/avatar/*
│   │   └── ttsRoutes.js            # /api/tts/generate
│   ├── middleware/
│   │   └── authMiddleware.js       # requireAuth (Bearer JWT)
│   └── uploads/                    # Arquivos enviados (audio/, models/)
│
└── frontend/
    ├── src/
    │   ├── main.jsx                # Entry point React
    │   ├── App.jsx                 # Router e rotas protegidas
    │   ├── i18n.js                 # Traduções PT/EN/ES/FR (~250 chaves)
    │   ├── auth/
    │   │   └── AuthContext.jsx     # Contexto de autenticação JWT
    │   ├── api/
    │   │   └── sceneApi.js         # Todas as chamadas HTTP (Axios)
    │   ├── store/
    │   │   └── useSceneStore.js    # Zustand store com persist middleware
    │   ├── context/
    │   │   └── ToastContext.jsx    # Sistema de notificações toast
    │   ├── hooks/
    │   │   ├── useAudio.js         # Web Audio API + lip sync config
    │   │   ├── useTTS.js           # Geração de voz ElevenLabs
    │   │   └── useScene.js         # Hook auxiliar de cena
    │   ├── controllers/
    │   │   ├── AnimationController.js  # Three.js mixer, blink, breathing, speaker gestures
    │   │   ├── LipSyncController.js    # Morph targets / blendshapes para lip sync
    │   │   └── AudioController.js      # Web Audio API wrapper
    │   ├── utils/
    │   │   └── BoneMapper.js       # Detecção de esqueleto (VRM/Mixamo/CC3/Generic)
    │   ├── pages/
    │   │   ├── LandingPage.jsx     # Home pública (/)
    │   │   ├── LoginPage.jsx       # Auth: login, registro, esqueci senha
    │   │   ├── ResetPasswordPage.jsx  # Redefinição de senha (/reset-password)
    │   │   ├── VerifyEmailPage.jsx    # Confirmação de email (/verify-email)
    │   │   ├── WelcomePage.jsx        # Boas-vindas pós-registro
    │   │   ├── EditorPage.jsx         # Editor principal (/editor)
    │   │   ├── ScenesPage.jsx         # Listagem de cenas (/scenes)
    │   │   ├── StoriesPage.jsx        # Listagem de histórias (/stories)
    │   │   ├── StoryViewerPage.jsx    # Viewer público (/story/:id)
    │   │   ├── ViewerPage.jsx         # Viewer de cena única (/scene/:id)
    │   │   ├── AccountPage.jsx        # Conta do usuário (/account)
    │   │   └── ARPage.jsx             # Realidade Aumentada (/ar)
    │   ├── components/
    │   │   ├── 3d/
    │   │   │   ├── SceneCanvas.jsx    # Three.js scene principal
    │   │   │   └── SpeechBubble.jsx   # Bolha de fala 3D
    │   │   └── ui/
    │   │       ├── Header.jsx         # Navbar com seletor de idioma
    │   │       ├── LeftPanel.jsx      # Painel de controles (tabs)
    │   │       ├── AudioPanel.jsx     # Controles de áudio e lip sync
    │   │       ├── WalkthroughTour.jsx # Tour guiado interativo
    │   │       ├── OnboardingOverlay.jsx # Onboarding primeira visita
    │   │       ├── HelpModal.jsx      # Modal de ajuda
    │   │       ├── Tooltip.jsx        # TooltipIcon (hover + click)
    │   │       ├── TransformControls.jsx # Controles de posição/escala
    │   │       ├── StoryBuilderPanel.jsx # Montagem de histórias
    │   │       ├── TimelinePanel.jsx  # Timeline de animações
    │   │       ├── SceneProgressBar.jsx  # Barra de progresso de conclusão
    │   │       ├── BottomNav.jsx      # Navegação mobile
    │   │       ├── PublishModal.jsx   # Modal de publicação
    │   │       └── AvaturnEmbed.jsx   # iFrame Avaturn SDK
    └── public/
        ├── ar-marker.html         # Demo AR.js com marcador Hiro
        ├── animation.glb          # Clipe de animação idle padrão
        └── brown_photostudio_01.hdr # Mapa de iluminação HDR
```

---

## 5. MODELOS DE DADOS (MongoDB)

### 5.1 User
```js
{
  name: String,
  email: String (unique, lowercase),
  passwordHash: String (bcrypt, 10 rounds),
  emailVerified: Boolean (default: false),
  emailVerificationToken: String (null após verificar),
  resetToken: String (null após usar),
  resetTokenExpiry: Date (null após usar),
  createdAt: Date
}
```

### 5.2 Scene
```js
{
  sceneId: String (UUID v4, unique),
  ownerId: String (userId do criador),
  metadata: {
    title: String,
    theme: String
  },
  content: {
    avatar: {
      modelUrl: String (URL HTTP do GLB),
      posePreset: String (idle|walk|run|dance|speaker|wave|etc.),
      transform: {
        position: [Number, Number, Number],
        rotation: [Number, Number, Number],  // radianos
        scale: [Number, Number, Number]
      }
    },
    narrative: {
      text: String (texto da fala),
      audioUrl: String (URL do arquivo de áudio no servidor),
      bubbleStyle: { color: String, fontSize: Number }
    },
    timeline: {
      duration: Number (segundos),
      blocks: Mixed (array de blocos de animação)
    }
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 5.3 Story
```js
{
  storyId: String (UUID v4, unique),
  ownerId: String,
  metadata: {
    title: String,
    description: String,
    language: String ('pt'|'en'|'es'|'fr')
  },
  scenes: [{
    sceneId: String (UUID v4),
    order: Number,
    transitionText: String,
    durationSeconds: Number
  }],
  createdAt: Date,
  updatedAt: Date  // atualizado automaticamente via pre-hook Mongoose
}
```

---

## 6. API REST — ENDPOINTS COMPLETOS

### 6.1 Autenticação (`/api/auth`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/register` | Pública | Registra usuário, envia email de confirmação via Resend |
| POST | `/login` | Pública | Retorna JWT (7 dias) |
| GET | `/me` | JWT | Dados do usuário autenticado |
| POST | `/forgot-password` | Pública | Gera token de reset (32 bytes, 1h), envia email |
| POST | `/reset-password` | Pública | Valida token, atualiza senha, invalida token |
| POST | `/verify-email` | Pública | Confirma email pelo token |
| POST | `/resend-verification` | JWT | Reenvia email de confirmação |
| PUT | `/account` | JWT | Atualiza nome do usuário |
| PUT | `/change-password` | JWT | Troca senha (exige senha atual) |

**Segurança auth:**
- Rate limit estrito: 10 req/15min nas rotas de reset e verificação
- Rate limit padrão: 100 req/15min nas demais
- JWT secret via variável de ambiente `AUTH_JWT_SECRET`
- Aviso em log se secret for o padrão inseguro

### 6.2 Cenas (`/api/scene`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/` | JWT | Cria ou atualiza cena (upsert por sceneId) |
| GET | `/` | JWT | Lista cenas do usuário (max 50, ordenado por updatedAt) |
| GET | `/:id` | Pública | Carrega cena por sceneId (público para viewer) |
| DELETE | `/:id` | JWT | Exclui cena (verifica ownerId) |

### 6.3 Histórias (`/api/story`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/` | JWT | Cria ou atualiza história (upsert por storyId+ownerId) |
| GET | `/` | JWT | Lista histórias do usuário (max 100, com sceneCount) |
| GET | `/public/:id` | Pública | Carrega história por ID (sem ownerId) para compartilhamento |
| GET | `/:id` | JWT | Carrega história do próprio usuário |
| DELETE | `/:id` | JWT | Exclui história (verifica ownerId) |

### 6.4 Mídia (`/api/media`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/audio` | JWT | Upload de arquivo de áudio (max 15 MB, mp3/wav/ogg/webm) |
| POST | `/model` | JWT | Upload de avatar GLB/VRM (max 50 MB) |

Ambos retornam `{ url: "https://servidor/uploads/tipo/arquivo.ext" }`. Os arquivos ficam em `backend/uploads/audio/` e `backend/uploads/models/`.

### 6.5 TTS (`/api/tts`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/generate` | JWT | Proxy para ElevenLabs API, retorna stream de áudio MP3 |

Modelo ElevenLabs usado: `eleven_multilingual_v2`. Retorna 503 se `ELEVENLABS_API_KEY` não estiver configurada.

### 6.6 Avatar (`/api/avatar`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/` | JWT | Salva referência de URL de avatar |
| POST | `/session` | JWT | Cria sessão Avaturn para o SDK |
| GET | `/list` | JWT | Lista avatares do usuário no Avaturn |

---

## 7. FUNCIONALIDADES IMPLEMENTADAS — CATÁLOGO COMPLETO

### 7.1 Sistema de Autenticação
- Registro com email e senha (mínimo 6 caracteres, hash bcrypt com 10 rounds)
- Login com JWT de 7 dias de validade, armazenado em `localStorage` com chave `auth:token`
- Confirmação de email via Resend (fluxo soft: usuário acessa o app antes de confirmar)
- Banner de aviso persistente enquanto email não confirmado, com botão "Reenviar"
- Esqueci minha senha: token de 32 bytes (crypto.randomBytes), expiração de 1 hora
- Troca de senha estando logado (exige senha atual)
- Atualização de nome no perfil
- Proteção de rotas via `ProtectedRoute` wrapper no React Router

### 7.2 Editor de Cenas (`/editor`)
O editor é o núcleo da plataforma. Estrutura em dois painéis: LeftPanel (controles) + SceneCanvas (visualização 3D).

**Painel esquerdo — 4 abas:**

**Aba Avatar:**
- Botão "Criar Avatar" — abre o Avaturn SDK em iframe (criador de avatar baseado em selfie)
- Importação de arquivo GLB/VRM local: preview imediato com blob URL + upload para o servidor em background. Se upload falhar, alerta o usuário que o avatar será perdido no refresh
- Listagem de avatares salvos na conta Avaturn
- Campo de URL GLB direta
- Seletor de pose (11 poses disponíveis)
- Configurações avançadas colapsáveis (posição X/Y/Z, rotação Y, escala)

**Aba Fala:**
- Campo de texto para a fala do narrador
- Botão "Aplicar" atualiza o speech bubble em tempo real no canvas
- Botão "Gerar Voz (TTS)" — chama ElevenLabs, gera MP3, carrega no player de áudio, sobe para o servidor e salva a URL
- Slider de intensidade da fala (controla `amplitudeMultiplier` do lip sync)
- AudioPanel completo: player, gravação de áudio pelo microfone, upload manual, viseme timeline

**Aba Cena:**
- Título da cena
- Botão Salvar (POST /api/scene)
- Botão "Adicionar à história atual"
- Exibição do sceneId atual

**Aba História:**
- Título e descrição da história
- Lista de cenas na história (reordenável)
- Botão Salvar/Publicar história
- Link de compartilhamento com botão Copiar

**Autosave:**
- Dispara 3 segundos após qualquer alteração significativa (avatarUrl, speechText, sceneTitle, posePreset, transform, timelineBlocks)
- Funciona mesmo antes do primeiro save manual (cria sceneId automaticamente)
- Status visual: "⏳ Salvando…" / "✅ Salvo às HH:MM"

### 7.3 Renderização 3D (Three.js)
Motor Three.js r183 com pipeline completo:

**SceneCanvas.jsx — configurações:**
- Renderer: WebGLRenderer com antialiasing, pixel ratio ≤ 2, tone mapping ACES filmic
- Câmera: PerspectiveCamera 45°, posição (0, 1.6, 3.5)
- Controles: OrbitControls com amortecimento
- Iluminação: HemisphereLight + DirectionalLight com sombras PCF Soft
- Ambiente: RGBELoader com HDR `brown_photostudio_01.hdr`
- Loader: GLTFLoader + DRACOLoader (decoder Gstatic 1.5.6) + VRMLoaderPlugin
- Cache Three.js ativo para evitar downloads repetidos
- Pausa automática quando fora da viewport (IntersectionObserver)

**Suporte a formatos de avatar:**
- GLB (GLTF binário com DRACO, padrão do mercado)
- VRM (formato humanóide do VirtualCast/VRoid, integração via @pixiv/three-vrm)
- Avatares Avaturn (exportam em GLB)
- Avatares Meshy.ai, Ready Player Me e outros fontes GLB genéricas

### 7.4 BoneMapper — Mapeamento de Esqueleto
`frontend/src/utils/BoneMapper.js`

Sistema de detecção automática da convenção de esqueleto de qualquer avatar 3D humanóide. Resolve 21 nomes padronizados (especificação VRM humanoid) a partir de 4 convenções:

1. **VRM** — usa `vrm.humanoid.getNormalizedBoneNode()` (zero ambiguidade)
2. **Mixamo** — detecta pelo prefixo `mixamorig:`, strip e match exato
3. **CC3/CC4** — detecta pelo prefixo `CC_Base_`, regex por nome
4. **Genérico** — regex amplos cobrindo Ready Player Me, Meshy.ai e outras fontes

**Ossos mapeados (21):** hips, spine, chest, upperChest, neck, head, jaw, leftShoulder, leftUpperArm, leftLowerArm, leftHand, rightShoulder, rightUpperArm, rightLowerArm, rightHand, leftUpperLeg, leftLowerLeg, leftFoot, rightUpperLeg, rightLowerLeg, rightFoot

**API pública:**
- `BoneMapper.fromGLTF(gltf)` — factory estático, detecta convenção automaticamente
- `.get(name)` — retorna o osso para um nome padrão
- `.has(name)` — verifica se o osso está mapeado
- `.set(name, bone)` — override de um osso específico
- `.clone()` — cópia independente (base para overrides de calibração)
- `.resolvedCount` — número de ossos mapeados
- `.source` — convenção detectada ('vrm'|'mixamo'|'cc3'|'generic'|'none')

**Painel de calibração (?dev):** Em modo dev (URL com `?dev`), o painel lateral exibe todos os 21 ossos com dropdowns para override manual em português.

### 7.5 AnimationController
`frontend/src/controllers/AnimationController.js`

Gerencia o Three.js AnimationMixer com animações procedurais sobrepostas:

**Animações de clipe:**
- `play(clipOrName, fadeDuration)` — crossfade suave entre animações
- `stopAll()` — para todas as animações
- `addClips(clips)` — adiciona clipes ao mixer

**Piscada (Blink):**
- Timer aleatório (2.5–6.5s entre piscadas)
- Piscada dupla com 25% de probabilidade
- Fase assimétrica: fechamento rápido (35% do tempo), abertura lenta (65%)
- Controla morph targets com regex `/blink/i`

**Respiração (Breathing):**
- Apenas quando sem animação de clipe ativa (`currentAction === null`)
- Duas frequências incomensurantes: base × 1 e base × φ (φ = razão áurea 1.618)
- Aplica offset relativo ao quaternion de repouso capturado (não acumula)
- BoneMapper preferencialmente para localizar chest/spine

**Gestos de palestrante (Speaker Gestures):**
- Ativado quando posePreset = 'speaker' sem clipe disponível
- Cabeça, pescoço, coluna: oscilações orgânicas com função `organic(base, a1, a2, a3, phase)`
- Braços e mãos: variações de fase distintas para esquerdo e direito
- Função organic: `a1·sin(t·f) + a2·sin(t·f·φ) + a3·sin(t·f·δ)` onde φ=1.618 e δ=2.414
- Frequências φ e δ são incomensurantes entre si e com 1 → padrão nunca se repete

**Resolução de ossos:** BoneMapper primeiro, fallback para regex inline.

### 7.6 LipSyncController
`frontend/src/controllers/LipSyncController.js`

Mapeia morph targets do avatar para grupos semânticos de visemas:

**Grupos de visemas:**
- `aa` — boca aberta (vowel open)
- `oh` — lábios arredondados
- `ee` — sorriso/estirado
- `fv` — lábio inferior em contato com dentes
- `mbp` — lábios fechados
- `mouthOpen` — fallback genérico

**Detecção automática:** Varredura de todos os meshes do avatar buscando morph targets por regex (`/blink/i`, `/viseme/i`, `/mouth/i`, `/jaw/i`).

**Fallback de mandíbula:** Quando não há morph targets, usa rotação do osso jaw com ângulo proporcional ao RMS do áudio.

**Pseudo-jaw rig:** Se nem jaw bone existe, usa osso head/neck com ângulo reduzido (6.5°) e fator de escala seguro.

### 7.7 Sistema de Lip Sync em Tempo Real
`frontend/src/hooks/useAudio.js` + análise em `SceneCanvas.jsx`

**Pipeline de áudio em tempo real:**
1. `AnalyserNode` Web Audio API conectado ao elemento `<audio>`
2. Por frame: `getByteTimeDomainData` (RMS) + `getByteFrequencyData` (bandas)
3. Cálculo de energia por banda: low (200-700 Hz), mid (700-2400 Hz), high (2400-5000 Hz), speech (300-3000 Hz)
4. Noise gate adaptativo: floor rastreado dinamicamente (rise speed / fall speed diferentes)
5. Suavização temporal: attack speed (rápido para abertura) e release speed (lento para fechamento)
6. Limite de delta máximo por segundo: evita jumps abruptos

**Dois modos de visema:**
- **Heurístico (tempo real):** distribui energia por banda nos grupos `aa`, `oh`, `ee`
- **Timeline (TTS):** usa cues de visema gerados a partir do texto, com crossfade de 80ms entre cues e floor mínimo quando áudio ativo

**Configuração via slider:** `amplitudeMultiplier` controlável pelo usuário (1–10 mapeado para 6–33).

### 7.8 Sistema de Poses
11 poses disponíveis:

| Pose | Tipo | Descrição |
|---|---|---|
| `idle` | Animação clipe | Loop de idle (animation.glb) |
| `walk` | Animação clipe | Caminhada animada |
| `run` | Animação clipe | Corrida animada |
| `dance` | Animação clipe | Dança animada |
| `speaker` | Procedural | Gestos de palestrante em tempo real |
| `neutral` | Estática | Pose T-pose relaxada |
| `wave` | Estática | Braço direito acenando |
| `hands_on_hips` | Estática | Mãos nos quadris |
| `salute` | Estática | Continência militar direita |
| `arms_crossed` | Estática | Braços cruzados |
| `t_pose` | Estática | T-pose canônica |

As poses estáticas usam `getBone(model, boneMapper, standardName, patterns)` — BoneMapper primeiro, regex como fallback. Os ângulos são aplicados com `rotateBoneDeg()` sobre o quaternion de repouso capturado.

### 7.9 Text-to-Speech (TTS)
`frontend/src/hooks/useTTS.js` + `backend/controllers/ttsController.js`

- Provedor: **ElevenLabs API** (multilingual v2)
- Fluxo: texto → POST /api/tts/generate → proxy Node.js → ElevenLabs → stream MP3
- Após geração: áudio carregado no player + viseme timeline gerada do texto + upload para servidor
- `onAudioReady(file)` — callback com o Blob de áudio
- `onVisemeReady(text)` — gera timeline de visemas heurística do texto para lip sync offline

### 7.10 Speech Bubble
`frontend/src/components/3d/SpeechBubble.jsx`

- Renderizado como overlay HTML posicionado em CSS sobre o canvas Three.js
- Posição calculada por `camera.project()` sobre a posição world da cabeça do avatar
- Oculto quando avatar fora da tela (position.z > 1)
- Aparência: fundo escuro semi-transparente com borda branca, seta triangular abaixo

### 7.11 Realidade Aumentada
`frontend/src/pages/ARPage.jsx` + `frontend/public/ar-marker.html`

**Duas tecnologias de AR:**

**1. WebXR Surface AR** (rota `/ar?mode=surface`):
- Usa `navigator.xr.isSessionSupported('immersive-ar')` assincronamente
- Requer: HTTPS + dispositivo com ARCore (Android) ou WebXR iOS 15+
- Plano de reticle detectado via XR Hit Test
- Avatar posicionado onde o usuário toca na câmera

**2. AR.js Marker AR** (rota `/ar?mode=marker` ou `/ar-marker.html`):
- Usa AR.js com A-Frame (funciona em qualquer câmera, sem HTTPS obrigatório)
- Marcador Hiro (padrão) ou marcador customizado (.patt)
- Demo acessível com botão "Demo Hiro" — avatar padrão no marcador Hiro impresso
- Fallback para navegadores sem suporte a WebXR

**Detecção automática de suporte:**
```
navigator.xr?.isSessionSupported('immersive-ar')
  → null: verificando
  → true: abre WebXR AR
  → false: mostra fallback com opção de AR.js
```

### 7.12 Story Viewer (`/story/:id`)
`frontend/src/pages/StoryViewerPage.jsx`

- Acesso **público** (sem login do espectador)
- Carrega história via `GET /api/story/public/:id`
- Tela de splash obrigatória antes de iniciar (resolve bloqueio de autoplay em HTTPS/mobile)
- `handleStart()` chama `audio.play()` diretamente no handler do click (gesto do usuário) — crucial para políticas de autoplay
- Sequência automática de cenas com timer configurável por cena
- Pré-carregamento do próximo GLB em background
- Controles: Play/Pause, Próxima/Anterior, Escala, Fullscreen mobile
- Barra de progresso vertical (desktop) e horizontal (mobile)
- Exibe: avatar 3D, speech bubble, áudio da narração com lip sync

### 7.13 Gestão de Conteúdo

**Minhas Cenas (`/scenes`):**
- Grid de cards com título, pose, data relativa, botões Editar/Ver/Excluir
- Editar abre `/editor?sceneId=X` que carrega todos os dados da cena
- Skeleton loading (4 cards animados)
- Empty state com CTA

**Minhas Histórias (`/stories`):**
- Grid de cards com título, descrição, contagem de cenas, data relativa
- Share link com botão "Copiar" (toggle para "✓ Copiado" por 2s)
- Botões Editar/Ver/Excluir
- Formulário colapsável para nova história
- Skeleton loading
- Empty state com CTA

**Conta (`/account`):**
- Atualizar nome
- Trocar senha (requer senha atual)

### 7.14 Tour Guiado e Ajuda Contextual

**WalkthroughTour:**
- 11 passos cobrindo toda a interface
- Spotlight SVG: overlay escuro com "janela" recortada sobre o elemento destacado + brilho ciano na borda
- Tooltip com posicionamento automático (direita → esquerda → abaixo → acima conforme espaço disponível)
- Progresso por pontos, botões Pular/Anterior/Próximo/Começar
- Detecta primeira visita via `localStorage['contar:tour-done']`
- Botão "? Tour" na navbar relança a qualquer momento
- Totalmente traduzido nas 4 línguas

**TooltipIcon:**
- Ícone "?" com tooltip por hover (desktop) e click (mobile/touch)
- Fecha ao clicar fora (PointerEvent listener)
- Usado em toda a interface ao lado de controles não óbvios

---

## 8. ESTADO GLOBAL (ZUSTAND)

`frontend/src/store/useSceneStore.js`

**Middleware persist** salva no `localStorage['contar:scene-store']`:

| Campo persistido | Tipo | Descrição |
|---|---|---|
| `avatarUrl` | String | URL HTTP do avatar (blob URLs descartadas) |
| `posePreset` | String | Pose atual |
| `transform` | Object | positionX/Y/Z, rotationY, scale |
| `speechText` | String | Texto da fala |
| `narrativeAudioUrl` | String | URL do áudio no servidor |
| `sceneTitle` | String | Título da cena sendo editada |
| `currentSceneId` | String | UUID da cena salva |
| `storyTitle` | String | Título da história |
| `storyDescription` | String | Descrição da história |
| `currentStoryId` | String | UUID da história vinculada |
| `storyScenes` | Array | Cenas na história com ordem e duração |
| `timelineBlocks` | Array | Blocos da timeline de animação |
| `timelineDuration` | Number | Duração total da timeline |

**Campos NÃO persistidos** (carregados da API a cada sessão):
- `sceneTitlesById`, `publishedStoryId`

**Migração de versão anterior:** `onRehydrateStorage` detecta e descarta blob URLs legadas e migra a chave `avaturn:lastAvatarUrl`.

---

## 9. INTERNACIONALIZAÇÃO (i18n)

`frontend/src/i18n.js`

- **Framework:** i18next + react-i18next
- **Idiomas:** Português (padrão), Inglês, Espanhol (es-419), Francês (fr-FR)
- **Chaves:** ~250 chaves cobrindo 100% dos textos de interface
- **Idioma padrão:** `pt` (app educacional brasileiro)
- **Pluralização:** sufixos `_one` e `_other` para i18next count
- **Interpolação:** `{{variável}}` para datas, nomes, contagens
- **Seletor no header:** `<select>` com 4 opções com bandeiras e nome do idioma em cada língua

**Cobertura de páginas:**
Todas as páginas e componentes UI usam `useTranslation()` e `t('chave')` — zero strings hardcoded em JSX. Arrays de conteúdo dinâmico (features, steps, tour steps) são funções `getXxx(t)` chamadas dentro do componente para reatividade ao trocar idioma.

---

## 10. SEGURANÇA

### 10.1 Autenticação e autorização
- JWT stateless, secret via variável de ambiente, aviso em log se padrão inseguro
- Middleware `requireAuth` valida Bearer token em todas as rotas protegidas
- Propriedade `ownerId` em Scene e Story — DELETE e listagem verificam ownerId antes de agir
- `sceneId` e `storyId` validados por regex UUID v4 antes de qualquer query (previne NoSQL injection)

### 10.2 Rate limiting
- Rotas padrão: 100 req/15min por IP
- Rotas de upload: 20 req/15min (GLB), 60 req/15min (áudio)
- Rotas de auth sensíveis (reset, verify): 10 req/15min
- TTS: 30 req/15min

### 10.3 Validação de entrada
- Campos de metadata e content: verificação `typeof === 'object' && !Array.isArray()` (previne operator injection)
- Tamanho máximo JSON: 2MB
- Uploads: MIME type + extensão verificados; limites de tamanho configuráveis
- Senhas: mínimo 6 caracteres, hash bcrypt 10 rounds

### 10.4 CORS
Configurado via variável `CORS_ORIGIN` (suporta múltiplas origens separadas por vírgula). Padrão local inclui `http://localhost:5173`.

### 10.5 Reset de senha
- Token: `crypto.randomBytes(32).toString('hex')` — 256 bits de entropia
- Expiração: 1 hora
- Single-use: token zerado após uso
- Anti-enumeration: resposta idêntica para emails cadastrados e não cadastrados

---

## 11. DEPLOY E INFRAESTRUTURA

### 11.1 Docker Compose
`docker-compose.yml` define 3 serviços:
- `mongo` — MongoDB 7, volume `mongo_data` persistente
- `backend` — Node.js na porta 3001, volume `uploads_data` para arquivos enviados
- `frontend` — nginx na porta 80/5173, build estático do Vite

### 11.2 Variáveis de ambiente obrigatórias (backend)
```
PORT=3001
MONGODB_URI=mongodb+srv://...
AUTH_JWT_SECRET=<string longa e aleatória>
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=ContAR <noreply@seudominio.com>
FRONTEND_URL=https://seudominio.com
CORS_ORIGIN=http://localhost:5173,https://seudominio.com
ELEVENLABS_API_KEY=<opcional — TTS desabilitado sem esta chave>
```

### 11.3 HTTPS obrigatório em produção
WebXR e Web Audio API exigem HTTPS. Microfone, AR de superfície e políticas de autoplay não funcionam em HTTP (exceto `localhost`).

### 11.4 Arquivos enviados (uploads)
Armazenados localmente no servidor em `backend/uploads/audio/` e `backend/uploads/models/`. Volume Docker `uploads_data` garante persistência entre restarts. Em escala, a migração seria para S3/Cloudflare R2.

---

## 12. HISTÓRICO DE DESENVOLVIMENTO (BRANCHES E FEATURES)

| Branch | Feature |
|---|---|
| `feature/lipsync-and-lazy-loading` | Lip sync, BoneMapper, AudioController, TTS, AR melhorias, landing page, onboarding, toasts, mobile, tour |
| `feature/ui-walkthrough` | WalkthroughTour interativo com spotlight SVG, TooltipIcon click/hover |
| `feature/release-p0` | Zustand persist, upload GLB, autosave sem sceneId, página Minhas Cenas |
| `feature/release-mitigations` | Reset de senha (Resend), volume Docker, JWT secret warning |
| `feature/email-verification` | Confirmação de email, banner no Header, VerifyEmailPage |
| `feature/delete-and-account` | Delete cenas/histórias, AccountPage, PUT /account, PUT /change-password |
| `feature/viewer-autoplay` | Splash screen no viewer, fix de autoplay em HTTPS/mobile |
| `feature/landing-redesign` | Redesign completo da home com Counter animado, mockup CSS do produto |
| `feature/stories-redesign` | Redesign /stories com skeleton, share link, empty state, sceneCount |
| `feature/i18n-complete` | Migração PT/EN/ES/FR completa, ~250 chaves, seletor de 4 idiomas |
| `feature/login-improvements` | CORS fix, erros humanizados, toggle senha, shake animation |

---

## 13. FLUXO COMPLETO DE USO

### 13.1 Criador de conteúdo
1. Abre `contar.app` → vê landing page em português
2. Clica "Criar conta grátis" → preenche email e senha → recebe email de confirmação (Resend)
3. É redirecionado para `/stories`
4. Clica "+ Nova História" → dá título → vai para `/editor?storyId=X`
5. No editor, na aba Avatar: clica "Criar Avatar" → cria avatar no Avaturn → exporta → URL GLB aparece no canvas
6. Ou: carrega arquivo GLB local → upload automático para servidor → URL HTTP persistida
7. Escolhe pose "Speaker" → avatar faz gestos procedurais orgânicos
8. Na aba Fala: escreve texto → clica "Gerar Voz (TTS)" → áudio gerado e lábios sincronizam
9. Aba Cena: dá título → Salvar (autosave já teria salvo)
10. Aba História: adiciona cena à história → Salvar História
11. Copia link de compartilhamento

### 13.2 Espectador
1. Recebe link `/story/UUID`
2. Abre no navegador (sem login necessário)
3. Vê tela de splash com título, descrição, botão ▶
4. Clica ▶ → áudio começa a tocar, avatar fala com lip sync, cenas avançam automaticamente
5. Pode pausar, avançar, voltar
6. Opcional: clica "Abrir AR de Superfície" → aponta câmera para o chão → avatar aparece na mesa

---

## 14. DECISÕES DE DESIGN TÉCNICO RELEVANTES

### 14.1 Por que Three.js ao invés de Babylon.js ou A-Frame?
Three.js oferece controle granular sobre o pipeline de renderização, necessário para a integração custom de lip sync (morph targets por frame), o AnimationController procedural e o BoneMapper. A-Frame é usado apenas para o AR de marcador (AR.js) por compatibilidade.

### 14.2 Por que Zustand ao invés de Redux?
Menor boilerplate, API mais simples, suporte nativo a middleware `persist` sem configuração complexa. O padrão de slices (`createAvatarSlice`, `createSpeechSlice`, `createStorySlice`) mantém a organização sem a verbosidade do Redux Toolkit.

### 14.3 Por que JWT stateless ao invés de sessions?
O backend pode ser escalado horizontalmente sem sincronização de sessão. O payload do token contém `userId` e `email` suficientes para todas as verificações de autorização.

### 14.4 Por que frequências irracionais nas animações procedurais?
A razão áurea φ=1.618 e a razão de prata δ=2.414 são matematicamente incomensurantes entre si e com 1. Isso garante que a combinação `a1·sin(t·f) + a2·sin(t·f·φ) + a3·sin(t·f·δ)` nunca se repita de forma perceptível, produzindo movimento orgânico sem artificialidade. Técnica inspirada em síntese de texturas procedurais.

### 14.5 Por que blob URLs locais + upload em background?
Garante feedback imediato (avatar aparece instantaneamente) enquanto o upload ocorre assincronamente. Se o upload falhar, o usuário ainda vê o avatar e recebe um aviso — não um estado de erro bloqueante.

### 14.6 Por que splash screen obrigatória no viewer?
Políticas de autoplay do browser (Chrome, Safari, Firefox) bloqueiam `HTMLAudioElement.play()` quando chamado de `useEffect` (não é considerado gesto do usuário). Ao chamar `audio.play()` diretamente no handler do clique no botão ▶, o browser considera o contexto de gesto válido e a reprodução é autorizada para toda a sessão.

### 14.7 Por que confirmação de email "soft" (sem bloquear acesso)?
Para reduzir atrito no onboarding, especialmente em contexto educacional onde o professor pode criar conta em sala de aula. O banner de aviso incentiva a confirmação sem impedir o uso imediato da ferramenta.

---

## 15. LIMITAÇÕES CONHECIDAS DA V1.0

| Limitação | Impacto | Mitigação/Status |
|---|---|---|
| Uploads GLB armazenados localmente | Não escala para múltiplos servidores; arquivos podem ser perdidos se volume não estiver configurado | Volume Docker `uploads_data` implementado; migração para S3/R2 planejada para v1.1 |
| TTS requer conta paga ElevenLabs | Sem a chave, botão TTS retorna 503 | Toast informativo; usuário pode gravar áudio próprio |
| WebXR AR exige HTTPS + ARCore/iOS 15+ | Não funciona em HTTP ou dispositivos antigos | Demo Hiro via AR.js como fallback |
| Sem CDN para arquivos estáticos | Latência pode ser alta para GLBs grandes | Aceitável para TCC; cache Three.js ativo minimiza impacto |
| Sem reset de senha em PT para erros do backend | Alguns erros de API chegam em inglês | `friendlyError()` no frontend mapeia os principais |
| Email com domínio não verificado no Resend | `onboarding@resend.dev` só envia para o email da conta Resend | Configurar domínio próprio em resend.com/domains |

---

## 16. ROADMAP V1.1 (PÓS-RELEASE)

1. Migração de uploads para Cloudflare R2 / Amazon S3
2. Thumbnails reais de cenas (screenshot do canvas)
3. Escolha de voz no TTS (múltiplas vozes ElevenLabs)
4. Exportar história como PDF / SCORM (para LMS)
5. Colaboração multi-usuário em histórias
6. Reordenação visual de cenas com drag-and-drop
7. Mais idiomas (Italiano, Alemão, Árabe)
8. Analytics de visualização (contagem de views por história)

---

## 17. REFERÊNCIAS TECNOLÓGICAS PARA O ARTIGO

- **Three.js:** Cabello, R. et al. (2010–2024). *Three.js — JavaScript 3D Library*. https://threejs.org
- **WebXR:** Cabanier, E. et al. (2021). *WebXR Device API*. W3C. https://www.w3.org/TR/webxr/
- **Web Audio API:** Adenot, P., Wilson, C. (2021). *Web Audio API*. W3C. https://www.w3.org/TR/webaudio/
- **VRM:** *VRM — 3D Avatar File Format for VR*. https://vrm.dev
- **ElevenLabs:** *ElevenLabs Text-to-Speech API*. https://elevenlabs.io/docs
- **AR.js:** *AR.js — Augmented Reality for the Web*. https://ar-js-org.github.io/AR.js-Docs/
- **Zustand:** Poimandres (2019–2024). *Zustand — Bear necessities for state management in React*. https://zustand-demo.pmnd.rs
- **i18next:** *i18next — i18n framework built to last*. https://www.i18next.com
- **React:** Meta (2013–2024). *React 19*. https://react.dev
- **Razão Áurea em Animação:** Finch, A. (2010). *How to Give Your Animations Organic Feeling*. GDC Talk.
- **Autoplay Policy:** Google Developers (2017). *Autoplay Policy Changes*. https://developer.chrome.com/blog/autoplay/
- **Morph Targets/Blendshapes:** *glTF 2.0 Specification — Morph Targets*. Khronos Group. https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets

---

*Documento gerado em maio de 2026. Versão do código: commit `74e5781` (main).*
*Plataforma em produção: https://avaturn-threejs-1.onrender.com*
