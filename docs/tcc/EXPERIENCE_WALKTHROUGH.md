# ContAR — Experience Walkthrough

Guia completo de como usar o ContAR do zero até ter uma história com narrador 3D em AR.

---

## Antes de começar (expectativa real)

- O fluxo recomendado é: **uma cena simples primeiro**, depois história completa.
- O editor já está pronto para uso, mas ainda há refinamentos em andamento para onboarding e mobile.
- Em AR, o resultado varia conforme navegador, câmera e suporte do dispositivo.

---

## Visão Geral do Fluxo

```
Criar conta → Criar avatar → Criar cena → Adicionar fala/áudio → Montar história → Visualizar → Abrir em AR
```

---

## 1. Criar Conta

1. Acesse a aplicação e clique em **Entrar** no cabeçalho
2. Na tela de login, clique em **Criar conta**
3. Preencha nome, email e senha (mínimo 6 caracteres)
4. Clique em **Cadastrar**
5. Um email de verificação será enviado (opcional — você já pode usar a plataforma)

> **Dica:** Se esquecer a senha, use o link "Esqueci minha senha" na tela de login.

---

## 2. Criar o Avatar do Narrador

<!-- Você tem três opções para obter um avatar: -->

### Avaturn

1. No editor, clique na aba **Avatar** no painel esquerdo
2. Clique em **Abrir Avaturn**
3. No widget que abre, crie ou selecione um avatar 3D personalizado
4. Clique em **Next/Exportar** — o avatar aparece automaticamente na cena

<!-- ### Opção B — Upload de arquivo GLB/VRM
1. No editor, aba **Avatar** → clique em **Carregar GLB/VRM**
2. Selecione um arquivo `.glb` ou `.vrm` do seu computador
3. O avatar carrega imediatamente como preview
4. O arquivo é enviado ao servidor em segundo plano para persistir entre sessões

> **Importante em produção:** o servidor precisa da variável `BACKEND_URL` configurada para que a URL seja pública. Se você ver um aviso de "URL localhost", configure essa variável no Render. -->
<!--
### Opção C — URL direta
1. Cole uma URL pública de um arquivo `.glb` no campo de URL
2. Clique em **Carregar**

