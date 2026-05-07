# Plano de Evolução UX — Avaturn ThreeJS
### Foco: Usuário Não-Técnico · Aparência · Usabilidade

---

## Visão Geral

A plataforma já tem o núcleo técnico funcional (avatar 3D, lip sync, timeline, TTS, histórias).
O próximo salto é **torná-la intuitiva para quem nunca viu código ou 3D na vida**.
O objetivo: o usuário entrar pela primeira vez e criar e compartilhar uma cena em menos de 5 minutos, sem precisar ler nenhuma documentação.

---

## Sprint A — Onboarding e Primeira Impressão

### A1 · Tela de Boas-Vindas (Welcome Screen)
**O que é:** Ao entrar pela primeira vez (ou sem login), o usuário vê uma tela simples com 2 opções grandes:
- **"Criar nova cena"** → vai direto para o editor com um avatar padrão já carregado
- **"Ver exemplos"** → galeria com 3–4 cenas prontas para explorar

**Por que importa:** Hoje o editor abre vazio. Para um usuário não-técnico, uma tela em branco é paralisante.

**Como implementar:**
- Componente `WelcomePage.jsx` com rota `/welcome`
- Redirecionar usuário novo (sem `lastAvatarUrl` no localStorage) para `/welcome`
- Pré-carregar 1 avatar padrão gratuito (Avaturn demo) no botão "Criar nova cena"

---

### A2 · Wizard "Sua Primeira Cena" (3 Passos)
**O que é:** Um guia visual que aparece na primeira vez que o usuário abre o editor. Três passos simples com um overlay escuro e dicas em balões:

```
Passo 1 de 3: Escolha um avatar   →  [seta apontando para o painel Avatar]
Passo 2 de 3: Escreva o que ele vai falar  →  [seta para o textarea de Speech]
Passo 3 de 3: Clique em "Gerar Voz" e depois em Play  →  [seta para o botão TTS]
```

**Por que importa:** Guia o usuário ao fluxo principal sem ele precisar explorar sozinho.

**Como implementar:**
- Componente `OnboardingOverlay.jsx` com state de passo (1, 2, 3, concluído)
- Salvar `onboarding:done` no localStorage para não repetir
- Botão "Pular" sempre visível

---

### A3 · Templates de Cena Prontos
**O que é:** 3–4 cenas pré-configuradas que o usuário pode escolher como ponto de partida:
- "Apresentador de Notícias" (avatar formal, fundo de escritório)
- "Personagem Animado" (avatar descontraído, fundo colorido)
- "Tutor Educacional" (avatar neutro, fundo branco limpo)

**Por que importa:** Remove a paralisia da tela em branco.

**Como implementar:**
- JSON de templates em `frontend/src/data/sceneTemplates.js`
- Galeria de cards com preview estático (screenshot ou thumbnail fixo)
- Ao clicar, popula o Zustand store com os valores do template

---

## Sprint B — Redesign do Painel Esquerdo

O painel esquerdo atual é um scroll longo com muitas seções. Para um usuário não-técnico, isso é intimidador.

### B1 · Navegação por Abas (Tabs)
**O que é:** Substituir o scroll vertical por 4 abas com ícones grandes:

| Ícone | Aba | Conteúdo |
|-------|-----|----------|
| 👤 | **Avatar** | Escolher, carregar, ajustar posição |
| 💬 | **Fala** | Texto, TTS, áudio |
| 🎬 | **Cena** | Título, salvar, poses |
| 📖 | **História** | Montar sequência de cenas |

**Por que importa:** O usuário vê apenas o que precisa naquele momento.

**Como implementar:**
- State `activeTab` no `LeftPanel.jsx`
- 4 seções renderizadas condicionalmente
- Ícones com `lucide-react` ou SVG inline (sem nova dependência pesada)

---

### B2 · Controles Simplificados vs. Avançados
**O que é:** Na aba Avatar, mostrar apenas o essencial por padrão:
- Botão "Escolher Avatar" (abre Avaturn)
- Seletor de pose (dropdown simples)

Atrás de um botão "Configurações avançadas ▾" ficam:
- Posição X/Y/Z
- Rotação
- Escala

**Por que importa:** O usuário intermediário fica à vontade; o iniciante não se assusta.

---

### B3 · Indicador de Progresso da Cena
**O que é:** Uma mini checklist visual no topo do painel:

```
✅ Avatar escolhido
✅ Fala configurada
⬜ Áudio gerado
⬜ Cena salva
```

**Por que importa:** O usuário sabe exatamente o que falta para a cena ficar completa.

**Como implementar:**
- Componente `SceneProgressBar.jsx` calculado a partir do Zustand store
- Verde quando completo, cinza quando pendente

---

## Sprint C — Feedback Visual e Notificações

### C1 · Toast Notifications
**O que é:** Mensagens discretas que aparecem por 3 segundos no canto da tela:
- "Voz gerada com sucesso!" (verde)
- "Cena salva!" (verde)
- "Erro ao conectar com o servidor" (vermelho)
- "Avatar carregado!" (azul)

