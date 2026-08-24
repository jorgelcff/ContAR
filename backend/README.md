# ContAR — Backend

REST API in Node.js + Express 5 with MongoDB (Mongoose). Full setup, environment variables, and architecture overview live in the [root README](../README.md).

## Running standalone

```bash
npm install
cp .env.example .env   # fill in AUTH_JWT_SECRET, MONGODB_URI, etc.
npm run dev            # node --watch server.js, http://localhost:3001
npm start               # production
```

Without `AUTH_JWT_SECRET` set, the server refuses to start when `NODE_ENV=production` (see `config/auth.js`). Without the `CLOUDINARY_*` variables, avatar/audio uploads fall back to local disk — fine in dev, but destructive in production (Render's disk is ephemeral).

## Structure

```text
├── server.js          bootstrap: env, CORS, routes, MongoDB connection
├── config/
│   ├── auth.js          JWT secret resolution (fail-fast in production)
│   └── cloudinary.js     media upload/delete (with local-disk fallback)
├── routes/               one file per resource, defines rate limits and auth middleware
├── controllers/          logic for each resource
├── models/               Mongoose schemas
└── middleware/
    └── authMiddleware.js  requireAuth — validates the JWT from the Authorization header
```

## Resources and routes

| Base | Controller | Notes |
|---|---|---|
| `/api/auth` | `authController.js` | registration, login, password reset (Resend), email verification |
| `/api/scene` | `sceneController.js` | scene CRUD (`GET /:id` is public, the rest requires auth) |
| `/api/story` | `storyController.js` | story CRUD (`GET /public/:id` is public) |
| `/api/media` | — (routes in `mediaRoutes.js`) | audio/3D model upload → Cloudinary |
| `/api/tts` | `ttsController.js` | speech synthesis (Azure Speech or ElevenLabs) |
| `/api/avatar` | `avatarController.js` | Avaturn SDK/API integration |
| `/api/bones` | `boneMapController.js` | AI-assisted bone mapping (OpenAI, optional) |

All routes use `express-rate-limit`; routes that mutate user data (save/delete scene, story, media, account) go through `requireAuth`.

## Models (Mongoose)

- **`User`** — account, password (bcrypt), verification/reset tokens.
- **`Scene`** — avatar (URL/transform/pose), narrative (text/audio/display mode), timeline.
- **`Story`** — metadata + ordered list of scenes (`transitionText`, `durationSeconds`, `markerUrl` per scene).
- **`Avatar`** — metadata for avatars created via Avaturn/upload.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | `node --watch server.js` |
| `npm start` | production |
| `npm test` | placeholder — no test suite yet |

## Notes

- `npm audit` is clean (0 known vulnerabilities) — re-run after any dependency bump.
- No automated test suite; validation today is manual + Mongoose's loose typing.
