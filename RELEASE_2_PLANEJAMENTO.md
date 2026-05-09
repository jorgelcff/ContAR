# ContAR — Planejamento da Release 2.0
**Status:** Rascunho | **Autor:** Jorge Freitas | **Criado em:** Maio 2026
**Versão base:** Release 1.0 (commit `256bd7b` — main)

---

## VISÃO DA RELEASE 2.0

A Release 1.0 entregou o **núcleo funcional** da plataforma: criação de cenas, narração com TTS, lip sync, histórias públicas e AR. A Release 2.0 foca em três objetivos:

1. **Escala** — infraestrutura pronta para múltiplos usuários simultâneos (arquivos em nuvem, cache, performance)
2. **Riqueza criativa** — mais ferramentas para o criador (thumbnails, templates, fundos, múltiplas vozes)
3. **Impacto educacional** — features que conectam o ContAR ao ecossistema de ensino (SCORM, embed, analytics)

---

## RESUMO EXECUTIVO — O QUE MUDA

| Categoria | v1.0 | v2.0 |
|---|---|---|
| Armazenamento de arquivos | Sistema de arquivos local | Cloudflare R2 (CDN global) |
| Thumbnails | Ícone genérico | Screenshot real do canvas |
| Vozes TTS | 1 voz fixa | Seletor com múltiplas vozes |
| Reordenação de cenas | Sem UI visual | Drag-and-drop |
| Analytics | Zero | Views, retenção por cena |
| Export | Apenas link web | SCORM 1.2, código embed |
| Colaboração | Apenas criador solo | Co-autores por convite |
| Mobile | Responsivo | PWA instalável |
| Backgrounds | Cor sólida | Biblioteca de ambientes 3D |

---

## ÉPICOS E FUNCIONALIDADES

---

### ÉPICO 1 — Infraestrutura de Arquivos em Nuvem
**Prioridade:** P0 — Bloqueador para escala
**Esforço estimado:** 1 semana

#### Contexto
Na v1.0, GLBs e áudios são armazenados localmente no servidor (`backend/uploads/`). Isso impede escalabilidade horizontal e cria risco de perda de dados em redeploys sem volume configurado.

#### Funcionalidades

**1.1 Integração Cloudflare R2 (ou Amazon S3)**
- Configurar bucket R2 com domínio customizado (CDN automático na Cloudflare)
- Variáveis de ambiente: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- Adaptar `backend/routes/mediaRoutes.js`: substituir `multer.diskStorage` por `multer.memoryStorage` + upload direto para R2 via SDK `@aws-sdk/client-s3`
- Retornar URL CDN pública (`R2_PUBLIC_URL/models/filename.glb`)
- Manter fallback para armazenamento local se R2 não configurado (compatibilidade com dev)

**Impacto no código:**
```
backend/routes/mediaRoutes.js         — refatorar upload
backend/.env.example                  — novas variáveis
frontend/src/components/ui/LeftPanel  — nenhuma mudança (recebe URL do servidor)
```

**1.2 Migração de arquivos existentes**
- Script `scripts/migrate-uploads-to-r2.js` que varre `backend/uploads/` e sobe para R2
- Atualiza URLs nos documentos MongoDB (`Scene.content.avatar.modelUrl`, `Scene.content.narrative.audioUrl`)
- Execução: `node scripts/migrate-uploads-to-r2.js --dry-run` / `--apply`

**1.3 Limpeza de arquivos órfãos**
- Job periódico (cron semanal) que verifica quais URLs no R2 não têm referência em nenhum documento Scene
- Soft-delete com tag `orphan=true` antes de remover permanentemente

---

### ÉPICO 2 — Thumbnails de Cenas e Histórias
**Prioridade:** P0 — UX crítica
**Esforço estimado:** 4 dias

#### Contexto
Na v1.0, as páginas `/scenes` e `/stories` mostram ícones genéricos. Um thumbnail real do canvas melhora drasticamente o reconhecimento visual das criações.

#### Funcionalidades

