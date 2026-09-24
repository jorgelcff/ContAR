# ContAR — Guia de marca

Cores, tipografia e uso do logo da marca ContAR.

## Status: a marca ainda não está no produto

Vale abrir com isto, porque muda como o resto se lê.

Nenhuma cor desta paleta aparece em `frontend/src/`. As fontes não são carregadas.
Os ícones da marca já estão ligados: `index.html` carrega os arquivos de
`frontend/public/logo/`, e o favicon roxo antigo foi removido. Isso é a casca —
a interface por dentro continua sem a marca.

O que a interface usa hoje é um sistema separado, documentado no topo de
[`frontend/src/index.css`](frontend/src/index.css): ciano como cor primária,
cinza para neutros, mais vermelho, âmbar e esmeralda para estado. Esse sistema
está implementado, tem remapeamento de tema claro e é verificado por testes de
contraste no `e2e/contrast-axe.spec.js`.

Então: **`index.css` descreve o que existe; este arquivo descreve o que se quer.**
Enquanto os dois coexistirem, nenhum é "fonte única de verdade" — e dizer que é
só faz alguém confiar no documento errado. A seção [Como adotar](#como-adotar)
descreve o caminho de um para o outro.

## Logo

Arquivos em `frontend/public/logo/`:

| Arquivo | Uso |
|---|---|
| `contar-logo.svg` | Símbolo + "ContAR", para fundo claro |
| `contar-logo-negativo.svg` | Símbolo + "ContAR", para fundo escuro |
| `contar-simbolo.svg` / `contar-simbolo-negativo.svg` | Só o símbolo — avatar, botões, espaços pequenos |
| `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `manifest.webmanifest` | Ícones de aplicação — não usar na interface |

Os SVGs trazem a paleta embutida (`#1B1A2E` + `#C8472B`), não `currentColor`:
recolorir por CSS não funciona, o que é coerente com a regra abaixo.

Regras:

- Não recolorir, esticar, rotacionar nem aplicar sombra ou gradiente.
- Em fundo escuro, usar sempre a versão `-negativo`.
- Altura mínima: 24 px para o logo completo, 16 px para o símbolo.
- Margem livre ao redor: pelo menos a largura do ponto do símbolo.
- No wordmark, "AR" é sempre urucum; "Cont" acompanha a cor do texto.

## Cores

| Nome | Hex | Papel |
|---|---|---|
| Urucum | `#C8472B` | Cor da marca: fundo de botão primário, destaques, o "AR" |
| Urucum escuro | `#A63A22` | Texto e links em urucum sobre fundo claro |
| Urucum claro | `#E8735A` | Texto e links em urucum sobre fundo escuro |
| Nanquim | `#1B1A2E` | Fundo no escuro; texto principal no claro |
| Marfim | `#F7F1E6` | Texto principal no escuro; fundo no claro |
| Ocre | `#D08A1E` | Apoio: avisos e realces secundários |
| Mata | `#2F6B4F` | Apoio: sucesso e confirmação |

### Contraste medido

Calculado pela fórmula da WCAG 2, não estimado. O alvo é 4.5:1 para texto normal.

| Combinação | Ratio | |
|---|---:|---|
| Nanquim sobre marfim / marfim sobre nanquim | 15.14 | ✅ |
| Urucum escuro `#A63A22` sobre marfim | 5.75 | ✅ |
| Urucum escuro `#A63A22` sobre branco | 6.46 | ✅ |
| Urucum claro `#E8735A` sobre nanquim | 5.70 | ✅ |
| Urucum claro `#E8735A` sobre superfície escura `#25243A` | 5.05 | ✅ |
| Branco sobre urucum `#C8472B` | 4.78 | ✅ |
| Texto suave `#5E584C` sobre marfim | 6.28 | ✅ |
| Texto suave `#B9B2A4` sobre nanquim | 8.08 | ✅ |
| Mata `#2F6B4F` sobre marfim | 5.60 | ✅ |
| Mata claro `#5FA883` sobre superfície escura | 5.33 | ✅ |
| Ocre `#D08A1E` sobre nanquim | 5.95 | ✅ |
| **Ocre `#D08A1E` sobre marfim** | **2.55** | ❌ |

O urucum puro `#C8472B` passa como **fundo** (4.78 com texto branco), mas não como
texto sobre marfim. Por isso existem as variantes escura e clara — elas não são
enfeite, são o que torna a marca utilizável em texto.

O ocre falha em fundo claro por larga margem. Só como fundo, ou como texto em
fundo escuro.

### Bordas

`#DDD3C2` sobre marfim mede 1.32, e `#3A3950` sobre nanquim mede 1.52 — ambos
abaixo dos 3:1 que a WCAG pede de componentes de interface.

Isso é aceitável para divisórias decorativas, e **não é** para uma borda que seja
a única indicação de onde termina um campo de formulário. Onde a borda carrega
essa informação, escureça-a (claro) ou clareie-a (escuro) até 3:1, ou acrescente
outro sinal — fundo próprio, rótulo, ícone.

## Erro

A regra anterior aqui era "usar um vermelho de erro distinto do urucum, para não
confundir marca com falha". **Isso não é alcançável por cor.** O urucum fica no
matiz 11°; medidos, todos os vermelhos de erro plausíveis caem entre 358° e 4° —
no máximo ~13° de distância. Vermelho é vermelho.

A regra correta é a mesma que a WCAG 1.4.1 já exige: **erro nunca é sinalizado só
por cor.** Toda mensagem de erro leva ícone e texto; o vermelho reforça, não
informa. Assim a proximidade com a marca deixa de importar.

Para quando um vermelho for necessário:

| Contexto | Hex | Medido |
|---|---|---|
| Fundo claro | `#B3261E` | 5.81 sobre marfim · 6.54 sobre branco |
| Fundo escuro | `#FF6369` | 5.87 sobre nanquim · 5.20 sobre superfície escura |

## Tipografia

- **Títulos e marca:** Bricolage Grotesque — 800 em títulos grandes, 500 em
  subtítulos, `letter-spacing: -0.02em` nos títulos.
- **Interface e texto:** DM Sans — pesos 400, 500 e 700.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
```

Ambas vêm do Google Fonts, o que adiciona uma dependência externa ao primeiro
carregamento — relevante para quem escaneia um QR code no wifi de um evento.
Se isso pesar, hospede os arquivos junto com o app.

## Tokens CSS

```css
:root {
  /* Paleta */
  --contar-urucum: #C8472B;
  --contar-urucum-escuro: #A63A22;
  --contar-urucum-claro: #E8735A;
  --contar-nanquim: #1B1A2E;
  --contar-marfim: #F7F1E6;
  --contar-ocre: #D08A1E;
  --contar-mata: #2F6B4F;

  /* Tipografia */
  --font-display: 'Bricolage Grotesque', Georgia, serif;
  --font-body: 'DM Sans', system-ui, sans-serif;

  /* Semânticas — escuro é o padrão, como no app hoje */
  color-scheme: dark;
  --color-bg: var(--contar-nanquim);
  --color-surface: #25243A;
  --color-border: #3A3950;
  --color-text: var(--contar-marfim);
  --color-text-muted: #B9B2A4;
  --color-primary: var(--contar-urucum);
  --color-on-primary: #FFFFFF;
  --color-link: var(--contar-urucum-claro);
  --color-success: #5FA883;
  --color-warning: var(--contar-ocre);
  --color-danger: #FF6369;
}

html[data-theme='light'] {
  color-scheme: light;
  --color-bg: var(--contar-marfim);
  --color-surface: #FFFFFF;
  --color-border: #DDD3C2;
  --color-text: var(--contar-nanquim);
  --color-text-muted: #5E584C;
  --color-link: var(--contar-urucum-escuro);
  --color-success: var(--contar-mata);
  --color-danger: #B3261E;
}
```

Duas coisas a notar:

O **escuro é o padrão e o claro é a exceção**, com o seletor `html[data-theme='light']`.
Isso não é preferência — é o que `index.css` faz hoje. A versão anterior deste guia
propunha o contrário (claro no `:root`, escuro em `[data-theme="dark"]`), e adotá-la
literalmente inverteria o tema do app inteiro.

Componentes usam só as variáveis **semânticas** (`--color-bg`, `--color-primary`…).
As de paleta (`--contar-*`) existem para as semânticas referenciarem, e não devem
aparecer em componente nenhum — é o que permite trocar um tom da marca em um lugar só.

## Como adotar

Hoje há dois sistemas. Enquanto estiverem lado a lado, quem lê não sabe qual vale.
Na ordem, do mais barato ao mais caro:

1. ~~**Ligar os ícones.**~~ Feito. `index.html` carrega o SVG, o `.ico`, o
   `apple-touch-icon`, o manifest e `theme-color`. O Vite reescreve esses
   caminhos com a base configurada, então funcionam sob subcaminho.
2. ~~**Apagar o favicon antigo.**~~ Feito — `public/favicon.svg` não existe
   mais, e nada o referenciava.
3. **Carregar as fontes** e aplicá-las a `body` e títulos.
4. **Trocar a paleta.** O caminho mais curto não é reescrever componentes: é
   remapear no `index.css`, no mesmo lugar onde o tema claro já sobrescreve os
   tokens do Tailwind — apontar a família `cyan` para o urucum e os neutros para
   nanquim/marfim. Assim a marca entra sem tocar em nenhum arquivo de componente.
5. **Rodar `npx playwright test e2e/contrast-axe.spec.js`.** Ele audita WCAG AA
   completo em todas as páginas, nos dois temas. Uma troca de paleta é exatamente
   o tipo de mudança que quebra contraste em lugares que ninguém pensou em olhar.

Quando o passo 4 terminar, este arquivo passa a descrever o que existe, e a
seção de status no topo pode sair.
