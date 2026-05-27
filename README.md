# ContAR

Plataforma web **no-code** para criação, publicação e compartilhamento de narradores virtuais 3D interativos com suporte a fala, lip sync e visualização em realidade aumentada.

- **Repositório:** https://github.com/jorgelcff/avaturn-threejs
- **Produção:** https://avaturn-threejs-1.onrender.com
- **Contexto acadêmico:** TCC (CIn/UFPE) — *Desenvolvimento de um Ecossistema Integrado No-Code para Autoria e Publicação de Narradores Virtuais*

## O que você consegue fazer

- Criar/importar avatares (Avaturn, GLB, VRM)
- Montar cenas 3D com pose, transformação e fala
- Gerar narração com TTS (Azure ou ElevenLabs, conforme configuração)
- Sincronizar fala e movimento labial (lip sync)
- Agrupar cenas em histórias publicáveis por link
- Exibir histórias em modo viewer e em AR (WebXR + fallback por marcador)

## Arquitetura

```text
Frontend (React SPA)  ->  Backend (Node/Express API)  ->  MongoDB
```

### Stack principal

- **Frontend:** React 19, Vite, TailwindCSS v4, Three.js, Zustand, i18next
- **Backend:** Node.js, Express 5, Mongoose, JWT, Multer
- **Banco:** MongoDB
- **Infra:** Docker Compose (mongo + backend + frontend)

## Estrutura do projeto

```text
avaturn-threejs/
├── frontend/                  # App React (editor, viewer, AR, páginas)
├── backend/                   # API REST + autenticação + uploads + TTS
├── public/                    # Assets legados de demo
├── docker-compose.yml         # Stack local completa
├── CONTAR_CONTEXTO_COMPLETO.md
├── EXPERIENCE_WALKTHROUGH.md
├── PROJECT_ROADMAP.md
└── PROJECT_ROADMAP_v2.md
```

## Documentos de contexto do ContAR

Para entendimento completo do projeto, use estes arquivos:

- `CONTAR_CONTEXTO_COMPLETO.md` — fonte de verdade técnica e acadêmica
- `EXPERIENCE_WALKTHROUGH.md` — jornada de uso ponta a ponta
- `PROJECT_ROADMAP.md` e `PROJECT_ROADMAP_v2.md` — planejamento e roadmap
- `PLAN_UX_v1.md` — direcionamento de experiência
- `RELEASE_2_PLANEJAMENTO.md` — plano de release

## Como rodar localmente (sem Docker)

### 1) Instalar dependências

Na raiz do projeto:

```bash
npm run install:all
```

### 2) Configurar variáveis de ambiente

- Copie `backend/.env.example` para `backend/.env`
- (Opcional para Docker build) copie `.env.example` para `.env`

### 3) Subir backend e frontend juntos

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## Como rodar com Docker

1. Copie os arquivos de exemplo de ambiente:
   - `.env.example` → `.env`
   - `backend/.env.example` → `backend/.env`
2. Execute:

```bash
docker compose up --build
```

Serviços:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- MongoDB: `mongodb://localhost:27017/avaturn3d`

## Variáveis de ambiente (backend)

Baseado em `backend/.env.example`:

- `PORT`
- `MONGODB_URI`
- `AUTH_JWT_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `FRONTEND_URL`
- `CORS_ORIGIN`
- `TRUST_PROXY`
- `ELEVENLABS_API_KEY` (opcional)
- `AVATURN_API_TOKEN` (opcional)
- `AVATURN_API_BASE_URL` (opcional)

> Observação: o backend também suporta TTS com Azure Speech quando `AZURE_SPEECH_KEY` e `AZURE_SPEECH_REGION` estão configurados.

## Rotas principais da API

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

### Cenas (`/api/scene`)

- `POST /`
- `GET /`
- `GET /:id`
- `DELETE /:id`

### Histórias (`/api/story`)

- `POST /`
- `GET /`
- `GET /public/:id`
- `GET /:id`
- `DELETE /:id`

### Mídia (`/api/media`)

- `POST /audio`
- `POST /model`

### TTS (`/api/tts`)

- `POST /generate`

### Avatares (`/api/avatar`)

- `POST /`
- `POST /session`
- `GET /list`

## Scripts úteis

### Raiz

- `npm run dev` — sobe backend + frontend em paralelo
- `npm run dev:backend`
- `npm run dev:frontend`
- `npm run install:all`

### Frontend (`frontend/package.json`)

- `npm run dev --prefix frontend`
- `npm run build --prefix frontend`
- `npm run lint --prefix frontend`

### Backend (`backend/package.json`)

- `npm run dev --prefix backend`
- `npm start --prefix backend`

## Estado atual de qualidade

No estado atual do repositório:

- `npm run lint --prefix frontend` apresenta erros preexistentes
- `npm run build --prefix frontend` executa com sucesso
- `npm test --prefix backend` é placeholder e falha por padrão

## Licença

Projeto acadêmico do ContAR (TCC/UFPE). Defina a licença formal do repositório conforme necessidade de publicação.