**2.1 Geração de thumbnail no editor**
- Após o avatar carregar no SceneCanvas, aguardar 1.5s para a cena estabilizar, depois capturar `renderer.domElement.toDataURL('image/jpeg', 0.8)`
- Converter para Blob e fazer POST para novo endpoint `POST /api/media/thumbnail` (multipart/form-data)
- Limitar: gerar thumbnail apenas uma vez por sceneId (verificar se já existe via header `If-None-Match`)
- Endpoint retorna URL da imagem no R2

**2.2 Salvar thumbnail junto à cena**
- Adicionar campo `thumbnailUrl: String` ao schema de Scene
- `saveScene` opcionalmente aceita `thumbnailUrl` no payload
- Editor chama `saveScene({ ...payload, thumbnailUrl })` após captura

**2.3 Exibir thumbnails**
- `ScenesPage`: substituir o emoji 👤 pela `<img src={scene.thumbnailUrl} />` com fallback para ícone
- `StoriesPage`: thumbnail da primeira cena da história como preview do card
- Lazy loading com `loading="lazy"` nos `<img>`

**2.4 Thumbnail em histórias compartilhadas**
- `StoryViewerPage`: splash screen exibe thumbnail da primeira cena como background desfocado
- Meta tags OpenGraph: `<meta property="og:image" content={firstScene.thumbnailUrl} />` para preview ao compartilhar no WhatsApp/social

---

### ÉPICO 3 — Seletor de Vozes TTS
**Prioridade:** P0 — Valor educacional alto
**Esforço estimado:** 3 dias

#### Contexto
Na v1.0, o TTS usa uma voz fixa do ElevenLabs. Educadores precisam de vozes diferentes (masculino/feminino, idioma, idade) para criar personagens distintos.

#### Funcionalidades

**3.1 Endpoint de listagem de vozes**
- `GET /api/tts/voices` — faz proxy para `GET https://api.elevenlabs.io/v1/voices`
- Filtra campos relevantes: `voice_id`, `name`, `labels` (gender, age, accent)
- Cache com TTL de 1 hora no servidor (evita rate limit na API da ElevenLabs)

**3.2 UI de seleção de voz**
- Dropdown no painel Fala, abaixo do botão TTS
- Mostra nome da voz, gênero e sotaque (baseado nos labels)
- Persiste `selectedVoiceId` no Zustand store (campo novo, incluído no persist)
- Inclui botão de preview (gera áudio curto com a voz selecionada)

**3.3 Integração no payload TTS**
- `POST /api/tts/generate` aceita `voiceId` no body
- `ttsController.js` usa `voiceId` ou fallback para voz padrão configurada em env
- Variável `TTS_DEFAULT_VOICE_ID` no backend `.env`

**3.4 Salvar voz junto à cena**
- Campo `voiceId` em `Scene.content.narrative`
- StoryViewer usa o `voiceId` da cena para regenerar (se necessário)

---

### ÉPICO 4 — Drag-and-Drop para Reordenação de Cenas
**Prioridade:** P1
**Esforço estimado:** 3 dias

#### Contexto
Na v1.0, as cenas em `/stories` têm botões de reordenação mas a UX é limitada. Drag-and-drop é o padrão esperado.

#### Funcionalidades

**4.1 DnD no StoryBuilderPanel**
- Instalar `@dnd-kit/core` e `@dnd-kit/sortable` (suporte mobile nativo, acessível)
- Substituir lista fixa por `<SortableContext>` com itens `<SortableItem>`
- Handle de arraste (ícone ⠿) à esquerda de cada item
- Preview ghosted durante o arraste

**4.2 DnD na StoriesPage (editor de história)**
- Mesma implementação no painel de cenas dentro do editor

**4.3 Persistência da ordem**
- `reorderStoryScenes(from, to)` já existe no Zustand — apenas triggar após drop
- Autosave (3s) persiste a nova ordem no backend

---

### ÉPICO 5 — Analytics de Histórias
**Prioridade:** P1
**Esforço estimado:** 1 semana

#### Contexto
Educadores precisam saber se os alunos realmente assistiram as histórias. Analytics básicos de visualização são essenciais para o uso pedagógico.

#### Funcionalidades

**5.1 Modelo de dados StoryView**
```js
// backend/models/StoryView.js
{
  storyId: String,
  sessionId: String (UUID gerado no browser, salvo no sessionStorage),
  sceneIndex: Number (última cena assistida),
  completedScenes: [Number] (índices das cenas completas),
  completedAll: Boolean,
  durationSeconds: Number (tempo total na página),
  userAgent: String,
  createdAt: Date
}
```

