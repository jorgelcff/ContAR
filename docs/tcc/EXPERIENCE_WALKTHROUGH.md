# ContAR — Expert Walkthrough

Protocolo de avaliação guiada com especialistas (Letras, Geografia e Computação),
usado para coletar feedback **antes** de testar com usuários finais.

---

## Objetivo

Conduzir o especialista por todo o fluxo do ContAR — da criação de conta até a
visualização em AR — coletando impressões qualitativas sobre usabilidade,
clareza e aplicabilidade da ferramenta na área de atuação de cada participante.

O resultado deste walkthrough deve apontar:
- Pontos de confusão ou fricção na interface
- Sugestões de uso pedagógico/profissional específicas de cada área
- Prioridades de ajuste antes da rodada de testes com usuários finais

---

## Como conduzir a sessão

1. Apresente o ContAR brevemente (1-2 frases): *"uma plataforma web onde você cria
   um avatar 3D que fala, com lip sync, e pode publicar como história em AR"*.
2. Peça para o participante **pensar em voz alta** enquanto navega — anote
   hesitações, cliques errados, e comentários espontâneos.
3. Siga o roteiro abaixo na ordem. Cada seção tem uma caixa **📋 Perguntas**
   — faça essas perguntas logo após o participante completar a etapa, com a
   experiência ainda fresca.
4. Ao final, aplique as **perguntas específicas da área** do participante e as
   **perguntas gerais de encerramento**.
5. Duração estimada: **60–90 minutos** (inclui SUS e perguntas qualitativas por perfil).

---

## Perfil do participante

- Nome / área de formação (Letras, Geografia ou Computação):
- Experiência prévia com ferramentas de criação 3D, AR ou edição de vídeo (nenhuma / básica / avançada):
- Já utilizou avatares virtuais, narradores de IA ou ferramentas de TTS antes? Em que contexto?

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

📋 **Perguntas**
- O processo de criação de conta foi claro? Encontrou algum ponto confuso?
- Alguma informação solicitada pareceu desnecessária ou faltando?

---

## 2. Criar o avatar `(Tarefa T1)`

1. Clique em **Nova cena** no painel de cenas
2. No painel esquerdo, vá para a aba **Avatar**
3. Clique em **Abrir Avaturn** — o widget abre dentro da própria página
4. Customize o personagem (rosto, cabelo, roupa) e clique em **Next**
5. O avatar aparece automaticamente na cena 3D

> **Avaturn salva automaticamente.** Você pode reutilizar o mesmo avatar em outras cenas pela galeria.

📋 **Perguntas**
- A criação/customização do avatar foi intuitiva? Você se sentiu representado pelo resultado?
- Você conseguiria orientar um colega ou aluno a fazer essa etapa sozinho, sem ajuda?

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

### Gerar áudio com lip sync `(Tarefa T2)`

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

### Salvar a cena `(Tarefa T3)`

1. Vá para a aba **Cena**
2. Digite um nome (ex: "Cena 1 — Introdução")
3. Clique em **💾 Salvar** — ou aguarde o auto-save (3 segundos após qualquer mudança)

📋 **Perguntas**
- A pose escolhida combinou com o texto/contexto da fala?
- O lip sync e a voz gerada pareceram naturais? Algo te incomodou?
- Você sentiu falta de algum controle (ex: emoção, gestos, velocidade da fala)?

---

## 4. Montar a história — como o editor funciona `(Tarefa T4)`

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
   - O campo de **título da cena** é limpo — dê um novo nome à próxima cena para diferenciá-la na lista
3. **Mude o conteúdo** do editor para a Cena 2 (novo texto, nova pose, novo título, novo áudio) — sem pressa, o autosave vai criar uma cena separada para esse novo conteúdo
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

📋 **Perguntas**
- O conceito de "cena ativa" ficou claro, ou você se perdeu em algum momento sobre o que estava editando?
- Montar uma sequência de cenas em uma história fez sentido para contar uma narrativa?
- Você conseguiria montar uma história curta (3-4 cenas) sem assistência?

---

## 5. Visualizar e abrir em AR `(Tarefa T5)`

- Acesse `/stories` para ver suas histórias
- Clique em **▶ Assistir** ou use o link público gerado
- As cenas avançam automaticamente quando o áudio termina
- Use ◀ / ▶▶ para navegar manualmente

