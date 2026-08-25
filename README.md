# ContAR

**No-code** web platform for creating, publishing, and sharing interactive 3D virtual narrators with speech, lip sync, and augmented reality.

## Research context

ContAR originated from academic research at the Centro de Informática (CIn), Universidade Federal de Pernambuco (UFPE), and is presented as a paper at **SVR (Symposium on Virtual and Augmented Reality)**.

## References

- Repository: https://github.com/jorgelcff/avaturn-threejs
- Production: https://avaturn-threejs-1.onrender.com

## Current scope (no marketing)

ContAR already covers the main authoring flow:

- create/load an avatar;
- write text and generate narration;
- save scenes and assemble a story;
- publish with a public link;
- view in the web viewer and AR modes.

Important current limitations:

- test coverage is still thin — unit tests cover the API and a few core frontend modules, and E2E covers responsive layout, contrast, and auth, but most flows still lack an automated check;
- parts of the mobile experience and onboarding are still being refined;
- some AR flows depend on browser/device compatibility.

## Quick start for developers

### Prerequisites

- Node.js 18+
- npm
- Local MongoDB **or** Docker

### Local setup (without Docker)

```bash
npm run install:all
cp backend/.env.example backend/.env
npm run dev
```

Local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

### Setup with Docker

```bash
cp .env.example .env
cp backend/.env.example backend/.env
docker compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- MongoDB: `mongodb://localhost:27017/avaturn3d`

## Architecture and stack

```text
Frontend (React SPA)  ->  Backend (Node/Express API)  ->  MongoDB
```

- **Frontend:** React 19, Vite, TailwindCSS v4, Three.js, Zustand, i18next
- **Backend:** Node.js, Express 5, Mongoose, JWT, Multer
- **Local infra:** Docker Compose (mongo + backend + frontend)

Structure:

```text
ContAR/
├── frontend/
├── backend/
└── docker-compose.yml
```

## Main API

### Auth (`/api/auth`)

- `POST /register`
- `POST /login`
- `GET /me`
- `POST /forgot-password`
- `POST /reset-password`
- `POST /verify-email`
- `POST /resend-verification`
- `PUT /account`
- `PUT /change-password`

### Scenes (`/api/scene`)

- `POST /`
- `GET /`
- `GET /:id`
- `DELETE /:id`

### Stories (`/api/story`)

- `POST /`
- `GET /`
- `GET /public/:id`
- `GET /:id`
- `DELETE /:id`

### Media (`/api/media`)

- `POST /audio`
- `POST /model`

### TTS (`/api/tts`)

- `POST /generate`

### Avatars (`/api/avatar`)

- `POST /`
- `POST /session`
- `GET /list`

## Useful scripts

### Root

- `npm run dev`
- `npm run dev:backend`
- `npm run dev:frontend`
- `npm run install:all`
- `npm run test:e2e` — Playwright, full stack (see [Testing](#testing) below)

### Frontend

- `npm run dev --prefix frontend`
- `npm run build --prefix frontend`
- `npm run lint --prefix frontend`

### Backend

- `npm run dev --prefix backend`
- `npm start --prefix backend`

## Environment variables (backend)

Based on `backend/.env.example`:

- `PORT`
- `MONGODB_URI`
- `AUTH_JWT_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `FRONTEND_URL`
- `CORS_ORIGIN`
- `TRUST_PROXY`
- `ELEVENLABS_API_KEY` (optional)
- `AVATURN_API_TOKEN` (optional)
- `AVATURN_API_BASE_URL` (optional)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — **required in production**: without these three, avatar/audio uploads fall back to local disk, which is ephemeral on Render and gets wiped on every deploy/restart

> Note: the backend also supports Azure Speech TTS when `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` are set.

## Testing

Three layers, all safe to run without touching the real (Atlas) database:

- **Backend unit** — `npm test --prefix backend` (Vitest + Supertest). `backend/app.js` exports the Express app separately from `server.js` (which owns the real `mongoose.connect`); tests import only `app.js` and run against `mongodb-memory-server`.
- **Frontend unit** — `npm test --prefix frontend` (Vitest). Scoped to pure logic — `BoneMapper` (rig detection) and `useSceneStore` — not full component rendering.
- **E2E** — `npm run test:e2e` at the repo root (Playwright). Drives the real UI against a full stack: both the frontend dev server and a backend instance are started automatically, the backend pointed at its own in-memory MongoDB via `backend/scripts/serve-e2e.js`. Registers disposable test users per run — never touches a real account. Covers responsive layout (no horizontal overflow across mobile/tablet/desktop), light-theme contrast regressions, auth, and a couple of editor-flow regressions. See `e2e/`.

## Current validation status

- `npm run lint --prefix frontend` → has pre-existing errors in the repository
- `npm run build --prefix frontend` → builds successfully
- `npm audit` (frontend and backend) → 0 known vulnerabilities
- the backend refuses to start in production (`NODE_ENV=production`) without a real `AUTH_JWT_SECRET` set

## License

Formal license to be defined based on publication strategy.