**5.2 Beacon de visualização**
- `StoryViewerPage`: ao avançar cada cena, envia `POST /api/story/:id/view` (fire-and-forget, não bloqueia UX)
- Payload: `{ sessionId, sceneIndex, completedScenes }`
- Usa `navigator.sendBeacon` para garantir envio ao fechar a aba

**5.3 Endpoint de analytics**
- `GET /api/story/:id/analytics` (auth: owner only)
- Retorna: total de views únicas, taxa de conclusão, drop-off por cena (qual cena mais perde espectadores)

**5.4 Dashboard de analytics**
- Nova aba na `StoriesPage`: card de analytics por história
- Gráfico de barras simples (drop-off por cena) usando apenas SVG/HTML (sem biblioteca de charts extra)
- Números: "X visualizações únicas · Y% concluíram"

---

### ÉPICO 6 — Export SCORM e Embed
**Prioridade:** P1
**Esforço estimado:** 1 semana

#### Contexto
Professores usam LMS (Moodle, Google Classroom, Canvas). Exportar para SCORM 1.2 permite integrar as histórias ContAR diretamente nesses sistemas com rastreamento de conclusão.

#### Funcionalidades

**6.1 Geração de pacote SCORM 1.2**
- `GET /api/story/:id/export/scorm` — gera um arquivo ZIP contendo:
  - `imsmanifest.xml` (metadados SCORM)
  - `index.html` (StoryViewer standalone sem depender do servidor ContAR)
  - Assets embutidos (áudio e GLB copiados no ZIP, não referenciados por URL)
  - `scorm.js` (SCORM API wrapper para reportar conclusão ao LMS)
- Download direto no browser

**6.2 Código de embed (iframe)**
- Botão "Incorporar" na StoriesPage gera tag `<iframe>`:
  ```html
  <iframe src="https://contar.app/story/UUID?embed=1"
          width="800" height="600" frameborder="0"
          allow="autoplay; camera; microphone">
  </iframe>
  ```
- Modo `?embed=1` oculta header e navbar, exibe apenas o viewer
- Opções de dimensão: 16:9, 4:3, customizado

**6.3 Export PDF (roteiro)**
- `GET /api/story/:id/export/pdf` — gera PDF com:
  - Título e descrição da história
  - Cada cena com screenshot (thumbnail), texto da fala, duração
  - Útil como roteiro impresso para sala de aula sem internet
- Backend usa `puppeteer` ou `pdfkit` para geração

---

### ÉPICO 7 — PWA (Progressive Web App)
**Prioridade:** P1
**Esforço estimado:** 4 dias

#### Contexto
Educadores e alunos usam muito celular. Uma PWA instalável aparece na tela inicial como um app nativo, funciona offline para viewing (com cache) e tem acesso à câmera de forma nativa.

#### Funcionalidades

**7.1 Service Worker e Manifest**
- `vite-plugin-pwa` para geração automática
- `manifest.json`: nome "ContAR", ícones 192px e 512px, `display: standalone`, `theme_color: #0e172a`
- Service Worker: cache de assets estáticos + prefetch de GLBs das histórias recentes

**7.2 Cache offline para viewer**
- Estratégia Stale-While-Revalidate para histórias já carregadas
- Cache de GLBs e áudios no IndexedDB (Workbox)
- Banner "Você está offline — exibindo versão em cache" quando sem conexão

**7.3 Push notifications (opcional)**
- Quando alguém visualiza sua história: "Sua história 'X' foi assistida por 3 pessoas hoje"
- Backend: Web Push API com VAPID keys

---

### ÉPICO 8 — Biblioteca de Ambientes 3D
**Prioridade:** P1
**Esforço estimado:** 4 dias

#### Contexto
Na v1.0, o fundo da cena é cinza escuro fixo. Variedade de ambientes 3D aumenta o valor pedagógico (sala de aula virtual, laboratório, floresta, etc.).

#### Funcionalidades

**8.1 Seletor de ambiente no editor**
- Nova seção na aba Avatar, abaixo dos controles de transform
- Grid com thumbnails das opções de ambiente
- Ambientes como HDRs (`.hdr`) servidos como assets estáticos

