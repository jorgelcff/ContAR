# ContAR — Insights do Expert Walkthrough (Sessões Oficiais)

> Documento vivo. Atualizado com a análise das transcrições integrais das
> três sessões oficiais: Guilherme, Francisco (Simões) e Manoela, todas
> gravadas em 19/06/2026.

**Especialistas:** E1 = Francisco Simões (IHC/Sistemas) · E2 = Guilherme José
Ferreira de Araújo (Educação Antirracista) · E3 = Manoela Milena Oliveira da
Silva (RA Educacional/Autoria)

---

## 0. Novidades trazidas pelas transcrições (não capturadas nas anotações manuscritas)

Esta seção reúne o que as transcrições completas revelaram e que **não** estava
nas suas anotações originais — tanto detalhes de contexto quanto achados novos.

### Contexto da condução das sessões

- **Simões não participou da sessão do Guilherme** (mencionado explicitamente:
  *"Eu cheguei a convidar Chico mas acredito que ele não vai conseguir
  participar"*), mas **apareceu ao vivo durante a sessão do Guilherme** em
  certo momento, comentando lateralmente sobre a pesquisa (ver troca às
  4:40–5:40 da transcrição do Guilherme) antes de fazer sua própria sessão
  depois. Isso significa que a sessão do Simões pode ter sido levemente
  influenciada por já ter visto fragmentos da experiência do Guilherme — vale
  mencionar como limitação metodológica no artigo.
- **O tour guiado foi deliberadamente pulado em todas as sessões oficiais**,
  por decisão metodológica do pesquisador, para capturar a experiência "crua"
  do usuário sem suporte. Você verbalizou isso explicitamente para o Simões:
  *"a maioria dos pontos que tu teve dificuldade [...] quando o usuário faz
  aquele tour lá no começo [...] já resolve basicamente boa parte"*. **Isso é
  uma decisão metodológica importante a registrar explicitamente no artigo**
  — o estudo mede o pior caso (zero onboarding), não a experiência completa
  pretendida pelo produto.
- Você confirmou ao Simões que **já gravou um vídeo tutorial** (pedido em uma
  sessão de check-in anterior) cobrindo criação de cena, adição de cena e
  criação de avatar — ainda em edição no momento da sessão.
- Você mencionou ao Simões que **já corrigiu o problema de tom de pele**
  antes da sessão dele (o Avaturn agora usa um intervalo min/max baseado na
  foto, permitindo tons mais escuros) — ou seja, **o feedback do Guilherme já
  gerou uma correção real entre as sessões**. Isso é uma evidência forte de
  iteração ágil para o artigo.
- **Decisão metodológica discutida com Simões:** vocês concordaram que
  correções de **bugs** entre sessões são aceitáveis (não invalidam o
  experimento, pois o próximo participante "só vai funcionar o que a gente
  não viu"), mas correções de **melhorias de UX/UI** (botões, fluxos)
  deveriam ser evitadas entre sessões para preservar a comparabilidade dos
  dados — Simões: *"corrigir o bug eu acho ok [...] agora qualquer coisa que
  você mudar que gera uma coisa diferente da gente seria ruim"*. **Esse
  critério já foi formalmente acordado e deveria ir para a metodologia do
  artigo.**

### Achados novos (não estavam nas anotações manuscritas)

- **[Simões] Texto de transição confunde também ele**, não só a Manoela:
  *"O que é esse texto de transição? Não sei. Tem bloco de ação, bloco de
  áudio."* — confirma o achado em **3 das 4 sessões** agora (Manoela, e
  implicitamente Simões aqui).
- **[Simões] Animações se acumulando/não resetando corretamente**: ao
  trocar de pose, a pose anterior parece influenciar a seguinte de forma
  incorreta — hipótese dele: *"Talvez ele esteja fazendo uma transformação
  por cima da outra [...] não faz dar zero [...] volta pra zero e depois
  faz"*. Isso é uma hipótese técnica concreta e útil para o Claude Code
  investigar (possível bug de não resetar o estado do AnimationMixer entre
  poses).
- **[Simões] Escala não tem unidade/referência clara**: *"como é que eu sei
  o que significa essa escala? [...] 1 significa o quê? Uma pessoa de 1
  metro e 70? Não sei"* — ponto de clareza de UI não capturado antes.
- **[Simões] Rotação em Y não parece ter efeito perceptível** (ele tentou e
  comentou "não faz nada") — possível bug ou eixo mal calibrado.
- **[Simões] Botão "Next" do Avaturn deveria ficar desabilitado até o
  usuário passar por todas as categorias de customização** — sugestão de
  design concreta, não só queixa: *"Tivesse como deixar [...] o Next
  desabilitado e só habilitar depois de ter passado pelas mesmas categorias
  [...] isso resolvia, do ponto de vista de intuição."*
- **[Simões] Botão "Criar Avatar" deveria se chamar "Criar/Editar Avatar"**
  — proposta de copy específica: *"o botão criar vira editar. Criar, barra,
  editar, avatar."* Ele tentou reabrir o editor de avatar e não encontrou
  como editar, assumindo que teria que criar um novo do zero.
- **[Simões] Confirma o mesmo bug de avatar não persistir/carregar entre
  cenas** que já havíamos catalogado — mas aqui com detalhe técnico adicional:
  *"Depois aqui não tem nome do avatar para você salvar. Você cria o avatar
  e ele não carrega. Tem que dar um F5 aqui na página e ele vai carregar."*
  **Isso é uma pista de debug valiosa**: parece ser um problema de
  sincronização de estado no frontend que um reload resolve — sugere que o
  dado já está persistido no backend, mas o componente React não está
  re-renderizando/buscando o estado atualizado.
- **[Simões] Confusão entre "Adicionar cena à história" e duplicar**: *"eu
  achei estranho quando eu cliquei aqui em [adicionar cena], ele replicou,
  né? Como se fosse um duplicar"* — ele propõe que talvez o botão deveria
  se chamar diferente dependendo do contexto (se já foi adicionado, virar
  "duplicar"; se não, "adicionar").
- **[Simões] Sugestão de UX concreta para o player de história**: não há
  botão de play visível na tela do editor — ele teve que navegar para uma
  tela de "Histórias" separada para conseguir assistir, o que achou
  pouco natural: *"Não faz sentido nenhum [...] onde é que eu fui?"*
- **[Simões] Proposta de nomenclatura para os modos de AR**: sugeriu
  renomear para "AR com marcador", "AR no plano" (ou "AR ancorado") e o modo
  sem ancoragem real chamar de algo como "AR não ancorado" (ele descartou
  "descontextualizado" como nome feio). Você mencionou que o modo atual
  exige apertar "reposicionar" para o avatar aparecer corretamente.
- **[Simões] Proposta de fluxo de compartilhamento muito mais detalhada e
  pronta para implementação** — ver bloco dedicado abaixo.
- **[Simões] Sobre o tom de pele (pós-correção)**: mesmo já com o ajuste de
  intervalo min/max implementado antes da sessão dele, ele relatou que o
  resultado pareceu mais "pardo" do que "negro" para representar a própria
  pele dele (ele se autodescreve como uma pessoa de pele intermediária/
  miscigenada). Frase para o artigo: *"o limite da ferramenta ainda é o
  moreno [...] você já é mais negro do que aparece."* — **mostra que mesmo
  após a correção, a granularidade nos tons mais escuros do espectro ainda é
  insuficiente**, reforçando que o problema de representatividade não foi
  totalmente resolvido pela correção do intervalo min/max.
- **[Simões] Validação espontânea de caso de uso antirracista pelo próprio
  conteúdo de teste**: ele escolheu, por conta própria, criar a história de
  teste como *"uma versão antirracista"* do Pequeno Príncipe, com fala como
  *"bem-vindo à história do pequeno príncipe antirracista"* — mostra que a
  proposta do produto se comunica bem o suficiente para que um avaliador
  técnico (não da área de educação) compreenda e replique a intenção
  pedagógica do projeto sem ser instruído a fazer isso.
- **[Simões] Reposicionamento no AR não ancorado**: confirma e detalha o
  mesmo problema relatado pelo Guilherme — o avatar "anda junto" com o
  celular até o usuário apertar "reposicionar".
- **[Simões] Pergunta sobre heurísticas formais**: quando perguntado
  diretamente sobre violações de heurísticas de Nielsen, ele foi honesto que
  não conseguiria listar de memória sem consultar a lista — **isso é
  relevante para o artigo**: mesmo um especialista em IHC tem dificuldade de
  fazer esse mapeamento "de cabeça" em tempo real; o ônus de mapear as
  heurísticas a partir dos relatos qualitativos ficou, na prática, com o
  pesquisador (você), na análise pós-sessão — vale mencionar isso como nota
  metodológica honesta.
- **[Simões] Visão de produto sobre o estágio atual**: *"Nesse momento, eu
  acho que é muito mais oba-oba da tecnologia do que [ter] um sentido pra
  realidade [aumentada]"* — crítica construtiva de que a justificativa de uso
  do AR ainda não está clara o suficiente para o usuário, reforçando o
  achado já visto com Manoela e Guilherme sobre a falta de relação entre a
  história e o espaço físico.
- **[Simões] Recomendação operacional clara para uso em workshop**: ele
  distingue dois públicos — usuário leigo sozinho (que precisa de
  vídeo-tutorial e onboarding forte) vs. uso em workshop com facilitação
  humana (Guilherme guiando os usuários) — sugerindo que **o caso de uso
  primário de curto prazo pode ser workshop guiado, não autoatendimento
  completo**. Vale considerar essa distinção na seção de discussão/limitações
  do artigo.

### Proposta detalhada do Simões para a tela de compartilhamento

Ele propôs uma reestruturação completa da tela de compartilhamento, com
nível de detalhe suficiente para ir direto para um prompt de implementação:

1. Adicionar uma frase explicativa simples na tela atual, algo como: *"Para
   visualizar no seu celular, copie o link ou leia o QR code."*
2. Separar visualmente em **dois botões/menus distintos**: "AR no Desktop"
   (o que já existe) e um novo "AR no Smartphone".
3. Ao clicar em "AR no Smartphone", abrir uma tela dedicada mostrando **só**
   o QR Code e a opção de copiar o link — sem misturar com as outras opções
   que só fazem sentido no desktop.
4. Geral: *"do jeito que tá, tá tudo misturado [...] não fica claro o que dá
   para usar no celular."*

> **pjorge:** essa proposta do Simões está praticamente pronta para virar
> ticket de implementação — considerar levar quase verbatim para o prompt do
> Claude Code.

### Achados da transcrição completa da Manoela (perfil profissional confirmado)

A transcrição revelou o perfil acadêmico dela com mais precisão do que as
anotações manuscritas: graduação em **ECRAS**, mestrado e doutorado no
**CIn em Computação**, com pesquisa de doutorado especificamente sobre
**como docentes criam conteúdo com ferramentas de autoria sem necessidade de
programação** — incluindo experiência prévia com Aurasma (descontinuada),
ZapWorks/Read.AI e CoSpaces (atualmente renomeada — ela mesma comentou não
lembrar do novo nome). Também tem experiência de pesquisa com avatares para
treinamento e organização de eventos com avatares na plataforma Virbela
(via Voxar Labs). **Esse é o perfil mais alinhado a ferramentas de autoria
de RA entre os três especialistas**, o que dá peso extra às críticas dela
sobre o fluxo de cena/história.

- **[Manoela] Confirmação do bug do tour duplo**: ao pular o tour na tela de
  criação de história, ele reapareceu de novo na tela seguinte (provável
  Avatar) — *"mesmo pulando [...] então eu vou pular de novo"*. Isso é mais
  específico do que a anotação original e indica que **existem pelo menos
  dois pontos de disparo do tour que não compartilham o estado de "já
  pulei"**.
- **[Manoela] Confirma perda da descrição da história** com mais detalhe:
  ao voltar à tela de edição da história, o campo de descrição
  simplesmente não estava mais disponível para edição — *"quando eu voltei
  eu não tinha mais a opção de colocar essa descrição."*
- **[Manoela] — achado novo importante: avatar gestante.** Ela mencionou
  explicitamente, durante a criação do avatar, que está grávida e queria
  representar isso, mas só havia opção de corpo "mais gordinho" ou "mais
  magrinho" — nenhuma opção de gestação. Ela optou pelo corpo magro,
  comentando que isso não a representava no momento: *"eu tô mais cheinha
  [...] a representação tá mais ou menos."* **Esse é um ponto de
  representatividade que vai além da pauta racial e deveria ser registrado
  na discussão como uma limitação mais ampla do catálogo de customização do
  Avaturn** (já catalogado antes via anotação manuscrita, agora confirmado
  com a citação direta).
- **[Manoela] Confirma a interface do Avaturn em inglês** como ponto de
  atenção, qualificando bem o argumento: ela própria não teve dificuldade
  por falar inglês, mas pondera explicitamente sobre o público típico do
  ContAR — professores que podem não ter esse domínio do idioma.
- **[Manoela] Novo detalhe técnico sobre o bug de persistência do avatar**:
  ela teve um travamento no carregamentoo do avatar (suspeita de lentidão de
  rede) e, ao dar refresh na página por sugestão sua, o avatar **não
  recarregou visualmente, mas o progresso realmente estava salvo** —
  *"ele não carregou, mas ele salvou. Então, ótimo."* **Essa é uma evidência
  adicional, agora de uma terceira pessoa, de que o problema é
  exclusivamente de re-render/sincronização do estado no frontend, e não de
  perda de dados no backend** — reforça fortemente a hipótese de debug já
  registrada na sessão do Simões.
- **[Manoela] Sobre as poses estáticas, ela é ainda mais específica que nas
  anotações manuscritas**: a pose de "continência" e "mão na cintura" não
  correspondem visualmente ao nome, e ela sugeriu que isso "vale a pena
  olhar depois" — terceira pessoa a relatar esse mesmo problema (depois de
  Simões e das anotações manuscritas originais).
