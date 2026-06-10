# ContAR — Walkthrough da Experiência

Guia direto de como usar o ContAR do zero até ter uma história com narrador 3D.

---

## Fluxo principal

```
Criar conta → Criar avatar → Configurar cena → Montar história → Visualizar → AR
```

---

## 1. Criar conta

1. Clique em **Entrar** no cabeçalho
2. Clique em **Criar conta**
3. Preencha nome, e-mail e senha (mínimo 6 caracteres)
4. Clique em **Cadastrar**

> O e-mail de verificação é opcional — você já pode usar a plataforma sem confirmar.

---

## 2. Criar o avatar

1. Clique em **Nova cena** no painel de cenas
2. No painel esquerdo, vá para a aba **Avatar**
3. Clique em **Abrir Avaturn** — o widget abre dentro da própria página
4. Customize o personagem (rosto, cabelo, roupa) e clique em **Next**
5. O avatar aparece automaticamente na cena 3D

> **Avaturn salva automaticamente.** Você pode reutilizar o mesmo avatar em outras cenas pela galeria.

---

## 3. Configurar a cena

### Pose e animação

- Na aba **Avatar**, escolha a pose: `idle`, `walk`, `walk_circle`, `slow_run`, `run`, `dance` ou `speaker`
- As poses mudam a animação do personagem em tempo real

### Posição e escala

- Em **Transformações avançadas**, use os sliders para ajustar posição (X/Y/Z), rotação e escala
- As mudanças são aplicadas imediatamente no preview

### Texto da fala

1. Vá para a aba **Fala**
2. Digite o que o narrador vai dizer
3. O texto aparece na bolha de fala acima do avatar

### Gerar áudio com lip sync

**Azure TTS (recomendado):**
1. Vá para a aba **Áudio**
2. Clique em **✨ Gerar fala com IA**
3. Escolha a voz (Francisca Neural, Antonio Neural…)
4. O áudio é gerado e sincronizado automaticamente com o avatar

**Voz do navegador (preview rápido, sem API):**
1. Clique em **🔊 Falar agora**
2. A voz do browser fala o texto com lip sync aproximado

**Áudio próprio:**
1. Clique em **Gravar** (microfone) ou **Carregar áudio** (MP3/WAV)
2. Em **Configurações avançadas**, clique em **Gerar timeline local** para adicionar lip sync baseado no texto

### Salvar a cena

1. Vá para a aba **Cena**
2. Digite um nome (ex: "Cena 1 — Introdução")
3. Clique em **💾 Salvar** — ou aguarde o auto-save (3 segundos após qualquer mudança)

---

## 4. Montar a história — como o editor funciona

### O editor trabalha em uma cena de cada vez

O editor tem sempre uma **cena ativa**. Tudo que você configura (avatar, pose, texto, áudio) pertence a essa cena ativa. A cena ativa muda dependendo do que você fez por último:

| Situação | Cena ativa |
|---|---|
| Abriu `/editor` sem parâmetros | A última cena da sessão (ou nova, se primeira vez) |
| Clicou "Adicionar à história" | A cena recém-criada por esse clique |
| Clicou no lápis de um card da história | A cena daquele card |

### Fluxo para criar uma história com várias cenas

```
Configure → Adicionar à história → mude o conteúdo → Adicionar à história → repita
```

**Passo a passo:**

1. Configure o avatar, pose, texto e áudio para a **Cena 1**
2. Na aba **Cena** ou **História**, clique em **+ Adicionar cena à história**
   - Isso salva o estado atual como uma nova cena e a adiciona à lista no painel inferior
   - A cena aparece como **#1** no painel inferior
   - O editor se "desconecta" dessa cena: a partir daqui, qualquer mudança cria uma cena nova (a #1 não é mais sobrescrita)
3. **Mude o conteúdo** do editor para a Cena 2 (novo texto, nova pose, novo áudio) — sem pressa, o autosave vai criar uma cena separada para esse novo conteúdo
4. Clique em **+ Adicionar à história** novamente
   - Isso cria a cena **#2** e a adiciona à lista
5. Repita para quantas cenas quiser

### Editar uma cena já criada

No painel inferior (StoryBuilder), cada card de cena tem um **botão de lápis (✏️)**. Clicar nele carrega aquela cena no editor. Qualquer mudança vai atualizar aquela cena específica via autosave.

Para voltar a criar cenas novas depois de editar uma existente, clique em **+ Adicionar à história** novamente — isso criará uma nova cena a partir do conteúdo atual.

### Reordenar cenas

Arraste os cards no painel inferior para mudar a ordem de reprodução da história.

### Publicar

1. Vá para a aba **História**
2. Digite o título e uma descrição opcional
3. Clique em **📖 Publicar história**
4. O link público é gerado na hora

---

## 5. Visualizar

- Acesse `/stories` para ver suas histórias
- Clique em **▶ Assistir** ou use o link público gerado
- As cenas avançam automaticamente quando o áudio termina
- Use ◀ / ▶▶ para navegar manualmente

---

## 6. Abrir em AR

### Marcador Hiro (funciona em qualquer smartphone)

1. No viewer, clique em **AR** no topo
2. Clique em **Demo com Marcador Hiro**
3. Imprima ou exiba o marcador: `https://bit.ly/hiro-marker`
4. Aponte a câmera — o narrador aparece sobre o marcador e conta a história

### Superfície (Android com Chrome + ARCore)

1. No viewer, clique em **AR**
2. Clique em **Abrir AR de Superfície**
3. Aguarde o anel aparecer no chão
4. Toque para posicionar o narrador e clique em **▶ Iniciar história**

> No iPhone/iPad, o Safari não suporta esse modo (WebXR não existe no iOS) — use o **Marcador Hiro** acima, que funciona em qualquer celular.

---

## 7. Compartilhar

O link público gerado ao publicar funciona sem login:

```
https://avaturn-threejs-1.onrender.com/story/[ID]
```

---

## Limitações atuais

- A experiência mobile ainda está em ajuste — recomenda-se desktop para autoria
- AR de superfície depende do suporte ARCore/WebXR do navegador
- O backend no free tier do Render pode demorar ~30s para responder após ficar inativo