**8.2 Ambientes disponíveis (v2.0)**
- `default` — Estúdio fotográfico escuro (atual)
- `classroom` — Sala de aula virtual iluminada
- `nature` — Externo com céu gradiente
- `studio_white` — Estúdio branco (minimalista)
- `sunset` — Pôr do sol laranja
- `space` — Fundo espacial
- (Expandível via HDR customizado upload)

**8.3 Persistência**
- Campo `environment: String` em `Scene.content` → salvo no banco

---

### ÉPICO 9 — Colaboração (Co-autoria)
**Prioridade:** P2
**Esforço estimado:** 2 semanas

#### Contexto
Professores querem delegar criação de cenas a monitores ou alunos avançados sem dar acesso total à conta.

#### Funcionalidades

**9.1 Convite de colaborador**
- `POST /api/story/:id/collaborators` — envia email de convite com JWT de acesso específico
- Modelo: `StoryCollaborator { storyId, email, role: 'editor'|'viewer', invitedAt, acceptedAt }`

**9.2 Permissões por role**
- `editor`: pode adicionar/remover cenas, editar metadados
- `viewer`: apenas visualiza (mesmo que história privada)
- `owner`: todas as permissões + delete + gerenciar colaboradores

**9.3 Histórias privadas**
- Campo `visibility: 'public'|'private'|'unlisted'` em Story
- `private`: apenas owner e colaboradores podem ver
- `unlisted`: acessível por link mas não indexado
- `public`: padrão atual

---

### ÉPICO 10 — Melhorias de Performance
**Prioridade:** P0 (some items) / P1
**Esforço estimado:** 1 semana

#### Funcionalidades

**10.1 Level of Detail (LOD) para avatares**
- Para avatares > 5MB, gerar versão reduzida (Draco) no momento do upload
- Usar LOD Three.js: versão baixa qualidade quando avatar está distante da câmera

**10.2 Preload inteligente no viewer**
- Na `StoryViewerPage`, pré-carregar os GLBs das próximas 2 cenas (atualmente só 1)
- Pré-carregar áudios também (HTMLAudio `preload="auto"`)

**10.3 Cache Redis no backend (opcional)**
- Cachear respostas de `GET /api/story/public/:id` com TTL de 5 minutos
- Cachear listagem de vozes TTS com TTL de 1 hora
- Dependência: `ioredis`, variável `REDIS_URL`

**10.4 Paginação em listagens**
- `GET /api/scene` e `GET /api/story`: adicionar `?page=1&limit=20`
- Frontend: infinite scroll ou paginação numérica

**10.5 Compressão de resposta**
- `compression` middleware no Express para gzip automático
- Estimativa: redução de 60-70% no tamanho de respostas JSON grandes

---

### ÉPICO 11 — Melhorias de UX e Acessibilidade
**Prioridade:** P1
**Esforço estimado:** 1 semana

#### Funcionalidades

**11.1 Modo escuro / claro**
- Toggle no Header (já escuro; adicionar opção "sistema" e "claro")
- `prefers-color-scheme` como default
- Salvar preferência em `localStorage['contar:theme']`

**11.2 Atalhos de teclado no editor**
- `Ctrl+S` — Salvar cena
- `Space` — Play/Pause áudio
- `Ctrl+Z` — Desfazer última alteração de texto
- Modal de ajuda de atalhos (`?`)

**11.3 Acessibilidade (a11y)**
- `aria-label` em todos os botões sem texto visível (ícones)
- Navegação por teclado no tour guiado
- Contraste mínimo WCAG AA em todos os textos
- `role="status"` no badge de autosave para leitores de tela

**11.4 Onboarding melhorado**
- Checklist interativo de configuração: "Complete estes passos para criar sua primeira história"
  - [ ] Crie ou importe um avatar
  - [ ] Escreva a fala do narrador
  - [ ] Gere a voz com TTS
  - [ ] Salve a cena
  - [ ] Publique a história
- Progresso salvo no localStorage; desaparece quando todos os passos são concluídos

**11.5 Busca de cenas e histórias**
- Campo de busca por título em `/scenes` e `/stories`
- Backend: `GET /api/scene?q=texto` com query `{ ownerId, 'metadata.title': /regex/ }`

