# Avaturn 3D Scene Builder

A full-stack web application for creating, publishing, and viewing educational 3D avatar scenes.
Users paste a GLB avatar URL (or create one via the embedded Avaturn editor), position it in a 3D scene, add speech bubbles, then publish a shareable link.

![Avaturn Three.js example](https://assets.avaturn.me/docs/three-js-example.jpg)

## Features

| Feature | Detail |
|---|---|
| **Avatar creation** | Embedded Avaturn iframe or direct GLB URL |
| **3D scene** | Three.js — OrbitControls, HDR env map, PCF shadows, DRACOLoader, idle animations |
| **Transform controls** | Simplified sliders: position X/Y/Z, rotation Y, scale |
| **Speech bubbles** | HTML overlay synced to avatar head via `camera.project()` |
| **Publish & share** | Saves scene to MongoDB, returns unique URL |
| **Scene viewer** | Read-only at `/scene/:id` with Web Speech API auto-play |
| **i18n** | English 🇺🇸 and Portuguese 🇧🇷 — toggle in header |

## Architecture

```
/frontend     React 18 + Vite + TailwindCSS + Three.js
/backend      Node.js + Express + MongoDB (Mongoose)
/public       Original vanilla demo assets (preserved)
index.html    Original vanilla JS demo
```

## Quick Start

### Backend

```bash
cd backend
npm install
cp .env.example .env   # edit MONGODB_URI if needed
node server.js         # → http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # → http://localhost:5173/editor
```

Open **http://localhost:5173/editor** to start building scenes.  
Shared scenes are available at **http://localhost:5173/scene/:id**.

## Run With Docker

Prerequisite: Docker Desktop (or Docker Engine + Compose) installed.

1. Copy `.env.example` to `.env` at the project root and fill in the frontend Avaturn values.
2. Copy `backend/.env.example` to `backend/.env` and fill in the backend values.
3. From the project root, run:

```bash
docker compose up --build
```

On Windows, you can use the helper script instead:

```powershell
.\deploy.cmd
```

Common actions:

- `.\deploy.cmd` or `.\deploy.cmd -Action up -Build` to start the stack
- `.\deploy.cmd -Action down` to stop the stack
- `.\deploy.cmd -Action down -RemoveVolumes` to stop and remove MongoDB data
- `.\deploy.cmd -Action status` to inspect running containers
- `.\deploy.cmd -Action logs` to follow logs

On Ubuntu/Linux, use:

```bash
chmod +x deploy.sh
./deploy.sh
```

Common actions:

- `./deploy.sh` or `./deploy.sh -Action up -Build` to start the stack
- `./deploy.sh -Action down` to stop the stack
- `./deploy.sh -Action down -RemoveVolumes` to stop and remove MongoDB data
- `./deploy.sh -Action status` to inspect running containers
- `./deploy.sh -Action logs` to follow logs

## Render Blueprint

This repository now includes a Render Blueprint at [render.yaml](render.yaml) so you can deploy the app as two Docker services on Render:

- `avaturn-backend` for the API
- `avaturn-frontend` for the web UI

Important: MongoDB is not provisioned by the Blueprint. You must set `MONGODB_URI` to a MongoDB Atlas URI or another external MongoDB instance when creating the Blueprint.

The frontend proxies `/api` to the backend through Render's private service network, so the same app code works without changing the frontend API paths.

Services and URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`
- MongoDB: `mongodb://localhost:27017/avaturn3d`

Frontend Avaturn options are baked into the build via the root `.env` file:

- `VITE_AVATURN_DIRECT_URL`
- `VITE_AVATURN_SUBDOMAIN`
- `VITE_AVATURN_DISABLE_BACKEND_FALLBACK`
- `VITE_AVATURN_USER_ID`

To stop containers:

```bash
docker compose down
```

To also remove MongoDB persisted volume:

```bash
docker compose down -v
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017/avaturn3d` | MongoDB connection string |
| `PORT` | `3001` | Backend port |
| `AVATURN_API_TOKEN` | _required_ | Avaturn API token used by the backend |
| `AVATURN_API_BASE_URL` | `https://api.avaturn.me/api/v1` | Avaturn API base URL |
| `VITE_AVATURN_DIRECT_URL` | _optional_ | Frontend direct Avaturn session URL |
| `VITE_AVATURN_SUBDOMAIN` | _optional_ | Frontend Avaturn subdomain |
| `VITE_AVATURN_DISABLE_BACKEND_FALLBACK` | `false` | Disable backend fallback in the frontend |
| `VITE_AVATURN_USER_ID` | _optional_ | Fixed Avaturn user ID used by the frontend |

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/scene` | Save/update scene → `{ sceneId }` |
| `GET` | `/api/scene/:id` | Load scene by ID |
| `POST` | `/api/avatar` | Store avatar URL → `{ avatarId }` |

Read more at [docs.avaturn.me](https://docs.avaturn.me).