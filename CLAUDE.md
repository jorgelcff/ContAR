# ContAR — contexto para trabalhar neste repositório

ContAR é uma plataforma no-code de WebAR para criar narradores virtuais 3D com
fala, lip sync e realidade aumentada. É o TCC do Jorge Freitas no CIn/UFPE e vai
ser apresentado no SVR 2026 (main track), com um **QR code num pôster sem
ninguém do lado** — muita decisão de produto vem daí: quem escaneia está no
celular, talvez em outro idioma, no wifi do evento, e não tem a quem perguntar.

Converse com o usuário em **português**. Ele valoriza evidência: meça antes de
afirmar que algo funciona, e diga com clareza quando uma hipótese foi descartada.

## Estrutura

- `frontend/` — React 19, Vite, Tailwind v4, Zustand, react-i18next, three.js
  r183, @pixiv/three-vrm. Build servido por nginx (`frontend/nginx.conf`).
- `backend/` — Node, Express 5, Mongoose. Uploads vão para o **Cloudinary**
  (o disco do Render é efêmero).
- `e2e/` — Playwright. `playwright.config.js` na raiz.
- `.github/workflows/keep-awake.yml` — mantém o Render acordado só entre datas
  (ver Deploy).

## Rodar

```bash
docker compose up -d          # frontend :5173, backend :3001, mongo :27017
npm run dev                   # backend + frontend sem Docker (raiz)
npm test --prefix frontend    # vitest (unitários)
npm run lint --prefix frontend
npm run build --prefix frontend
npx playwright test           # e2e: sobe backend com Mongo em memória e
                              # frontend nas portas 3101/5273 — nunca toca produção
```

- `frontend/.env` (fora do git) aponta `VITE_API_BASE_URL` para **produção**.
  `frontend/.env.development` sobrescreve isso para o backend local em
  `npm run dev`. Para apontar o dev para produção de propósito, use
  `frontend/.env.development.local`.
- Os `.env` (backend e frontend) têm chaves reais (Azure, OpenAI, Cloudinary,
  SMTP). Nunca commitar; passar entre máquinas por fora do git.
- Contas e dados do usuário em produção são **reais** — não apagar.

## Deploy (Render, plano gratuito)

- Frontend: https://avaturn-threejs-1.onrender.com · API: https://avaturn-threejs.onrender.com
- Os dois dormem após 15 min sem tráfego; medido a frio: frontend 12,6 s, API 21,9 s.
- `keep-awake.yml` pinga os dois a cada 10 min **só** se as variáveis do
  repositório `KEEP_AWAKE_FROM` / `KEEP_AWAKE_UNTIL` (datas, fuso de São Paulo)
  estiverem definidas. Motivo: 750 horas/mês para o workspace inteiro; dois
  serviços acordados o mês todo dariam ~1.440.

## Armadilhas já pagas (Windows / Git Bash)

- Git Bash converte `/` em caminho do Windows: use `MSYS_NO_PATHCONV=1` ao
  passar `VITE_BASE_PATH=/` e afins.
- Heredoc com acento ou crase quebra: escreva scripts em arquivo e rode.
  Cuidado com `\b` virando byte de controle em regex gerada por script.
- Vários arquivos usam **CRLF**: substituições por string precisam normalizar
  `\r\n` antes e restaurar depois.
- HTTPS a partir do Node nesta máquina precisa de `--use-system-ca`.
- `docker compose` pode parar sozinho quando o Docker Desktop fecha; confira
  `docker compose ps` antes de concluir que algo quebrou.

## Convenções

- **i18n**: `frontend/src/i18n.js`, quatro blocos (`en`, `pt`, `es`, `fr`).
  Toda chave nova vai nos quatro, com acentos corretos, em NFC. Um script que
  escreveu português sem acentos já chegou à página de privacidade.
- Lógica testável vai em `frontend/src/utils/*.js` com `*.test.js` ao lado.
- Comentários explicam **por quê** (o bug, a medição, o caso real), não o quê.
- Commits com corpo explicando causa e evidência.

## Mapa do que não é óbvio

- **Poses/animações**: `utils/posePresets.js` (presets, escolha de clipe),
  `controllers/AnimationController.js` (retarget, gestos procedurais do
  apresentador). Clipes do `public/animations/manifest.json` são baixados **sob
  demanda** por `utils/animationLibrary.js` — só a pose em uso, mais `idle`.
  Nome exato de preset vence palavra-chave (`"disagree"` contém `"agree"`).
- **Retarget** alinha a orientação dos corpos (`bodyFrame` em `utils/retarget.js`):
  o `run.glb` tem o personagem virado para −Z.
- **Lip sync**: os avatares do `jlcf.avaturn.dev` são T1, sem blendshapes de
  boca; a boca mexe por uma mandíbula sintética (`utils/syntheticJaw.js`), que
  lê vértices **através da skin** — obrigatório para modelos quantizados.
  `default_model.glb` é comprimido (meshopt + WebP, 0,66 MB).
- **Narração multilíngue**: `utils/narration.js`. Um idioma vale se tem texto
  **ou** áudio próprio; nunca empresta áudio nem texto de outro.
- **Visualizador** (`pages/StoryViewerPage.jsx`): cena e áudio esperam o avatar
  da cena estar pronto (prontidão por URL); visitante sem o idioma da história
  escolhe "Ouvir em…" antes de começar.
- **AR**: `pages/ARPage.jsx` (superfície/WebXR), `pages/ar/PseudoARScene.jsx`
  (AR Rápida). AR de marcador desligado em `utils/features.js`.
- **Vozes**: `utils/ttsVoices.js`, gerado do catálogo real da Azure (região eastus).
- **Autosave**: tenta de novo sozinho em erro passageiro; rascunho local em
  `utils/sceneDraft.js`.

## Estado em 2026-09-28

Tudo até o commit `3d5efb7` está em `main` e no GitHub. Pendências:

- **Email de verificação quebrado em produção**: o Render bloqueia SMTP de saída.
  Decisão do usuário: `SMTP_PORT=465` ou `RESEND_API_KEY` (o código suporta os dois).
- **Lip sync real** depende de trocar o Avaturn para avatares T2 (conta do usuário).
- **Teste `e2e/full-journey.spec.js` instável em paralelo** — trabalho pausado, e
  as mudanças **não foram commitadas** (ficaram no laptop original):
  - Causa medida: sem GPU o Chromium headless renderiza o 3D na CPU
    (SwiftShader). Um navegador: 14 fps e ~80 ms de bloqueio por clique; quatro
    em paralelo: ~6 fps. A API sempre respondeu em 2–674 ms — não é o backend.
  - Descartado por medição: teto fixo de 30 fps e orçamento pelo tempo da
    thread principal.
  - Em andamento: em renderer de software, sem antialias, sem sombra, pixel
    ratio 1 e no máximo 20 fps. Um navegador sem GPU: atraso 80 ms → 0 ms;
    teste em paralelo 0/12 → 9/12. As medições foram feitas com um jogo aberto
    na máquina — refazer com ela livre.
- Depois do evento: refatorar `components/3d/SceneCanvas.jsx` (~2.200 linhas).
- Trabalho de identidade visual (`brand.md`, `index.css`, `Header`,
  `BrandMark`, `ThemeToggle`) também está só no laptop original, sem commit.
