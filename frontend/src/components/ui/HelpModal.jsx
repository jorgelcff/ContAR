import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

// ── FAQ data ────────────────────────────────────────────────────────────────
const FAQ = [
  {
    section: 'Avatares',
    items: [
      {
        q: 'Como adiciono meu próprio avatar?',
        a: 'Clique em "Criar Avatar" na aba Avatar. O criador de avatares é gratuito — você pode criar um personagem do zero ou usar uma selfie para gerar um avatar parecido com você. Ao terminar, clique em "Exportar" e ele aparece automaticamente no editor.',
      },
      {
        q: 'Posso usar um arquivo GLB do meu computador?',
        a: 'Sim! Clique em "GLB / VRM" na aba Avatar e selecione o arquivo. Formatos aceitos: .glb e .vrm.',
      },
      {
        q: 'Por que o avatar aparece muito pequeno ou deslocado?',
        a: 'Na aba Avatar, clique em "Configurações avançadas" e ajuste os sliders de Escala e Posição. Arraste o slider de Escala para a direita para aumentar o tamanho.',
      },
    ],
  },
  {
    section: 'Voz e Fala',
    items: [
      {
        q: 'Como faço o avatar falar?',
        a: '1. Vá para a aba Fala\n2. Digite o texto no campo\n3. Clique em "Gerar Voz (TTS)"\n4. Aguarde alguns segundos\n5. Clique em Play para ouvir o personagem falar com lábios sincronizados.',
      },
      {
        q: 'O TTS funciona em português?',
        a: 'Sim! Basta digitar o texto em português. O sistema detecta o idioma automaticamente e gera a voz corretamente.',
      },
      {
        q: 'O que é Lip Sync?',
        a: 'Lip Sync é quando a boca do avatar se move sincronizada com a fala. O sistema analisa o áudio e anima os lábios automaticamente — você não precisa configurar nada.',
      },
      {
        q: 'Posso usar meu próprio arquivo de áudio?',
        a: 'Sim. No painel de Áudio (aba Fala), clique em "Carregar arquivo" e selecione um MP3, WAV ou OGG. O Lip Sync funciona com qualquer áudio.',
      },
      {
        q: 'Posso gravar minha própria voz?',
        a: 'Sim! No painel de Áudio, clique no botão de microfone. O browser vai pedir permissão — clique em "Permitir". Fale normalmente e clique em "Parar" quando terminar.',
      },
    ],
  },
  {
    section: 'Cenas e Histórias',
    items: [
      {
        q: 'Qual é a diferença entre Cena e História?',
        a: 'Uma Cena é um momento único: um avatar, uma fala, um cenário. Uma História é uma sequência de cenas — como capítulos de um livro ou slides de uma apresentação.',
      },
      {
        q: 'Como salvo minha cena?',
        a: 'Na aba Cena, dê um nome para a cena e clique em "Salvar Cena". Após salvar, o autosave passa a funcionar automaticamente: qualquer mudança é salva em 3 segundos.',
      },
      {
        q: 'Como compartilho minha história?',
        a: 'Na aba História, clique em "Salvar História". Um link aparece logo abaixo — clique em "Copiar link" e compartilhe com quem quiser. Não é necessário ter conta para assistir.',
      },
    ],
  },
  {
    section: 'Problemas Comuns',
    items: [
      {
        q: 'A voz não gerou, apareceu um erro.',
        a: 'Verifique sua conexão com a internet. Se o erro mencionar "TTS not configured", é um problema de configuração do servidor. Tente novamente em alguns instantes ou use um texto mais curto.',
      },
      {
        q: 'O Lip Sync não está funcionando.',
        a: 'Certifique-se de que o áudio está tocando (botão Play ativo). Verifique se o arquivo de áudio não está silencioso. Se persistir, recarregue a página e gere a voz novamente.',
      },
      {
        q: 'A página ficou lenta ou travou.',
        a: 'Feche outras abas do navegador. Em celular, use Chrome ou Safari atualizados. Avatares com muitos detalhes são mais pesados — tente um arquivo menor.',
      },
    ],
  },
];

// ── Guides data ─────────────────────────────────────────────────────────────
const GUIDES = [
  {
    title: 'Criar sua primeira cena (5 min)',
    steps: [
      'Na aba Avatar, clique em "Criar Avatar" e crie ou escolha um personagem.',
      'Na aba Fala, escreva o que o avatar vai dizer.',
      'Clique em "Gerar Voz (TTS)" e aguarde a voz ser criada.',
      'Clique em Play para ver o avatar falar.',
      'Na aba Cena, dê um nome e clique em "Salvar Cena".',
    ],
  },
  {
    title: 'Criar uma história com múltiplas cenas (15 min)',
    steps: [
      'Crie e salve a primeira cena (guia acima).',
      'Clique em "Adicionar cena atual à história" — a cena 1 fica registrada.',
      'Altere o texto, avatar ou pose para criar a segunda cena.',
      'Repita para quantas cenas quiser.',
      'Na aba História, clique em "Salvar História".',
      'Copie o link que aparece e compartilhe!',
    ],
  },
  {
    title: 'Gravar sua própria voz',
    steps: [
      'Na aba Fala, localize o painel de Áudio.',
      'Clique no botão de microfone.',
      'Permita o acesso ao microfone quando o browser pedir.',
      'Fale normalmente.',
      'Clique em "Parar Gravação" quando terminar.',
      'Clique em Play — o Lip Sync funciona com sua voz também!',
    ],
  },
  {
    title: 'Usar a Timeline',
    steps: [
      'Gere ou carregue um áudio.',
      'Na Timeline (barra na parte inferior), clique no "+" da trilha Áudio.',
      'Arraste o bloco para o tempo desejado.',
      'Adicione uma animação na trilha Ação no mesmo tempo.',
      'Blocos que ficam a menos de 0,25s um do outro fazem snap automático.',
      'Clique em Play para ver o resultado sincronizado.',
    ],
  },
];

// ── Sub-components ───────────────────────────────────────────────────────────
function AccordionItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-700/60 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left py-3 flex items-start justify-between gap-3 text-sm text-gray-200 hover:text-white transition-colors"
      >
        <span className="flex-1 leading-snug">{q}</span>
        <span className={`shrink-0 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <p className="pb-3 text-xs text-gray-400 leading-relaxed whitespace-pre-line">{a}</p>
      )}
    </div>
  );
}

function GuideCard({ guide }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 flex flex-col gap-3">
      <p className="font-semibold text-white text-sm">{guide.title}</p>
      <ol className="flex flex-col gap-2">
        {guide.steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-xs text-gray-300 leading-snug">
            <span className="shrink-0 w-5 h-5 rounded-full bg-cyan-700/60 text-cyan-300 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────
export default function HelpModal({ onClose }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('faq');

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-lg font-bold text-white">{t('helpCenterTitle')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none transition-colors">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 shrink-0 px-5">
          {[{ id: 'faq', label: 'Perguntas Frequentes' }, { id: 'guides', label: 'Como Fazer' }].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-2.5 mr-4 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'text-cyan-400 border-cyan-400' : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {tab === 'faq' && FAQ.map((section) => (
            <div key={section.section}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{section.section}</p>
              <div className="rounded-xl border border-gray-700 bg-gray-800/40 px-4">
                {section.items.map((item) => (
                  <AccordionItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          ))}

          {tab === 'guides' && (
            <div className="flex flex-col gap-4">
              {GUIDES.map((g) => <GuideCard key={g.title} guide={g} />)}
            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}