**Por que importa:** Hoje os feedbacks aparecem como texto no painel, que o usuário pode não ver. Toast é inescapável e amigável.

**Como implementar:**
- Componente `Toast.jsx` + hook `useToast.js` com fila de mensagens
- Portal React para renderizar sobre tudo
- Zustand slice `toastSlice` ou context simples

---

### C2 · Loading States Amigáveis
**O que é:** Substituir spinners genéricos por mensagens contextuais:
- Ao carregar avatar: *"Carregando seu personagem..."*
- Ao gerar TTS: *"Dando voz ao seu personagem..."*
- Ao salvar: *"Salvando sua cena..."*

**Por que importa:** O usuário entende o que está acontecendo e não acha que travou.

---

### C3 · Autosave Visual
**O que é:** Um indicador discreto no header tipo *"Salvo automaticamente às 14:32"* que aparece após qualquer mudança no store.

**Como implementar:**
- `useEffect` no `EditorPage` que observa mudanças no Zustand e chama `saveScene` com debounce de 3s
- Texto de status no Header

---

## Sprint D — Experiência Mobile

### D1 · Bottom Navigation Bar (Mobile)
**O que é:** Em telas pequenas, o painel esquerdo desaparece e aparece uma barra de navegação na parte de baixo com os mesmos 4 ícones das abas:

```
[👤 Avatar] [💬 Fala] [🎬 Cena] [📖 História]
```

Cada ícone abre um drawer (painel deslizante de baixo para cima) com os controles.

**Por que importa:** Em celular, um painel lateral de 320px come metade da tela.

---

### D2 · Preview em Tela Cheia no Mobile
**O que é:** Botão "Ver em tela cheia" que esconde tudo e mostra só o canvas 3D + botão Play.

---

## Sprint E — Sistema de Ajuda In-App

### E1 · Tooltips Contextuais
**O que é:** Um `?` ao lado de cada controle não óbvio. Ao hover/toque, explica em linguagem simples:

- Ao lado de "Lip Sync": *"Faz a boca do avatar se mover junto com a fala"*
- Ao lado de "Estabilidade da voz": *"Quanto mais alto, mais consistente e menos expressivo"*
- Ao lado de "Timeline": *"Linha do tempo para controlar quando cada coisa acontece"*

---

### E2 · Painel de Ajuda (Modal)
**O que é:** Botão "?" no header que abre um modal com duas abas:
- **FAQ** — perguntas frequentes
- **Como Fazer** — guias passo a passo

*(Conteúdo detalhado nas seções abaixo)*

---

## FAQ — Perguntas Frequentes

### Sobre Avatares

**Como adiciono meu próprio avatar?**
Clique no botão "Abrir Avaturn" no painel Avatar. O Avaturn é uma ferramenta gratuita onde você cria um personagem 3D do zero — pode até usar sua selfie! Quando terminar, clique em "Exportar" dentro do Avaturn e o avatar aparece automaticamente no editor.

**Posso usar um avatar que já criei antes?**
Sim. Clique em "Carregar meus avatares" e veja todos os personagens que você já criou com sua conta Avaturn.

**Posso usar um arquivo GLB do meu computador?**
Sim. Clique em "Carregar GLB/VRM local" e selecione o arquivo. Funciona com arquivos `.glb` e `.vrm`.

**Por que meu avatar aparece muito pequeno ou fora do lugar?**
Use os controles de Posição e Escala na aba Avatar (clique em "Configurações avançadas"). Arraste o controle de Escala para a direita para aumentar o tamanho.

---

### Sobre Fala e Voz

**Como faço o avatar falar?**
1. Vá para a aba "Fala"
2. Digite o texto no campo de texto
3. Clique em "Gerar Voz (TTS)"
4. Aguarde alguns segundos
5. Clique em Play para ouvir e ver o avatar se mover

**A voz sai em inglês. Como faço em português?**
O sistema de voz (ElevenLabs) suporta português automaticamente — basta digitar o texto em português. Para melhores resultados, use frases completas com pontuação.

**O que é Lip Sync?**
É quando a boca do avatar se move sincronizada com a fala. O sistema detecta os sons do áudio e anima os lábios do personagem automaticamente.

**Posso usar meu próprio arquivo de áudio?**
Sim. Na seção de Áudio, clique em "Carregar arquivo" e selecione um MP3, WAV ou OGG do seu computador. O lip sync funciona com qualquer áudio.

**Posso gravar minha própria voz?**
Sim. Clique no botão de microfone para gravar diretamente pelo navegador. Permita o acesso ao microfone quando o browser pedir.

---

### Sobre Cenas e Histórias

**Qual é a diferença entre Cena e História?**
- Uma **Cena** é um momento único: um avatar, uma fala, um ambiente.
- Uma **História** é uma sequência de cenas, como capítulos de um livro ou slides de uma apresentação.

