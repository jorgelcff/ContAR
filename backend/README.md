# ContAR — Backend

API REST em Node.js + Express 5 com MongoDB (Mongoose). Setup, variáveis de ambiente completas e visão geral da arquitetura estão no [README da raiz](../README.md).

## Rodando isoladamente

```bash
npm install
cp .env.example .env   # preencha AUTH_JWT_SECRET, MONGODB_URI etc.
npm run dev            # node --watch server.js, http://localhost:3001
npm start               # produção
```

Sem `AUTH_JWT_SECRET` definido, o servidor recusa subir quando `NODE_ENV=production` (ver `config/auth.js`). Sem as variáveis `CLOUDINARY_*`, uploads de avatar/áudio caem no disco local — funciona em dev, mas é destrutivo em produção (Render tem disco efêmero).

## Estrutura

```text
├── server.js          bootstrap: env, CORS, rotas, conexão MongoDB
├── config/
│   ├── auth.js          resolução do JWT secret (fail-fast em produção)
│   └── cloudinary.js     upload/delete de mídia (com fallback pra disco local)
├── routes/               um arquivo por recurso, define rate limits e middleware de auth
├── controllers/          lógica de cada recurso
├── models/               schemas Mongoose
└── middleware/
    └── authMiddleware.js  requireAuth — valida JWT do header Authorization
```

## Recursos e rotas

| Base | Controller | Observações |
|---|---|---|
| `/api/auth` | `authController.js` | registro, login, reset de senha (Resend), verificação de email |
| `/api/scene` | `sceneController.js` | CRUD de cenas (`GET /:id` é público, resto requer auth) |
| `/api/story` | `storyController.js` | CRUD de histórias (`GET /public/:id` é público) |
| `/api/media` | — (rotas em `mediaRoutes.js`) | upload de áudio/modelo 3D → Cloudinary |
| `/api/tts` | `ttsController.js` | síntese de voz (Azure Speech ou ElevenLabs) |
| `/api/avatar` | `avatarController.js` | integração com Avaturn SDK/API |
| `/api/bones` | `boneMapController.js` | mapeamento de ossos assistido por IA (OpenAI, opcional) |

Todas as rotas usam `express-rate-limit`; rotas que alteram dados do usuário (save/delete cena, história, mídia, conta) passam por `requireAuth`.

## Modelos (Mongoose)

- **`User`** — conta, senha (bcrypt), tokens de verificação/reset.
- **`Scene`** — avatar (URL/transform/pose), narrativa (texto/áudio/modo de exibição), timeline.
- **`Story`** — metadados + lista ordenada de cenas (`transitionText`, `durationSeconds`, `markerUrl` por cena).
- **`Avatar`** — metadados de avatares criados via Avaturn/upload.

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | `node --watch server.js` |
| `npm start` | produção |
| `npm test` | placeholder — não há suíte de testes ainda |

## Notas

- `npm audit` está limpo (0 vulnerabilidades conhecidas) — rode de novo após qualquer bump de dependência.
- Sem suíte de testes automatizada; validação hoje é manual + tipagem fraca do Mongoose.