---

## ARQUITETURA TÉCNICA — MUDANÇAS PARA V2.0

### Novas dependências backend
```json
{
  "@aws-sdk/client-s3": "^3.x",      // Upload para R2/S3
  "@aws-sdk/s3-request-presigner": "^3.x", // URLs pré-assinadas
  "pdfkit": "^0.x",                   // Geração de PDF
  "archiver": "^7.x",                 // Geração de ZIP (SCORM)
  "ioredis": "^5.x",                  // Cache Redis (opcional)
  "compression": "^1.x"              // Gzip middleware
}
```

### Novas dependências frontend
```json
{
  "@dnd-kit/core": "^6.x",           // Drag-and-drop
  "@dnd-kit/sortable": "^8.x",
  "vite-plugin-pwa": "^0.x",         // PWA
  "workbox-window": "^7.x"           // Service Worker
}
```

### Novos modelos MongoDB
```
StoryView    — analytics de visualização
StoryCollaborator — co-autoria
```

### Novos campos nos modelos existentes
```
Scene.content.narrative.voiceId   — voz TTS selecionada
Scene.content.environment         — ambiente 3D
Scene.thumbnailUrl                 — screenshot do canvas
Story.visibility                   — public|private|unlisted
Story.collaborators                — array de emails/roles
```

### Novas variáveis de ambiente
```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
TTS_DEFAULT_VOICE_ID=
REDIS_URL=                          # opcional
VAPID_PUBLIC_KEY=                   # opcional (push notifications)
VAPID_PRIVATE_KEY=                  # opcional
```

---

## NOVOS ENDPOINTS API V2.0

### Thumbnails
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/media/thumbnail` | JWT | Upload de thumbnail de cena |

### TTS v2
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/tts/voices` | JWT | Lista vozes disponíveis (cache 1h) |

### Analytics
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/story/:id/view` | Pública | Registra visualização (beacon) |
| GET | `/api/story/:id/analytics` | JWT (owner) | Retorna métricas |

### Export
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/story/:id/export/scorm` | JWT | Baixa pacote SCORM 1.2 |
| GET | `/api/story/:id/export/pdf` | JWT | Baixa PDF do roteiro |