- **[Manoela] Novo insight de expectativa de produto**: ao chegar na etapa
  de adicionar a fala do personagem, ela esperava poder **gravar áudio
  diretamente**, e só ao explorar a interface percebeu que era preciso
  digitar o texto para gerar a fala via TTS — *"eu penso mais que eu ia
  gravar o áudio [...] aqui eu tô vendo que [...] eu digitei e vai
  gerar."* Isso é um desalinhamento de modelo mental relevante: o nome do
  campo ("fala") sugere captura de voz, não composição de texto.
- **[Manoela] Detalha tecnicamente a confusão entre "gerar fala"/TTS e
  "sincronizar lábios"**: ela descreve com precisão a sequência de botões
  que a confundiu — gerar fala → sincronizar lábios (mais abaixo na tela) →
  "audio play" (em outro lugar ainda) — concluindo: *"ficou menos intuitivo
  que as demais."* Esse é provavelmente o relato mais detalhado e citável
  sobre esse problema específico entre as três sessões.
- **[Manoela] — achado técnico crítico, com causa raiz identificada por
  ela mesma**: durante a criação da história com 4 cenas, **ela esqueceu de
  clicar em "gerar voz" antes de salvar/adicionar duas das cenas (a 2ª e a
  4ª)** — o que resultou nessas cenas não tendo áudio na visualização final.
  Ela mesma percebe o próprio erro durante a sessão: *"sabe que eu não gerei
  a fala dele? Eu lembro de ter clicado em todos"* (mas não tinha, de fato).
  **Isso reclassifica parte do problema "áudio da cena X não funciona" — não
  é só um bug, é também um erro de usuário induzido por um fluxo que não
  bloqueia/avisa quando uma cena está sendo salva sem áudio gerado.** Vale
  considerar uma validação ou aviso antes de salvar uma cena sem áudio.
