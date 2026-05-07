# 🗺️ Avaturn-ThreeJS: Roadmap e Planejamento Ágil v2

Com base no objetivo de criar uma plataforma _no-code_ para geração de cenas 3D com personagens, ações e falas, altamente acessível em dispositivos móveis, segue o planejamento em formato de Cards Ágeis (Kanban/Scrum), incluindo o detalhamento arquitetural e os novos épicos de engajamento e expansão de mundo.

---

## 🚀 Épico 1: Experiência No-Code e Criação de Cenas

### Card 1: Timeline Visual para Animações e Áudio (No-Code)

- **Tipo:** Feature
- **Prioridade:** Alta
- **Descrição:** Como criador de conteúdo, quero uma interface visual de linha do tempo (_timeline_) no `EditorPage.jsx` para arrastar e soltar (drag-and-drop) animações e arquivos de áudio.
- **Plano de Implementação:**
  - **Componente TimelineRuler:** Régua horizontal em SVG/div com marcadores de tempo (0s…Ns).
  - **Blocos Arrastáveis:** Dois trilhos por cena (áudio e ação). Posicionamento absoluto via `left = startSec / totalSec * 100%`.
  - **Snap:** Alinhar bloco de áudio ao bloco de ação (tolerância 0.25s).
  - **Exportação:** Adicionar ao modelo `timeline: array de { type: 'audio'|'action', startSec, endSec, ref }` via JSON.

### Card 2: Geração de Voz a partir de Texto (TTS - Text-to-Speech)

- **Tipo:** Feature
- **Prioridade:** Média
- **Descrição:** Como usuário, quero digitar o texto em um `SpeechBubble.jsx` e o sistema deve gerar o áudio automaticamente.
- **Plano de Implementação:**
  - **Backend:** Rota `POST /api/tts/generate` (integração ElevenLabs/Google TTS). Retorno de stream `.mp3` e dados de timestamps (visemes).
  - **Frontend:** Criação do hook `useTTS.js` para consumir a rota, passando o blob para `useAudio.js`. UI com botão "Gerar Voz" e states de loading.

### Card 3: Integração Completa de Lip Sync Automático

- **Tipo:** Feature
- **Prioridade:** Alta
- **Descrição:** Como visualizador, quero ver a boca do avatar se mexendo sincronizada com o áudio (fonemas/frequência).
- **Plano de Implementação:**
  - **Integração:** Substituir lógica inline do `SceneCanvas.jsx` por instância oficial do `LipSyncController`.
  - **Modos:** Crossfade de visemes acionado via timeline TTS, mantendo fallback heurístico (RMS/bandas) para áudios puros.

---

## 📱 Épico 2: Acessibilidade Mobile e AR (Realidade Aumentada)

### Card 4: Interface do Visualizador Otimizada para Celulares (Mobile-First)

- **Tipo:** Feature
- **Prioridade:** Alta
- **Descrição:** Experiência fluida adaptada ao toque, botões grandes e carregamento rápido no `StoryViewerPage.jsx`.
- **Plano de Implementação:**
  - Ocultar `<Header />` dinamicamente (fullscreen).
  - Gestos: `touch-action: none` no canvas para OrbitControls fluidos.
  - UI: Botões `min-h-[48px]`, preload via `<audio preload="metadata">`, e Skeleton loading animado CSS.

### Card 5: Posicionamento AR (Realidade Aumentada) Intuitivo

- **Tipo:** Feature
- **Prioridade:** Média
- **Descrição:** Projetar avatar animado na sala via WebXR com `ARPage.jsx`.
- **Plano de Implementação:**
  - Ocultar backgrounds (HDRI e chãos) no `renderer.xr.isPresenting`.
  - Substituir overlay de `SpeechBubble` DOM por `CSS3DRenderer` ou `THREE.Sprite`. Fade-out de 300ms na transição.

---

## 🛠️ Épico 3: Refatoração (Débitos Técnicos e "Possíveis Erros")

### Card 6: Refatorar o Gerenciamento de Estado da Cena (Zustand)

- **Tipo:** Tech Debt
- **Prioridade:** Alta
- **Problema:** "Prop Drilling" massivo de estados entre `LeftPanel`, `SceneCanvas` e controladores soltos.
- **Plano de Implementação:**
  - Adotar `zustand` (`useSceneStore.js`).
  - Slices para: `avatarSlice`, `speechSlice`, `storySlice`. Reduzir acoplamento local e dependências do React em classes puras.

### Card 7: Otimização de Performance e Carregamento (Lazy Loading)

