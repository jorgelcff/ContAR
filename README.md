# ContAR

Plataforma web **no-code** para criação, publicação e compartilhamento de narradores virtuais 3D interativos com fala, lip sync e realidade aumentada.

## Resumo institucional (TCC/UFPE)

O **ContAR** (*Contar + AR*) integra, em um único ambiente web, os principais blocos para autoria de experiências educacionais com avatar 3D:

- criação/importação de avatar;
- composição de cenas e histórias;
- síntese de voz (TTS);
- sincronização labial em tempo real;
- publicação por link público;
- visualização em AR no navegador.

**Contexto acadêmico:**

- **Instituição:** CIn/UFPE
- **Projeto:** Trabalho de Conclusão de Curso
- **Título:** *Desenvolvimento de um Ecossistema Integrado No-Code para Autoria e Publicação de Narradores Virtuais*

Referências principais:

- Repositório: https://github.com/jorgelcff/avaturn-threejs
- Produção: https://avaturn-threejs-1.onrender.com

## Escopo atual (sem marketing)

O ContAR já cobre o fluxo principal de autoria:

- criar/carregar avatar;
- escrever texto e gerar narração;
- salvar cenas e montar história;
- publicar com link público;
- visualizar em viewer web e modos AR.

Limites atuais importantes:

- a validação principal ainda é no frontend; backend ainda não possui suíte de testes real;
- parte da experiência mobile e do onboarding segue em ajuste;
- alguns fluxos de AR dependem de compatibilidade do navegador/dispositivo.

## Guia rápido para desenvolvedores

### Pré-requisitos

- Node.js 18+
- npm
- MongoDB local **ou** Docker

### Setup local (sem Docker)

```bash
npm run install:all
cp backend/.env.example backend/.env
npm run dev
```

URLs locais:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

### Setup com Docker

```bash
cp .env.example .env
cp backend/.env.example backend/.env
docker compose up --build
```

Serviços:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- MongoDB: `mongodb://localhost:27017/avaturn3d`

## Documentos de contexto do ContAR

- `CONTAR_CONTEXTO_COMPLETO.md` — fonte de verdade técnica e acadêmica
- `EXPERIENCE_WALKTHROUGH.md` — walkthrough completo da experiência
- `PROJECT_ROADMAP.md` e `PROJECT_ROADMAP_v2.md` — roadmap do produto
- `PLAN_UX_v1.md` — diretrizes de UX
- `RELEASE_2_PLANEJAMENTO.md` — planejamento de release

## Arquitetura e stack

```text
Frontend (React SPA)  ->  Backend (Node/Express API)  ->  MongoDB
```

- **Frontend:** React 19, Vite, TailwindCSS v4, Three.js, Zustand, i18next
- **Backend:** Node.js, Express 5, Mongoose, JWT, Multer
- **Infra local:** Docker Compose (mongo + backend + frontend)

Estrutura:

```text
ContAR/
├── frontend/
├── backend/
├── public/
├── docker-compose.yml
├── CONTAR_CONTEXTO_COMPLETO.md
└── EXPERIENCE_WALKTHROUGH.md
```

## API principal

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

- `npm run dev`
- `npm run dev:backend`
- `npm run dev:frontend`
- `npm run install:all`

### Frontend

- `npm run dev --prefix frontend`
- `npm run build --prefix frontend`
- `npm run lint --prefix frontend`

### Backend

- `npm run dev --prefix backend`
- `npm start --prefix backend`

## Variáveis de ambiente (backend)

Com base em `backend/.env.example`:

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

> Observação: o backend também suporta Azure Speech TTS quando `AZURE_SPEECH_KEY` e `AZURE_SPEECH_REGION` estão definidos.

## Estado atual de validação

- `npm run lint --prefix frontend` → possui erros preexistentes no repositório
- `npm run build --prefix frontend` → build concluído com sucesso
- `npm test --prefix backend` → script placeholder (falha por padrão)

## Licença

Projeto acadêmico do ContAR (TCC/UFPE). Defina a licença formal do repositório conforme estratégia de publicação.
