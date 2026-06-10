# ContAR — História do TCC

Historia para usar dentro da própria plataforma como demonstração.
Cada cena tem: título, pose sugerida, e o texto exato para digitar na aba Fala.

---

## Título da história

**"ContAR: Como eu criei um narrador virtual do zero"**

Descrição: A história por trás do meu Trabalho de Conclusão de Curso — o que motivou, como funciona, e o que aprendi.

---

## Cena 1 — Apresentação

**Pose:** `idle`

**Texto da fala:**
> Olá! Eu me chamo Jorge, sou estudante de Ciência da Computação no CIn da UFPE. E este narrador que você está vendo agora... é exatamente o que o meu TCC faz. Bem-vindo ao ContAR.

---

## Cena 2 — O problema

**Pose:** `speaker`

**Texto da fala:**
> Criar um narrador virtual com fala e animação sempre exigiu programação, ferramentas caras ou conhecimento técnico avançado. Educadores, professores, criadores de conteúdo — quem mais precisaria disso — não tinham acesso. Eu queria mudar isso.

---

## Cena 3 — A proposta

**Pose:** `speaker`

**Texto da fala:**
> A ideia do ContAR é simples: uma plataforma web onde qualquer pessoa consegue criar um personagem 3D que fala, animado e com lip sync, sem precisar escrever uma linha de código. Você escolhe o avatar, digita o texto, gera a voz, e publica — tudo no navegador.

---

## Cena 4 — Como funciona

**Pose:** `walk_circle`

**Texto da fala:**
> Por dentro, o ContAR usa Three.js para renderizar o personagem em 3D, uma API de síntese de voz para gerar o áudio, e um sistema de retargeting que adapta qualquer animação Mixamo ao esqueleto do avatar. O resultado é o que você está vendo: um personagem animado, falando, em tempo real.

---

## Cena 5 — A parte de AR

**Pose:** `idle`

**Texto da fala:**
> Mas tem mais. O ContAR também funciona em realidade aumentada. Você pode apontar a câmera do celular para um marcador impresso, ou posicionar o narrador diretamente no chão da sua sala. A história acontece no mundo real, sem precisar instalar nenhum aplicativo.

---

## Cena 6 — O que aprendi

**Pose:** `speaker`

**Texto da fala:**
> Construir isso me ensinou muito além de código. Aprendi que tecnologia útil é aquela que some — que o usuário não precisa entender o que está por trás para criar algo com significado. O ContAR ainda tem muito a crescer, mas essa primeira versão já prova que o conceito funciona.

---

## Cena 7 — Encerramento

**Pose:** `idle`

**Texto da fala:**
> Obrigado por assistir. Se quiser criar sua própria história com um narrador como este, acesse o link na descrição. O ContAR é gratuito, roda no navegador, e foi feito pensando em você.

---

## Como criar no ContAR (passo a passo por cena)

Cada cena é criada assim no editor:

1. Configure o avatar (pose, posição) e cole o texto na aba **Fala**
2. Gere o áudio na aba **Áudio** → **✨ Gerar fala com IA**
3. Dê um nome à cena na aba **Cena** (ex: "Cena 1 — Apresentação")
4. Clique em **+ Adicionar à história**
5. **Mude apenas o texto e a pose** para a próxima cena — o avatar pode ser o mesmo
6. Repita o passo 4 para cada cena

> Faça as mudanças para a próxima cena rapidamente (antes de 3 segundos) para evitar que o autosave grave conteúdo de transição na cena anterior.

## Notas de produção

- **Voz sugerida:** Francisca Neural (PT-BR) ou Antonio Neural (PT-BR) via Azure TTS
- **Duração estimada:** ~2 minutos no total
- **Ordem das cenas:** 1 → 2 → 3 → 4 → 5 → 6 → 7
- A Cena 4 usa `walk_circle` para dar sensação de movimento ao falar de tecnologia
- As cenas 2, 3 e 6 usam `speaker` porque o conteúdo é reflexivo e o modo gesticula naturalmente
- O mesmo avatar Avaturn pode ser usado em todas as 7 cenas — só mude texto, pose e áudio