- **Tipo:** Tech Debt
- **Prioridade:** Alta
- **Desafio:** Travamento de Thread em celulares ao baixar GLBs grandes e HDRI.
- **Plano de Implementação:**
  - React `Suspense` + `.lazy()` no `SceneCanvas`.
  - Compressão DRACO confirmada. Carregamento progressivo de HDRI (placeholders) e pré-cache de próximas cenas (`THREE.Cache`).

### Card 8: Backend Global para Storage Externo

- **Tipo:** Tech Debt
- **Prioridade:** Média
- **Desafio:** Blobs e base64 sobrecarregam aparelhos; escalar recursos estáticos.
- **Plano de Implementação:**
  - Criar rota `POST /api/media/upload` (AWS S3/Firebase). Persistir arquivos e retornar URLs estáticas permanentes para uso no JSON.

### Card 9: Desacoplar Lógica Three.js do React

- **Tipo:** Tech Debt
- **Prioridade:** Média
- **Desafio:** Controladores imperativos vazando em ciclos de vida React `useEffect`.
- **Plano de Implementação:**
  - Criação de hooks orquestradores: `useLipSync.js`, `useAvatarAnimation.js`, `useThreeScene.js`. Autolimpeza garantida por hook unmount.

---

## 🌍 Épico 4: Expansão de Mundo e Cinematografia

### Card 10: Importação de Props e Objetos 3D (No-Code)

- **Tipo:** Feature | **Prioridade:** Média
- **Descrição:** Usuário pode adicionar mobílias ou itens (ex: celular na mão do avatar).
- **Critérios:** Biblioteca de Props, Transform Gizmos no `SceneCanvas`, serialização JSON de Props.

### Card 11: Suporte a Múltiplos Avatares na Câmera

- **Tipo:** Feature | **Prioridade:** Alta
- **Descrição:** Permite diálogos estilo "corte de cena" entre dois avatares.
- **Critérios:** `useSceneStore` suportando um array de avatares. Timeline com slots multi-ator. Instâncias separadas para animações e Lipsync.

### Card 12: Controles de Câmera e Iluminação Customizável

- **Tipo:** Feature | **Prioridade:** Média
- **Descrição:** Adicionar controles como iluminação dia/noite e close-ups no rosto ou corpo inteiro.
- **Critérios:** Acionadores de câmera via Timeline, seletor de HDRI light presets via interface de cena.

---

## 🚀 Épico 5: Distribuição e Retenção (Growth)

### Card 13: Exportação da Cena em MP4/WebM

- **Tipo:** Feature | **Prioridade:** Alta
- **Descrição:** Baixar vídeo da cena gerada diretamente no browser (para postar via TikTok/Instagram).
- **Critérios:** Implementado usando a `MediaRecorder API` renderizando frames e áudio do `<canvas>` do Three.js.

### Card 14: Snippet Oiframe Inline Embed

- **Tipo:** Feature | **Prioridade:** Média
- **Descrição:** Gerar um iFrame (`<iframe src="...">`) em uma rota minimalista `/embed/:id` para embed em blogs WordPress/Notion etc.

### Card 15: Closed Captions Sincronizadas

- **Tipo:** Feature | **Prioridade:** Alta
- **Descrição:** Exibição do texto gerado no TTS de forma temporizada e lida perfeitamente pela Web Content Accessibility.

---

## 🎮 Épico 6: Interatividade e Gamificação

### Card 16: Narrativas Ramificadas (Escolhas Visuais)

- **Tipo:** Feature | **Prioridade:** Baixa (Longo prazo)
- **Descrição:** Implementação estilo "Bandersnatch" – ao fim do texto de um ator, escolhas clicáveis para alterar fluxo narrativo.

---

## 🎯 Sequência Recomendada de Implementação (Roadmap)

1. **Sprint 1 (Impacto Imediato/Fundação):**
   - Card 3 → Card 4 → Card 7
     _(Core de lipsync funcional, Mobile otimizado e loading leve)_
2. **Sprint 2 (Architecture & No-code Core):**
   - Card 6 → Card 1 → Card 2
     _(Refazer state via Zustand; depois introduzir a Timeline; plugar TTS)_
3. **Sprint 3 (AR, Múltiplos Atores e Escalabilidade):**
   - Card 11 → Card 5 → Card 8 → Card 9
     _(Mais de um Avatar; AR de alta qualidade; Infraestrutura Media cloud e code cleanup)_
4. **Sprints 4+ (Distribuição e Growth):**
   - Epic 4 e Epic 5 (Props, MP4, Embeds, Legendas)