📋 **Perguntas**
- A experiência de assistir à história foi fluida? O ritmo entre as cenas pareceu adequado?
- Você usaria esse link público para compartilhar com outras pessoas (alunos, colegas, público)?

---

## 6. Abrir em AR *(continuação T5)*

### Marcador (funciona em qualquer smartphone)

1. No viewer, clique em **AR** no topo
2. Clique em **AR de Marcador** e use um marcador personalizado
3. Aponte a câmera para o marcador — o narrador aparece sobre ele e conta a história

### Superfície (Android com Chrome + ARCore)

1. No viewer, clique em **AR**
2. Clique em **Abrir AR de Superfície**
3. Aguarde o anel aparecer no chão
4. Toque para posicionar o narrador e clique em **▶ Iniciar história**

> No iPhone/iPad, o Safari não suporta esse modo (WebXR não existe no iOS) — use o **AR de Marcador** acima, que funciona em qualquer celular.

📋 **Perguntas**
- A experiência em AR agregou algo em relação a assistir a história em 3D normal?
- Em que situação real você usaria (ou recomendaria usar) o modo AR?

---

## 7. Compartilhar

O link público gerado ao publicar funciona sem login:

```
https://avaturn-threejs-1.onrender.com/story/[ID]
```

📋 **Perguntas**
- Compartilhar via link simples é suficiente para o seu caso de uso, ou você precisaria de outras opções (ex: incorporar em um site, exportar vídeo)?

---

## 8. System Usability Scale (SUS)

> Aplique **imediatamente após §7**, antes das perguntas qualitativas. Compartilhe o link do Google Forms no chat da videochamada e peça para preencher ali (leva ~3 minutos). Assim a impressão do sistema ainda está fresca e não é influenciada pelas perguntas abertas.
>
> Escala: **1** = Discordo totalmente · **5** = Concordo totalmente

| # | Afirmação | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| 1 | Eu acho que gostaria de usar esse sistema com frequência. | ○ | ○ | ○ | ○ | ○ |
| 2 | Eu achei o sistema desnecessariamente complexo. | ○ | ○ | ○ | ○ | ○ |
| 3 | Eu achei o sistema fácil de usar. | ○ | ○ | ○ | ○ | ○ |
| 4 | Eu acho que precisaria de ajuda de uma pessoa técnica para conseguir usar o sistema. | ○ | ○ | ○ | ○ | ○ |
| 5 | Eu achei que as várias funções do sistema estavam bem integradas. | ○ | ○ | ○ | ○ | ○ |
| 6 | Eu achei que havia muita inconsistência no sistema. | ○ | ○ | ○ | ○ | ○ |
| 7 | Eu imagino que a maioria das pessoas aprenderia a usar esse sistema muito rapidamente. | ○ | ○ | ○ | ○ | ○ |
| 8 | Eu achei o sistema muito incômodo de usar. | ○ | ○ | ○ | ○ | ○ |
| 9 | Eu me senti muito confiante ao usar o sistema. | ○ | ○ | ○ | ○ | ○ |
| 10 | Eu precisei aprender muitas coisas antes de conseguir usar o sistema. | ○ | ○ | ○ | ○ | ○ |

**Cálculo do score:** some as contribuições de cada item. Para ímpares (1,3,5,7,9): valor − 1. Para pares (2,4,6,8,10): 5 − valor. Multiplique o total por 2,5. Score: ____ / 100.

> Referência: acima de 68 = acima da média · acima de 80 = bom · acima de 90 = excelente (Bangor et al., 2009).

---

## 9. Perguntas específicas por perfil

> Aplique **apenas o bloco do perfil** do especialista que está sendo entrevistado. Faça após o SUS, com a experiência ainda presente.

### E1 — Especialista em IHC, Realidade Aumentada e RV

- Considerando as 10 heurísticas de Nielsen, quais foram as violações mais evidentes durante o uso?
- A experiência de AR (Surface WebXR e/ou Marker AR.js) apresentou problemas de estabilidade de ancoragem, feedback de rastreamento ou ergonomia de interação móvel?
- O fluxo de autoria (avatar → fala → pose → história → publicação) está adequadamente integrado para um usuário sem formação técnica?
- Que padrões de interação ou metáforas de interface você recomendaria adotar ou evitar nesta plataforma?
- Há gargalos técnicos perceptíveis (geração de áudio, carregamento de modelos 3D, tempo de resposta do backend)?