### Opção D — Ready Player Me (alternativa gratuita)
1. Acesse [readyplayer.me](https://readyplayer.me) e crie um avatar
2. Ao exportar, copie a URL do arquivo `.glb`
3. Cole no campo de URL do editor e clique em **Carregar**

### Opção E — VRoid Hub
1. Acesse [hub.vroid.com](https://hub.vroid.com) e escolha um avatar VRM gratuito
2. Baixe o arquivo `.vrm`
3. Use o upload de arquivo no editor -->

---

## 3. Configurar a Cena

### 3.1 — Ajustar o Avatar

- **Pose:** selecione `idle`, `walk`, `dance`, `speaker` ou outra na aba Avatar
- **Posição/Rotação/Escala:** use os sliders em "Transformações avançadas"
- **Bones customizados:** no modo `?dev`, calibre ossos manualmente para avatares com rigging não-padrão

### 3.2 — Adicionar a Fala do Narrador

1. Vá para a aba **Fala** no painel esquerdo
2. Digite o texto que o narrador vai "dizer"
3. O texto aparece na bolha de fala acima do avatar na cena

### 3.3 — Gerar Áudio (lip sync)

**Com Azure TTS (recomendado, gratuito 500k chars/mês):**

1. Vá para a aba **Áudio**
2. Clique em **✨ Gerar fala** na seção "Gerar fala com IA"
3. Escolha a voz (Francisca Neural, Antonio Neural, etc.)
4. O áudio é gerado com visemes sincronizados automaticamente

**Com Voz do Navegador (gratuito, sem API):**

1. Clique em **🔊 Falar agora** na seção "Voz do Navegador"
2. A voz do browser fala o texto com lip sync aproximado
3. Útil para preview rápido

**Com áudio próprio:**

1. Clique em **Gravar** para capturar pelo microfone
2. Ou **Carregar áudio** para fazer upload de um MP3/WAV
3. Em "Configurações avançadas", clique em **Gerar timeline local** para adicionar lip sync baseado no texto

### 3.4 — Nomear e Salvar a Cena

1. Vá para a aba **Cena**
2. Digite um nome no campo de título (ex: "Cena 1 — Introdução")
3. Clique em **💾 Salvar cena** — ou aguarde o auto-save (3 segundos após qualquer mudança)
4. O ID da cena aparece após o primeiro save

---

## 4. Montar a História

### 4.1 — Adicionar cenas à história

1. Na aba **Cena**, com a cena salva, clique em **+ Adicionar cena à história**
2. Repita o processo: edite o avatar, fala, áudio → salve → adicione à história
3. Cada cena tem sua própria pose, texto e áudio

### 4.2 — Configurar a história

1. Vá para a aba **História**
2. Digite o título da história
3. Adicione uma descrição opcional
4. Clique em **📖 Publicar história**
5. O link de compartilhamento é gerado

### 4.3 — Gerenciar cenas da história

- A lista de cenas aparece na aba História
- Arraste para reordenar (funcionalidade futura) ou remova individualmente
- Cada cena pode ser editada independentemente — as mudanças são salvas automaticamente

---

## 5. Visualizar a História

### 5.1 — Pelo Viewer

1. Acesse `/stories` para ver suas histórias
2. Clique em **▶ Assistir** ou use o link de compartilhamento `/story/[ID]`
3. Na tela de splash, clique no botão **▶** grande para iniciar
4. As cenas avançam automaticamente quando o áudio termina
5. Use os botões ◀ ▶▶ para navegar manualmente

### 5.2 — Controles do Viewer

| Controle           | Ação                    |
| ------------------ | ----------------------- |
| ▶ / ⏸              | Iniciar / pausar        |
| ◀ / ▶▶             | Cena anterior / próxima |
| Slider escala      | Redimensionar o avatar  |
| ⛶                  | Tela cheia (mobile)     |
| Barra de progresso | Mostra % da cena atual  |

---

## 6. Experiência em AR

### 6.1 — Via Botão no Viewer

1. No viewer da história, clique em **AR** no topo
2. Você vai para `/ar?storyId=[ID]` com a história pré-configurada
3. Na tela do AR, abra **Configurações avançadas** para ajustar tamanho
4. Clique no modo desejado e depois em **▶ Iniciar história**

### 6.2 — AR de Marcador (funciona em qualquer celular)

1. Acesse `/ar` no celular
2. Em "Configurações avançadas", configure o ID da história
3. Clique em **▶ Demo com Marcador Hiro**
4. Imprima ou exiba o marcador Hiro: `https://bit.ly/hiro-marker`
5. Aponte a câmera — o narrador aparece sobre o papel e conta a história

### 6.3 — AR de Superfície (Android + ARCore ou iOS 15+)

1. Clique em **Abrir AR de Superfície**
2. Aguarde o reticle (anel ciano) aparecer no chão
3. Toque para posicionar o narrador
4. Clique em **▶ Iniciar história**
5. O áudio toca e o avatar faz lip sync em tempo real

---

## 7. Compartilhar

### Link de visualização

```
https://avaturn-threejs-1.onrender.com/story/[ID]
```

Qualquer pessoa com o link pode assistir sem criar conta.

<!-- ### QR Code para AR
Gere um QR Code apontando para:
```
https://avaturn-threejs-1.onrender.com/ar?storyId=[ID]
```
Imprima junto com o marcador Hiro para uma experiência completa de AR sem app. -->

---

<!--
## 8. Alternativas de Criação de Personagem

| Serviço | Tipo | Gratuito | Qualidade | Integração |
|---|---|---|---|---|
| **Avaturn** | Realista, customizável | Sim (conta) | Alta | Nativo no ContAR |
| **Ready Player Me** | Cartoon/Realista | Sim | Alta | URL GLB |
| **VRoid Studio** | Anime | Sim | Alta | Upload VRM |
| **VRoid Hub** | Anime | Sim | Alta | URL/Download VRM |
| **Mixamo + Adobe Fuse** | Realista | Sim (CC) | Média | Download GLB |
| **Reallusion CC** | Realista | Trial | Muito alta | Export GLB |

### Como usar Ready Player Me no ContAR
1. Acesse [readyplayer.me](https://readyplayer.me/avatar)
2. Crie o avatar (customização facial, roupa, cor)
3. Clique em **Pose** → **T-Pose** para melhores resultados
4. Copie o link de exportação GLB: `https://models.readyplayer.me/[ID].glb?morphTargets=ARKit`
5. Cole no campo de URL do editor ContAR

> **Dica:** adicione `?morphTargets=ARKit` na URL do RPM para habilitar blendshapes faciais e lip sync completo.

### Como usar VRoid Studio no ContAR
1. Baixe [VRoid Studio](https://vroid.com/studio) (Windows/Mac)
2. Crie seu personagem
3. Exporte como `.vrm`
4. Faça upload no editor ContAR (suporte a VRM nativo) -->

---

<!--
## 9. Dicas de Produção

- **Cold start no Render (free tier):** o backend dorme após 15min. Configure o [UptimeRobot](https://uptimerobot.com) para pingar `https://avaturn-threejs.onrender.com/health` a cada 5min
- **Áudio no mobile:** o áudio só toca após o usuário clicar — é a política de autoplay dos browsers. A splash screen resolve isso
- **Lip sync melhor:** use Azure TTS com vozes Neural — timing real vs estimado por texto
- **AR mais estável:** marcador Hiro em papel A4 impresso com boa iluminação funciona melhor que tela de celular
- **Salvar antes de sair:** o auto-save funciona mas aguarde o indicador "Salvo" aparecer antes de fechar a aba

---

## 10. Problemas Comuns

| Problema | Causa Provável | Solução |
|---|---|---|
| Tela escura no viewer | Cena sem avatar configurado | Abra a cena no editor e selecione um avatar |
| Avatar sumiu ao recarregar | URL era local (blob) ou localhost | Configure `BACKEND_URL` no Render |
| Áudio não toca | Política de autoplay | Clique em ▶ na splash screen |
| AR mostra 502 | Backend dormindo (free tier) | Aguarde 30s ou configure keep-alive |
| Lip sync travado | Áudio sem timeline de visemas | Use Azure TTS ou clique em "Gerar timeline local" |
| "Cannot GET /" no backend | Normal — não há rota raiz | Use `/health` ou `/api/...` | -->