- **[Manoela] Identifica e nomeia o problema central da "cena ativa" com
  mais precisão do que qualquer outra sessão**: ela descreve exatamente o
  comportamento confuso — ao clicar para criar uma cena, o sistema às vezes
  a leva direto para o modo de edição sem deixar claro que aquilo é uma nova
  cena sendo criada vs. a edição de uma já existente: *"eu clicava aqui,
  cria a cena, aí vinha pra cá [...] não percebi [...] que era pra editar e
  ele vinha pra cá."* Ela também relata terem se confundido especificamente
  com o **"Texto de Transição"**, confirmando com riqueza de detalhe o
  mesmo ponto já visto na sessão do Simões.
- **[Manoela] — intervenção do próprio pesquisador durante a sessão**: ao
  notar a confusão recorrente, você (Jorge) pausou a tarefa e **explicou
  ativamente o fluxo correto** ("toda vez que a gente for adicionar uma cena
  na história, a gente deveria ir para a parte de edição, adicionar o avatar
  [...] depois salvar essa cena, adicionando ela à nossa história") antes de
  pedir que ela tentasse de novo. **Isso é uma quebra do protocolo Think
  Aloud puro** (intervenção ativa, não apenas pergunta "o que você esperava
  encontrar aqui?") — metodologicamente relevante: deveria ser registrado
  como tal no artigo, já que o restante da tarefa dela (criar a 2ª cena após
  a explicação) não reflete mais o comportamportamento "sem assistência".
- **[Manoela] Confirma também a duplicação indesejada ao adicionar cena**:
  mesmo após a explicação, ela relata o sistema "adicionando uma cenazinha
  extra" sem ela ter pedido, similar ao relato do Simões sobre duplicação.
- **[Manoela] Confirma o bug do título da cena não atualizando
  visualmente**, com detalhe extra: o campo mostra um "códigozinho" (provável
  UUID ou ID interno) em vez do título digitado — *"tá como se fosse um
  bug, né?"* (comentário do próprio Jorge durante a sessão, concordando).
- **[Manoela] Update Story como etapa não óbvia**: ela só conseguiu ver a
  história completa com as 4 cenas depois que você (Jorge) explicou que era
  necessário clicar em "Update Story" — ela não tinha notado essa
  necessidade sozinha (mencionado 2x na transcrição, em momentos diferentes).
- **[Manoela] Controle de navegação do player de história não funciona como
  esperado**: tentou usar as setas do mouse/teclado para avançar/voltar
  entre cenas na visualização e não funcionou — ela tentou múltiplas formas
  (clique, teclado) sem sucesso, e a cena 1 ficou "travada" na tela mesmo
  após tentar avançar.
- **[Manoela] AR de marcador indisponível por falta de marcador gerado**:
  ao tentar abrir em modo Marker AR, você teve que intervir dizendo que não
  funcionaria porque "não gerou marcador" — sugerindo que **o sistema
  permite tentar abrir o modo Marcador mesmo quando nenhum marcador foi de
  fato gerado para aquela história**, sem aviso prévio disso à usuária. Vale
  considerar desabilitar essa opção ou mostrar uma mensagem clara quando
  não houver marcador associado.
- **[Manoela] Compartilhamento de QR code via WhatsApp como solução
  improvisada**: como alternativa ao link copiado, você sugeriu que ela
  enviasse o QR code do WhatsApp dela para você escanear — uma solução
  manual criada na hora, fora do fluxo da própria plataforma, que reforça
  novamente a necessidade da melhoria de compartilhamento já proposta pelo
  Simões (ver acima).

---

## 1. Scores SUS

| Especialista | Perfil | Score SUS | Classificação (Bangor et al.) |
|---|---|---|---|
| E2 — Guilherme | Educação Antirracista | **60,0** | OK / abaixo da média |
| E1 — Simões | IHC / Sistemas | **85,0** | Bom / próximo de excelente |
| E3 — Manoela | RA Educacional / Autoria | **87,5** | Excelente |
| **Média (3 especialistas)** | | **77,5** | Acima da média |
| Desvio padrão | | 15,2 | |
| *(referência) Piloto — Mariana* | Ciências Políticas | *95,0* | *Excelente* |

### Leitura inicial

- A média de 77,5 está **acima da média geral (68)**, mas a variância é alta
  (DP = 15,2) — isso por si só é um achado relevante: a percepção de
  usabilidade **não é uniforme entre perfis**.
- **Guilherme (60,0) destoa fortemente** dos outros dois. Isso é coerente com
  os relatos da sessão dele: maior tempo gasto em T3 (personalização do
  avatar), confusão maior no fluxo de cena/história em T7, e travamento no AR
  de superfície em T9. Importante não confundir isso com "o produto não
  funciona para professores de humanas" — pode ser também menor familiaridade
  prévia com interfaces 3D/AR, que é exatamente o público que o ContAR
  pretende atender. Vale comentar essa tensão na discussão do artigo.
- **Simões e Manoela convergem** em score alto (85 e 87,5), apesar de
  relatarem bugs reais e pontos de confusão pontuais — reforça o padrão já
  observado no piloto: SUS alto não significa ausência de fricções
  específicas, significa percepção geral favorável.

---

## 2. Achados por Tarefa (consolidado das 3 sessões)

### T1 — Criar conta
Sem registros relevantes nas 3 sessões (tarefa tranquila para todos).

### T2 — Criar história
- **[Manoela]** Não conseguiu editar a descrição da história depois de
  criada.
- **[Manoela]** Pulou o tour 2 vezes.
- **[Simões]** Sugeriu ter um link de "Home" no início do menu.
- **[Simões]** Placeholders dos campos pouco indicativos do que digitar.

### T3 — Criar avatar
- **[Guilherme]** Levou muito tempo nesta etapa.
- **[Guilherme]** Não personalizou bem o próprio avatar — possível efeito de
  alguma mensagem/instrução anterior que influenciou negativamente a decisão
  (investigar qual texto pode estar gerando essa impressão).
- **[Guilherme]** Pediu correção de cor, cabelo e roupa (mesma linha do
  piloto — recorrente).
- **[Manoela]** Interface do Avaturn em inglês — heurística de
  correspondência com o idioma do usuário.
- **[Manoela]** "Next" do Avaturn muito lento.
- **[Manoela]** Pouca variedade de roupas; **avatares de pessoas grávidas
  ausentes** (novo ponto de representatividade, não capturado no piloto).
- **[Simões]** Login com conta Google como fricção (mesmo ponto do piloto —
  **recorrente em 2 das 4 sessões**, prioridade alta).
- **[Simões]** Testou em smartphone pela primeira vez — atrito adicional de
  mobile.
- **[Simões]** Conseguiu entender bem a personalização; mas **reclamou da
  dificuldade de obter tons de pele não-negros corretos** — interessante: é o
  inverso do problema de representatividade que vínhamos mapeando (cabelo
  cacheado/pele negra ausentes no piloto); aqui é sobre a granularidade geral
  da paleta de cores de pele do Avaturn.

> **pjorge:** considerar adicionar um slide/tela explicativa antes de o
> usuário entrar no widget externo do Avaturn, contextualizando o que vai
> acontecer ali (sugestão da Manoela).

### T4 — Configurar pose e fala
- **[Manoela]** Termos de posição (X/Y/Z) em inglês.
- **[Manoela]** Animação "correndo" do avatar ficou desengonçada/bugada
  visualmente.
- **[Manoela]** Pose "narrador" (speaker) animada não correspondeu à
  expectativa do usuário.
- **[Manoela]** Poses estáticas, em geral, ficaram diferentes do que o nome
  sugeria.
- **[Manoela]** Sugeriu tooltip explicando o que é GLB/VRM para quem for
  fazer upload direto.
- **[Simões]** Avatar não persistiu entre cenas — ao trocar de cena, carregou
  o avatar antigo em vez do novo (**bug, não só percepção** — confirmado
  também na sessão do Guilherme em T8).
- **[Simões]** Pediu para poder reabrir o editor de avatar depois da primeira
  criação (hoje parece ser possível só configurar uma vez).
- **[Simões]** Poses/fundos do próprio Avaturn não combinam com as poses
  disponíveis na cena do ContAR — gerou frustração.
- **[Simões]** P1 positivo: achou intuitivo e se sentiu representado pelo
  resultado.

### T5 — Gerar voz com lip sync
- **[Manoela]** Sentiu necessidade de poder gravar o próprio áudio (já existe
  essa opção segundo o roteiro original — verificar se não estava visível ou
  acessível nessa sessão).
- **[Manoela]** "Sincronizar lábios" foi a etapa **menos intuitiva** do fluxo
  inteiro, segundo o relato.
- **[Manoela]** Voz de IA não pareceu natural — mas pondera que isso é em
  parte por já estar acostumada com vozes de IA mais avançadas (viés de
  expectativa elevada de usuário experiente).
- **[Guilherme]** Sessão "muito travada" aqui — não identificou bem onde
  estava o controle de lip sync.
- **[Guilherme]** Voz de máquina não pareceu natural; **escolheu a voz do
  navegador** em vez da síntese de IA (não testou a funcionalidade
  diferencial do produto).
- **[Simões]** **Timeline confundiu muito** — usuário não distinguiu bloco de
  ação do bloco de áudio.
- **[Simões]** Sugeriu remover as posições estáticas (ou simplificar).
- **[Simões]** "Escala relativa" / configurações avançadas / posição em
  círculo não estavam alterando corretamente X, Y, Z.
- **[Simões]** Observação de produto: em 2 minutos já conseguiu ver tudo que
  a ferramenta permite fazer — percepção positiva de eficiência de
  descoberta.
- **[Simões]** Avatar "parado" continuou girando indefinidamente mesmo após
  a animação devida terminar (**bug confirmado, mencionado 2x na sessão
  dele** — ver também item geral abaixo).

### T6 — Salvar cena
- **[Guilherme]** Tranquilo, conseguiu compreender bem.
- Sem registros relevantes para Simões e Manoela (tarefa bem resolvida nas 3
  sessões).

### T7 — Montar história com múltiplas cenas
- **[Manoela]** "Texto de transição" não estava traduzido — e o usuário
  **confundiu esse campo com o texto de fala do personagem**, editando o
  campo errado.
- **[Manoela] — ponto crítico (pjorge):** ficou perdida sobre se, ao
  adicionar uma cena à história, ela já passava a editar essa nova cena ou
  continuava editando a primeira. **Esse é exatamente o problema do "conceito
  de cena ativa" que já tínhamos mapeado — confirmado pela 3ª pessoa
  diferente.**
- **[Manoela]** Ao adicionar cena "por baixo" (no painel inferior?), o editor
  não troca automaticamente para editar essa cena nova — o usuário precisa
  clicar em "adicionar à história" de novo, e se perde nesse processo.
- **[Manoela]** Confusão grande entre "gerar TTS" e "gerar voz" — parecem ser
  apresentados como conceitos distintos quando talvez devessem ser unificados
  ou diferenciados mais claramente na UI.
- **[Manoela]** Título da cena não muda visualmente depois de salvo (possível
  bug de re-render do estado).
- **[Simões]** Ao adicionar a mesma cena à história, ficou confuso se a ação
  era "adicionar" ou "duplicar" — investigar comportamento de "adicionar cena
  de baixo" vs. "de cima".
- **[Simões]** Sugeriu gravar um vídeo de explicação de cada etapa.
- **[Simões]** Conseguiu, ainda assim, **criar uma história com mais de 4
  cenas** — sinal de que, apesar da confusão inicial, o fluxo é navegável
  até o fim.
- **[Guilherme]** Travou — não entendeu de primeira como criar a segunda
  cena, mas conseguiu evoluir.
- **[Guilherme]** **Não conseguiu adicionar a segunda cena à história** (ponto
  crítico — ele criou a cena mas ela não chegou a entrar na história).

> **pjorge (decisão de design importante):** trocar o conceito atual —
> já que o salvamento de cena é automático, "Salvar cena" deveria ser
> renomeado/refeito para já significar "Adicionar à história", eliminando a
> etapa redundante que está confundindo os três especialistas.

### T8 — Visualizar a história
- **[Manoela]** Escala do preview de visualização está bugada.
- **[Manoela]** Botão "atualizar" em inglês.
- **[Manoela]** Áudio da cena 1 funcionou, mas o **áudio da cena 2 não tocou**
  — usuário não percebeu que a transição de cena acontece automaticamente
  (possível relação com o bug de avatar/cena não persistindo — ver T4 e nota
  geral do Simões).
- **[Manoela]** Controles de seta do mouse não funcionaram na navegação da
  visualização.
- **[Simões]** Precisou sair da visualização para conseguir ver tudo no
  editor direto (intencional pelo usuário, mas indica que o player não
  estava suficiente).
- **[Simões]** **Avatar da segunda cena bugou — não carregou/persistiu a
  partir da cena anterior** (mesmo bug relatado em T4, agora confirmado
  também na visualização final).
- **[Guilherme]** Precisou voltar para o início para conseguir ver as duas
  cenas tocando junto de forma automática — relacionado ao mesmo bug
  (provavelmente nenhum avatar configurado corretamente na segunda cena, ou
  a segunda cena de fato não foi salva/adicionada à história, conforme já
  relatado em T7).
- **[Guilherme]** Botão de "editar" (voltar para editar a primeira cena
  clicando na caixa toda) não ficou claro.

### T9 — Abrir em AR
- **[Manoela]** Áudios das cenas precisam ser verificados de forma geral
  (reforça o bug de T8).
- **[Manoela]** A história, por não ter muita relação espacial com o
  ambiente, não agregou muito quando vista em AR de superfície.
- **[Manoela]** Sugestão: quando aplicado a um cenário específico, a
  experiência muda bastante — vale comunicar isso de forma mais clara, e
  pensar em envolver objetos físicos/do ambiente na narrativa.
- **[Simões]** Dificuldade no AR de superfície — círculo de ancoragem aparece
  mas o personagem não aparece (**bug visual confirmado, ele chama de "bug da
  pinça"**).
- **[Simões]** Botão "Iniciar AR" aparecendo duplicado nos modos de exibição.
- **[Guilherme]** Travou no AR de superfície.
- **[Guilherme]** Padrão visual do "visualizar" foi repetido também no modo
  AR imersivo — não conseguiu identificar o chão no Android (não sabe dizer
  se foi por falha de carregamento ou de UI).

### T10 — Compartilhamento / encerramento
- **[Simões]** Pediu mais clareza na parte de compartilhamento — botões "ver
  no celular" / "ver no computador" estão misturados, sem indicação clara de
  que dá para usar no celular.

> **pjorge:** adicionar QR code direto na tela de escolha de marcadores, para
> facilitar abrir no celular sem precisar digitar/copiar link.

---

## 3. Bugs confirmados (recorrência ≥ 2 sessões — alta confiança)

| Bug | Sessões onde apareceu | Severidade sugerida |
|---|---|---|
| **Avatar não persiste/recarrega visualmente entre cenas ou após reload** (dado real está salvo, problema é de re-render do frontend) | Simões (T4, T8, resolve com F5) + Guilherme (T7, T8) + **Manoela confirma com transcrição: "ele não carregou, mas ele salvou"** | **4 — catastrófico** (confirmado por 3 especialistas, causa raiz convergente) |
| **Login/autenticação Google lenta ou redundante** | Piloto (Mariana) + Simões (T3) | 3 — maior |
| **Avatar "parado" continua girando indefinidamente** | Simões (T5, mencionado 2x, hipótese técnica: falha ao resetar transform/loop) | 2 — menor (mas distrai) |
| **Confusão entre "salvar cena" e "adicionar à história"** | Piloto + Manoela (T7, **detalhado extensamente na transcrição, inclusive intervenção do pesquisador**) + Guilherme (T7) + Simões (achou que duplicava) | **4 — catastrófico** (confirmado nas 4 sessões/piloto) |
| **Tour reaparece mesmo após "pular"** | Piloto (sugestão de desativar) + **Manoela confirma bug real: pulou e reapareceu em outra tela, "tive que pular duas vezes"** | 3 — maior (não é só falta de feature, é bug de estado) |
| **Áudio de cenas subsequentes não toca** | Manoela (T8, **causa raiz identificada por ela mesma: esqueceu de gerar voz antes de salvar 2 das 4 cenas**) + Simões (relato similar) | 3 — maior, mas **parcialmente erro de usuário induzido por falta de validação/aviso, não só bug** |
| **AR de superfície/ancorado: avatar não aparece ou "anda junto" com o celular** | Simões ("bug da pinça") + Guilherme (não identifica o chão) | **4 — catastrófico** (bloqueia a tarefa) |
| **AR Marker permite tentar abrir mesmo sem marcador gerado** | Manoela (intervenção do pesquisador necessária para evitar a tentativa) | 3 — maior (falta de validação/aviso) |
| **Termos de interface em inglês** (posição X/Y/Z, "update"/"publish", interface do Avaturn, instruções de foto do Avaturn) | Manoela (T2, T3, T4, T8 — **mais detalhada, pondera sobre público típico não falar inglês**) + Guilherme (geral) | 2 — menor, mas recorrente em 2 de 3 especialistas |
| **Título da cena não atualiza visualmente (mostra ID/código em vez do nome)** | Manoela (confirmado com detalhe: "como se fosse um códigozinho") | 3 — maior |
| **Poses se acumulando/não resetando corretamente ao trocar** | Simões (hipótese técnica: transform não retorna a zero entre poses) | 3 — maior |
| **Poses estáticas não correspondem visualmente ao nome** (continência, mão na cintura) | Simões + **Manoela confirma os mesmos dois exemplos específicos** ("continência, mão na cintura e outras") | 3 — maior (confirmado por 2 especialistas com exemplos idênticos) |
| **Controles de navegação (setas/teclado) não funcionam no player de história** | Manoela (T8: tentou mouse e teclado, sem sucesso) | 3 — maior |

---

## 4. Pontos de representatividade (relevantes para a seção antirracista do artigo)

- Pouca variedade de cabelos cacheados femininos (piloto + Manoela).
- Texturas de cabelo com bug visual (piloto).
- Pouca variedade de roupas/sapatos/óculos/acessórios (piloto + Manoela:
  procurou uma roupa "discreta" adequada para narrar a Chapeuzinho Vermelho
  e achou as opções limitadas).
- **Ausência de avatares de pessoas grávidas — agora com citação direta e
  contexto completo**: Manoela mencionou estar grávida durante a sessão e,
  ao tentar customizar o corpo do avatar, só havia opção "mais gordinho" ou
  "mais magrinho" — nenhuma opção de gestação. Optou pelo corpo magro e
  comentou: *"eu tô mais cheinha [...] a representação tá mais ou menos."*
  Esse achado **amplia a pauta de representatividade do artigo para além do
  eixo racial**, incluindo também a dimensão corporal/gestacional —
  relevante para a discussão sobre os limites do catálogo de customização
  de terceiros (Avaturn) e para argumentar que a "representatividade" como
  princípio de design do ContAR precisa ser pensada de forma interseccional,
  não apenas racial.
- Dificuldade de obter tons de pele **não-negros** de forma satisfatória
  (Simões) — acrescenta nuance importante: a limitação de granularidade de
  tom de pele do Avaturn parece afetar múltiplas faixas, não só peles
  escuras.
- Avatar final frequentemente não se parece com o usuário (piloto:
  "diminuiu minha autoestima"; Guilherme: não personalizou bem o próprio
  avatar, possivelmente por influência de alguma mensagem da interface;
  Manoela: representação corporal "mais ou menos").

> Esse bloco é especialmente valioso para a seção 4 do artigo (ContAR e
> Educação Antirracista) — evidencia, com dados reais de avaliação, a lacuna
> que motivou o design da plataforma, mas também mostra que a *implementação
> atual* ainda não resolve completamente essa lacuna — ponto importante para
> a seção de limitações. **Sugestão para o artigo:** considerar renomear ou
> ampliar o enquadramento dessa seção de "representatividade racial" para
> "representatividade e diversidade corporal/identitária", já que agora há
> evidência de pelo menos duas dimensões distintas (raça e gestação/corpo)
> limitadas pelo catálogo do Avaturn.

---

## 5. Decisões de design pendentes (marcadas "pjorge")

1. Tela desktop ficando muito pequena (Manoela) — investigar responsividade
   em telas grandes/wide.
2. Adicionar slide explicativo antes de o usuário ir para o widget do
   Avaturn, contextualizando cada etapa do serviço externo (Manoela).
3. Repensar o conceito "Salvar cena" → unificar com "Adicionar à história",
   já que o salvamento já é automático (ponto crítico, recorrente em 3
   sessões).
4. Adicionar QR code direto na tela de escolha de marcadores AR (Simões).
5. *(carregados de conversas anteriores, ainda pendentes)*: login Google sem
   reautenticação; permitir upload de foto em vez de captura na hora; avaliar
   ocultar/ajustar controles de expressão facial (Avaturn atual não
   suporta); título da cena posicionado à esquerda.

---

## 6. Observações qualitativas de maior valor para o artigo

- **Simões**, sobre a experiência geral: "não é perfeito, mas é bem melhor
  que não ter [a ferramenta]" — frase forte para citar na discussão,
  evidenciando viabilidade mesmo com limitações.
- **Simões** destacou que em **2 minutos já conseguiu enxergar todo o
  potencial** da ferramenta — ponto positivo de eficiência de descoberta
  (heurística H7).
- **Manoela**, sobre o conceito de história: "fez sentido criar dessa forma
  a narrativa, mas muita confusão em algumas etapas" — equilíbrio entre
  validação do modelo conceitual e necessidade de refinamento de interface.
- **Guilherme**, mesmo com o SUS mais baixo, conseguiu evoluir e concluir o
  fluxo principal — sugere que a curva de aprendizado é maior para esse
  perfil, mas não impeditiva.

---

## 7. Citações verbatim selecionadas (uso direto no artigo, com tradução/contexto)

> Lembrete de compliance: ao citar no artigo, manter cada citação **abaixo de
> 15 palavras** e usar **no máximo uma citação por fonte/seção**, conforme as
> regras de direitos autorais já aplicadas no documento principal. As frases
> abaixo já estão cortadas para caber nesse limite quando possível — revisar
> antes de inserir.

- **Simões, sobre viabilidade geral do produto:** "não é perfeito, mas é bem
  melhor que não ter" — *(já catalogada anteriormente)*
- **Simões, sobre representatividade de pele, mesmo após correção:** "o
  limite da ferramenta ainda é o moreno"
- **Simões, sobre o estágio de maturidade do uso de AR:** "muito mais
  oba-oba da tecnologia do que [...] sentido"
- **Guilherme, sobre o avatar:** "foi intuitivo, mas a representação
  nenhuma" — frase muito direta e citável, captura a tensão central da
  pesquisa (usabilidade alta, representatividade baixa) em poucas palavras.
- **Guilherme, sobre o valor pedagógico do AR:** "utilizaria isso para
  dinamizar processos educativos"
- **Guilherme, ponderando sobre como o bug pode ser mal-atribuído pelo
  usuário:** "quem está utilizando pode achar que o problema é da pessoa
  [...] não do sistema" — ótima observação meta-metodológica sobre como
  bugs técnicos podem ser confundidos com incapacidade percebida do próprio
  usuário, especialmente relevante para usuários não-técnicos (professores).
- **Manoela, sobre representação corporal/gestacional:** "eu tô mais
  cheinha [...] a representação tá mais ou menos" — amplia a discussão de
  representatividade para além do eixo racial.
- **Manoela, sobre o fluxo de cena/história (o achado mais citável dela):**
  "ficou menos intuitivo que as demais" — referindo-se especificamente à
  etapa de sincronização labial, mas serve também como síntese do problema
  mais amplo de fluxo.
- **Manoela, sobre seu próprio erro de fluxo, revelando causa raiz:** "sabe
  que eu não gerei a fala dele? Eu lembro de ter clicado em todos" —
  evidência direta de como a ausência de validação no salvamento de cena
  gera erro silencioso.
- **Manoela, avaliação geral da experiência de criar avatar:** "eu achei
  bem intuitivo [...] nem precisaria tanta orientação" — contraponto
  importante: ela é a especialista mais experiente em ferramentas de
  autoria e ainda assim considerou essa etapa específica positiva, mesmo
  com as críticas pontuais sobre idioma e variedade de customização.

---

## 8. Pendências

- [x] Revisar a análise por IA/transcrição das gravações de Guilherme e
  Francisco (Simões) — feito.
- [x] **Obter a transcrição correta da sessão da Manoela** — recebida e
  analisada nesta atualização.
- [ ] Confirmar com cada especialista, se necessário, pontos ambíguos das
  anotações manuscritas (ex.: "t9 p1: enquanto gerador, nada" — Simões, não
  ficou claro o que essa nota significa — não esclarecido pela transcrição
  também).
- [ ] Mapear quais bugs da tabela da seção 3 serão corrigidos antes da
  publicação do artigo e quais ficarão documentados como limitações
  conhecidas.
- [ ] Decidir e registrar formalmente na metodologia do artigo o critério
  acordado com Simões sobre correção de bugs vs. melhorias de UX entre
  sessões (ver Seção 0).
- [ ] Avaliar se a participação parcial do Simões como observador durante a
  sessão do Guilherme deve ser mencionada como limitação metodológica.
- [ ] **Nova pendência metodológica importante:** registrar no artigo que,
  durante a sessão da Manoela, o protocolo Think Aloud puro foi quebrado em
  T7 — o pesquisador explicou ativamente o fluxo correto de cena/história
  antes de pedir uma segunda tentativa, em vez de apenas observar e
  perguntar. Isso significa que **o sucesso dela na segunda tentativa de T7
  não deve ser interpretado como "fluxo intuitivo sem assistência"** — é
  evidência de que explicação direta resolve a confusão, o que é diferente
  de dizer que a interface é autoexplicativa. Avaliar se isso compromete a
  comparabilidade desse trecho específico com as sessões de Simões e
  Guilherme (que não tiveram a mesma intervenção).
- [ ] Investigar tecnicamente a hipótese do Simões sobre acúmulo de
  transformações entre poses (possível bug no reset do AnimationMixer) —
  agora com confirmação adicional da Manoela sobre poses estáticas
  incorretas (continência, mão na cintura).
- [ ] Considerar implementar a proposta detalhada do Simões para a tela de
  compartilhamento (ver Seção 0) — já está praticamente pronta como
  especificação. Reforçada pelo relato da Manoela (precisou de solução
  manual via WhatsApp para conseguir testar no celular).
- [ ] **Nova pendência técnica:** avaliar adicionar validação/aviso ao
  salvar uma cena sem áudio gerado — a Manoela salvou 2 de 4 cenas sem
  perceber que não tinha clicado em "gerar voz", o que parcialmente
  reclassifica o bug de "áudio não funciona" como, em parte, ausência de
  validação de fluxo.
- [ ] **Nova pendência técnica:** avaliar desabilitar ou avisar quando o
  usuário tenta abrir o modo AR Marcador sem ter gerado um marcador para
  aquela história.
- [ ] **Nova pendência de design:** avaliar adicionar opção de avatar
  gestante/com mais variação corporal no catálogo — ponto levantado
  espontaneamente pela Manoela e relevante para ampliar a discussão de
  representatividade do artigo além do eixo racial.

---

## Limitações técnicas do SDK (sem fix possível)

Itens identificados durante o walkthrough que **não podem** ser corrigidos na
plataforma ContAR por dependerem de APIs/funcionalidades não expostas pelo SDK
Avaturn (`@avaturn/sdk` v1.1.4):

| ID   | Problema | Causa raiz |
|------|----------|------------|
| P2.4 | Botão "Next" do Avaturn permite avançar sem explorar todas as categorias | SDK não expõe eventos de mudança de etapa nem API para travar navegação interna |
| P3.1 | Interface do Avaturn sempre em inglês, mesmo com ContAR em português | SDK não aceita parâmetro de idioma (`locale`, `language`) |