### E2 — Especialista em Educação Antirracista e Letramento Racial

- O suporte a avatares com diversidade fenotípica atende à demanda por representatividade exigida pela Lei 10.639/2003?
- A qualidade da voz, do lip sync e da expressividade do avatar é suficiente para uso em materiais pedagógicos sobre cultura afro-brasileira?
- Um professor sem formação técnica conseguiria criar, de forma autônoma, uma história antirracista como a de "Dandara dos Palmares"?
- O modo AR (marcador ou superfície) agrega valor em contextos de formação docente ou sala de aula? Em qual situação concreta você imagina esse uso?
- Quais melhorias tornariam o ContAR mais útil nos cursos de letramento racial que você conduz?

### E3 — Especialista em RA Educacional e Autoria de Conteúdo

- Em que medida o ContAR atende aos princípios de design para ferramentas de autoria de RA que você estabeleceu (fluxo guiado, sem código, feedback imediato, vocabulário pedagógico)?
- Onde o fluxo de autoria mais se afasta desses princípios? O que seria necessário para aproximá-lo?
- O conceito de "cena ativa" e a composição de histórias sequenciais ficaram claros sem documentação prévia?
- Como o ContAR se posiciona frente às ferramentas avaliadas em seu trabalho (ZapWorks, Assemblr, CoSpaces)?
- Que funcionalidades ou integrações você priorizaria para uma próxima versão voltada a professores da educação básica?

---

## 10. Perguntas gerais de encerramento

- De 0 a 10, qual a probabilidade de você recomendar o ContAR para um colega da sua área?
- Qual seria o principal caso de uso que você imagina para essa ferramenta?
- O que mais te surpreendeu, positiva ou negativamente?
- Quais seriam os 3 principais pontos a melhorar antes de testar com usuários finais?
- Você teria interesse em participar de uma próxima rodada de testes, já com as melhorias aplicadas?

---

## Anexo — Ficha de Registro de Heurísticas *(uso exclusivo do moderador)*

> Preencha durante e após a sessão. Anote cada problema identificado com a heurística violada e a severidade segundo Nielsen (0 = não é problema; 1 = cosmético; 2 = menor; 3 = maior; 4 = catastrófico).

| # | Etapa / tela | Descrição do problema | Heurística | Sev. |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |

**Heurísticas de Nielsen:**
H1 Visibilidade do status · H2 Correspondência com o mundo real · H3 Controle e liberdade · H4 Consistência e padrões · H5 Prevenção de erros · H6 Reconhecimento em vez de memorização · H7 Flexibilidade e eficiência · H8 Estética e design minimalista · H9 Recuperação de erros · H10 Ajuda e documentação

**Critérios XR (Gabbard & Swan, 2008):**
XR1 Estabilidade e ancoragem de objetos virtuais · XR2 Feedback de rastreamento e estado do AR · XR3 Ergonomia da interação em ambiente móvel

---

## Limitações atuais (contexto para o moderador)

- A experiência mobile ainda está em ajuste — recomenda-se desktop para autoria
- AR de superfície depende do suporte ARCore/WebXR do navegador (não funciona em iPhone)
- O backend no free tier do Render pode demorar ~30s para responder após ficar inativo
- **Óculos duplicados**: o SDK Avaturn exporta o GLB com óculos mesclados à geometria; não é possível corrigir via código — limitação do exportador Avaturn
- **Upload de foto para avatar**: o SDK Avaturn (`@avaturn/sdk` v1.1.4) não expõe API de upload de foto; o fluxo de foto é exclusivamente via interface interna do iframe
- **Variedade de cabelo/acessórios**: limitada ao catálogo Avaturn; a plataforma não permite adicionar assets customizados via SDK
- **Fidelidade do avatar ao usuário**: depende integralmente do motor de geração do Avaturn; a plataforma não tem controle sobre o resultado
- **Variedade de poses**: atualmente limitada às animações empacotadas; expansão requer adição de novos arquivos de animação
- **Expressões VRM**: botões de expressão (happy, sad, etc.) só aparecem quando o avatar é do tipo VRM (.vrm); avatares GLB do Avaturn não suportam morphTargets de expressão