**Como salvo minha cena?**
Clique no botão "Salvar Cena" na aba Cena. A cena fica guardada no servidor e você pode voltar depois.

**Como compartilho minha história?**
Depois de salvar a história, aparece um link para compartilhar. Qualquer pessoa com o link pode assistir, sem precisar de conta.

**Posso editar uma cena depois de salvar?**
Sim. Abra a cena pelo link ou ID da cena. Faça as alterações e clique em "Salvar" novamente.

---

### Problemas Comuns

**O avatar não carregou, o que faço?**
- Verifique se a URL do avatar está correta
- Recarregue a página
- Tente usar um arquivo GLB local em vez da URL

**A voz não gerou, apareceu um erro.**
- A geração de voz requer conexão com a internet
- Se o erro disser "TTS not configured", é um problema de servidor — contate o suporte
- Tente com um texto mais curto (até 500 caracteres)

**O lip sync não está funcionando.**
- Certifique-se de que o áudio está tocando (botão Play)
- Verifique se o arquivo de áudio não está silencioso
- Recarregue a página e tente novamente

**A página ficou lenta ou travou.**
- Feche outras abas do navegador
- Em celular, use Chrome ou Safari atualizados
- Avatares com muitos detalhes carregam mais lentamente — tente uma versão mais simples

---

## Guias "Como Fazer"

### Como criar sua primeira cena (do zero)

**Tempo estimado: 5 minutos**

1. **Escolha um avatar**
   - Na aba Avatar, clique em "Abrir Avaturn"
   - Crie seu personagem ou use um pronto
   - Clique em Exportar — o avatar aparece automaticamente

2. **Escreva o que o avatar vai dizer**
   - Clique na aba "Fala"
   - Digite o texto no campo (ex: *"Olá! Bem-vindo à minha apresentação."*)
   - Clique em "Adicionar Fala" para mostrar o balão de fala

3. **Gere a voz**
   - Clique em "Gerar Voz (TTS)"
   - Aguarde a barra de loading completar
   - Clique em Play para testar

4. **Salve a cena**
   - Clique na aba "Cena"
   - Dê um nome para a cena
   - Clique em "Salvar Cena"

5. **Compartilhe**
   - Clique em "Adicionar à História" e depois "Salvar História"
   - Copie o link que aparece e compartilhe com quem quiser

---

### Como criar uma história com múltiplas cenas

**Tempo estimado: 15 minutos**

1. Crie e salve a **primeira cena** (seguindo o guia acima)
2. Clique em "Adicionar cena atual à história" — a cena 1 está registrada
3. Agora **mude o avatar, o texto ou a pose** para criar a segunda cena
4. Clique em "Adicionar cena atual à história" novamente
5. Repita para quantas cenas quiser
6. Clique em "Salvar História" — um link único é gerado
7. Compartilhe o link — quem acessar vê todas as cenas em sequência

---

### Como usar a Timeline para sincronizar animação e áudio

**Tempo estimado: 10 minutos**

A Timeline é a barra visual na parte inferior do editor.

1. Gere ou carregue um áudio (voz ou música)
2. Na Timeline, clique no `+` da trilha **Áudio** e arraste o bloco para o tempo desejado
3. Clique no `+` da trilha **Ação** para adicionar uma animação (ex: "acenar") no mesmo tempo
4. Arraste os blocos para alinhar — quando eles ficam a menos de 0,25s um do outro, fazem snap automático
5. Clique em Play para ver o resultado sincronizado

---

### Como gravar sua própria voz

1. Na aba Fala, clique no botão **microfone** (ícone 🎙️)
2. O browser vai pedir permissão — clique em "Permitir"
3. Fale normalmente
4. Clique em **Parar Gravação** quando terminar
5. O áudio aparece automaticamente no player — clique em Play para testar
6. O lip sync funciona com a sua voz também

---

## Resumo das Prioridades

| Prioridade | Sprint | Item | Impacto no Usuário |
|-----------|--------|------|--------------------|
| 🔴 Alta | A | Welcome Screen + Avatar padrão | Remove paralisia na primeira abertura |
| 🔴 Alta | A | Wizard de Onboarding (3 passos) | Ensina o fluxo principal sem ler docs |
| 🔴 Alta | B | Painel em Abas | Reduz sobrecarga visual |
| 🟡 Média | C | Toast Notifications | Feedback claro de sucesso/erro |
| 🟡 Média | B | Checklist de progresso da cena | Usuário sabe o que falta |
| 🟡 Média | E | Tooltips contextuais | Explica controles difíceis |
| 🟡 Média | A | Templates de cena | Ponto de partida para iniciantes |
| 🟢 Baixa | D | Bottom Navigation Mobile | Melhora experiência em celular |
| 🟢 Baixa | C | Autosave | Conforto de não perder trabalho |
| 🟢 Baixa | E | Modal de Ajuda (FAQ + Como Fazer) | Suporte self-service |
