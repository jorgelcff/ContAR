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

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017/avaturn3d` | MongoDB connection string |
| `PORT` | `3001` | Backend port |

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/scene` | Save/update scene → `{ sceneId }` |
| `GET` | `/api/scene/:id` | Load scene by ID |
| `POST` | `/api/avatar` | Store avatar URL → `{ avatarId }` |

Read more at [docs.avaturn.me](https://docs.avaturn.me).