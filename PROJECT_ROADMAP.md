# 🗺️ Avaturn-ThreeJS: Roadmap e Planejamento Ágil

Com base no objetivo de criar uma plataforma _no-code_ para geração de cenas 3D com personagens, ações e falas, altamente acessível em dispositivos móveis, segue o planejamento em formato de Cards Ágeis (Kanban/Scrum).

## 🚀 Épico 1: Experiência No-Code e Criação de Cenas

### Card 1: Timeline Visual para Animações e Áudio (No-Code)

- **Tipo:** Feature
- **Prioridade:** Alta
- **Descrição:** Como um criador de conteúdo sem conhecimento em programação, quero uma interface visual de linha do tempo (_timeline_) no `EditorPage.jsx` para arrastar e soltar (drag-and-drop) animações e arquivos de áudio, organizando quando o personagem fala ou se move.
- **Critérios de Aceite:**
  - Implementar um componente de Timeline no `StoryBuilderPanel.jsx`.
  - Permitir alinhar um bloco de áudio com um bloco de ação (ex: "Acenar").
  - Exportar a estrutura da timeline no formato JSON salvo via `sceneApi.js`.

### Card 2: Geração de Voz a partir de Texto (TTS - Text-to-Speech)

- **Tipo:** Feature
- **Prioridade:** Média
- **Descrição:** Como usuário, quero digitar o texto que o personagem vai falar em um `SpeechBubble.jsx` ou campo de input, e o sistema deve gerar o áudio automaticamente, sem que eu precise gravar a minha voz.
- **Critérios de Aceite:**
  - Integrar uma API de TTS (ex: ElevenLabs, Google TTS) no backend (`storyRoutes.js` / `storyController.js`).
  - O frontend deve solicitar a geração do áudio e recebê-lo em tempo real.

### Card 3: Integração Completa de Lip Sync Automático

- **Tipo:** Feature
- **Prioridade:** Alta
- **Descrição:** Como visualizador da cena, quero ver a boca do avatar se mexendo sincronizada com o áudio reproduzido, trazendo realismo à cena.
- **Critérios de Aceite:**
  - Finalizar o `LipSyncController.js` (atualmente na branch `copilot/add-audio-module-for-lip-sync`).
  - Mapear frequências de áudio ou dados de fonemas para os _Morph Targets_ (visemes) do modelo do Avaturn.

## 📱 Épico 2: Acessibilidade Mobile e AR (Realidade Aumentada)

### Card 4: Interface do Visualizador Otimizada para Celulares (Mobile-First)

- **Tipo:** Feature
- **Prioridade:** Alta
- **Descrição:** Como um usuário de celular, quero abrir o link de uma história no `ViewerPage.jsx` ou `StoryViewerPage.jsx` e ter uma experiência fluida adaptada ao toque, botões grandes e carregamento rápido.
- **Critérios de Aceite:**
  - O layout do Viewer deve ocupar 100% da tela mobile (viewport).
  - Controles de áudio e play/pause nativos e touch-friendly.

### Card 5: Posicionamento AR (Realidade Aumentada) Intuitivo

- **Tipo:** Feature
- **Prioridade:** Média
- **Descrição:** Como usuário final, quero usar o WebXR (através do `ARPage.jsx`) para projetar o avatar animado na minha sala.
- **Critérios de Aceite:**
  - Transição suave do modo 3D Web para o modo AR.
  - Ocultar cenários de fundo (HDRI) quando em modo AR, exibindo apenas o avatar e balões de fala.

## 🛠️ Épico 3: Refatoração (Débitos Técnicos e "Possíveis Erros")

### Card 6: Refatorar o Gerenciamento de Estado da Cena (Redux/Zustand)

- **Tipo:** Tech Debt (Refatoração)
- **Prioridade:** Alta
- **Descrição:** Atualmente, a comunicação entre o `SceneCanvas.jsx`, os vários painéis (`LeftPanel.jsx`, `StoryBuilderPanel.jsx`) e os controladores (`AnimationController.js`, `AudioController.js`) pode estar gerando estado fragmentado ou "Prop Drilling".
- **Solução Proposta:**
  - Implementar Zustand ou Redux para criar uma única "Store" (Fonte da Verdade) para o estado da cena (personagem atual, animação ativa, clip de áudio, posição).

### Card 7: Otimização de Performance e Carregamento (Lazy Loading de Modelos 3D)

- **Tipo:** Tech Debt
- **Prioridade:** Alta
- **Descrição:** Carregar avatares Avaturn completos e o ambiente HDRI (`brown_photostudio_01.hdr`) trava o Thread principal do navegador, especialmente em celulares.
- **Solução Proposta:**
  - Adicionar _Suspense_ (React) e Componentes de Loading ao redor do `SceneCanvas.jsx`.
  - Usar DRACO compression para reduzir o tamanho dos modelos 3D no servidor.
  - Pré-carregar os áudios e modelos antes de iniciar o "Play" da cena.

### Card 8: Reestruturação do Backend para Storage Externo (CDN/Cloud)

- **Tipo:** Tech Debt
- **Prioridade:** Média
- **Descrição:** O backend (`server.js`) possivelmente está salvando ou distribuindo arquivos diretamente. Isso não escala e deixa a carga lenta nos celulares.
- **Solução Proposta:**
  - Refatorar `avatarController.js` e `sceneController.js` para usar URLs de um provedor de nuvem (ex: AWS S3 ou Firebase Storage) no modelo do BD, ao invés de base64 ou arquivos locais.

### Card 9: Desacoplar Lógica do Three.js do Ciclo de Vida do React

- **Tipo:** Tech Debt
- **Prioridade:** Média
- **Descrição:** Ter controladores imperativos soltos misturados com o ecossistema Declarativo do React (React Three Fiber) gera memory leaks ou eventos duplicados.
- **Solução Proposta:**
  - Converter os controladores atuais em Custom Hooks (ex: `useLipSync`, `useAvatarAnimation`) que respeitem o hook `useFrame` do React Three Fiber, garantindo que sejam destruídos corretamente.