### Colaboração
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/story/:id/collaborators` | JWT (owner) | Convida colaborador |
| DELETE | `/api/story/:id/collaborators/:email` | JWT (owner) | Remove colaborador |
| GET | `/api/story/:id/collaborators` | JWT | Lista colaboradores |

---

## ESTIMATIVA DE ESFORÇO

| Épico | Prioridade | Esforço | Complexidade |
|---|---|---|---|
| 1 — R2/S3 Storage | P0 | 5 dias | Alta (integração externa) |
| 2 — Thumbnails | P0 | 4 dias | Média |
| 3 — Seletor de Vozes TTS | P0 | 3 dias | Baixa |
| 4 — Drag-and-Drop | P1 | 3 dias | Média |
| 5 — Analytics | P1 | 5 dias | Média |
| 6 — SCORM / Embed | P1 | 5 dias | Alta |
| 7 — PWA | P1 | 4 dias | Média |
| 8 — Ambientes 3D | P1 | 4 dias | Baixa |
| 9 — Colaboração | P2 | 10 dias | Alta |
| 10 — Performance | P0/P1 | 5 dias | Variada |
| 11 — UX / a11y | P1 | 5 dias | Baixa-Média |
| **TOTAL P0** | | **~17 dias** | |
| **TOTAL P0+P1** | | **~48 dias** | |
| **TOTAL GERAL** | | **~58 dias** | |

---

## SEQUÊNCIA DE IMPLEMENTAÇÃO RECOMENDADA

### Sprint 1 — Fundação (dias 1–10)
1. **R2/S3 Storage** (Épico 1) — tudo depende disso em escala
2. **Compressão + Paginação** (Épico 10, partes) — performance imediata
3. **Thumbnails** (Épico 2) — UX de alto impacto, depende do R2

### Sprint 2 — Riqueza criativa (dias 11–22)
4. **Seletor de vozes TTS** (Épico 3)
5. **Ambientes 3D** (Épico 8)
6. **Drag-and-drop cenas** (Épico 4)
7. **Busca de cenas/histórias** (Épico 11.5)

### Sprint 3 — Integração educacional (dias 23–34)
8. **Analytics de histórias** (Épico 5)
9. **Export SCORM + Embed** (Épico 6)

### Sprint 4 — Plataforma & experiência (dias 35–48)
10. **PWA** (Épico 7)
11. **Acessibilidade + atalhos** (Épico 11)
12. **Onboarding checklist** (Épico 11.4)

### Sprint 5 — Colaboração (dias 49–58)
13. **Co-autoria e visibilidade** (Épico 9)

---

## CRITÉRIOS DE ACEITAÇÃO DA RELEASE 2.0

- [ ] Todos os arquivos enviados (GLB, áudio) armazenados no R2 e servidos via CDN
- [ ] Thumbnails reais gerados e exibidos nas páginas /scenes e /stories
- [ ] Pelo menos 3 vozes selecionáveis no TTS
- [ ] Reordenação de cenas por drag-and-drop funcional em desktop e mobile
- [ ] Analytics: total de views e taxa de conclusão visíveis para o criador
- [ ] Export SCORM 1.2 funcional e testado no Moodle
- [ ] PWA instalável em Android e iOS
- [ ] Pelo menos 4 ambientes 3D disponíveis
- [ ] Score Lighthouse: Performance ≥ 85, Accessibility ≥ 90
- [ ] Zero strings hardcoded (i18n cobertura mantida)
- [ ] Todos os novos endpoints documentados em `.env.example`

---

## RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| R2/S3 com latência alta para uploads GLB grandes | Média | Alto | Compressão DRACO obrigatória; limite de 50MB mantido |
| ElevenLabs deprecar API de vozes | Baixa | Alto | Abstração de provedor TTS; suporte a Coqui TTS (open-source) como fallback |
| SCORM mal interpretado por LMS antigos | Alta | Médio | Testar em Moodle 3.x e 4.x; documentar versão mínima |
| DnD com acessibilidade insuficiente | Média | Médio | @dnd-kit tem suporte nativo a teclado; testar com leitor de tela |
| Analytics de beacon perdendo eventos | Média | Baixo | Fallback para XMLHttpRequest síncrono no `beforeunload` |
| Thumbnails de avatares VRM com poses incomuns | Alta | Baixo | Aguardar 2s após load antes do screenshot; timeout máximo de 5s |

---

## DÍVIDAS TÉCNICAS A RESOLVER NA V2.0

1. **Testes automatizados** — zero cobertura de testes na v1.0; implementar Jest + Vitest para controllers e hooks críticos
2. **Validação de schema com Zod** — validação de entrada no frontend antes de enviar ao backend
3. **Tipos TypeScript** — migrar utilitários críticos (BoneMapper, AnimationController) para `.ts`
4. **Error boundaries React** — SceneCanvas não tem error boundary; crash derruba toda a UI
5. **Logging estruturado** — substituir `console.error` por Winston ou Pino com níveis e contexto
6. **Secrets rotation** — implementar rotação de JWT secret sem logout de todos os usuários
7. **Input sanitization** — `DOMPurify` para strings de usuário exibidas como HTML (speech text)

---

## IMPACTO ACADÊMICO (TCC)

### Novas contribuições científicas da v2.0
- **Analytics de narrativas interativas:** métricas de engajamento (drop-off por cena) em contexto educacional — dado original para análise
- **SCORM + WebXR:** integração inédita de export SCORM com conteúdo AR embutido
- **Lip sync multilíngue:** validação do algoritmo com vozes em PT, EN, ES, FR
- **Thumbnails por screenshot 3D:** captura automática do WebGL canvas como método de pré-visualização

### Hipóteses para experimentos
1. Taxa de conclusão de histórias com < 3 cenas vs. ≥ 3 cenas
2. Retenção de atenção: cenas com voz sintética vs. voz gravada
3. Engajamento: histórias com avatar em pose "speaker" vs. "idle"
4. Adoção: % de educadores que completam a checklist de onboarding

---

*Documento criado em Maio 2026. Revisão prevista ao início de cada sprint.*
*Base de código v1.0: https://github.com/jorgelcff/avaturn-threejs (commit `256bd7b`)*
