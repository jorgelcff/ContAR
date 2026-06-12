// Cria a história "ContAR: Como eu criei um narrador virtual do zero"
// (docs/tcc/HISTORIA_TCC.md) via API, usando docs/tcc/avatar_jorge.glb
// como avatar das 7 cenas.
//
// Uso:
//   TCC_EMAIL=voce@exemplo.com TCC_PASSWORD=suasenha node docs/tcc/seed-historia-tcc.mjs
//
// Variáveis de ambiente opcionais:
//   API_BASE_URL    - default: http://localhost:3001/api
//   TCC_VOICE_ID    - voz Azure TTS (default: pt-BR-FranciscaNeural)
//   TCC_SKIP_TTS    - "1" para pular a geração de áudio (cenas ficam sem narração)
//   TCC_AVATAR_PATH - caminho do .glb (default: docs/tcc/avatar_jorge.glb)
//   TCC_DISPLAY_MODE- modo de exibição da narração: 'subtitle' | 'bubble' | 'none'
//                     (default: subtitle — legível sobre a câmera no AR)

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3001/api').replace(/\/+$/, '');
const EMAIL = process.env.TCC_EMAIL;
const PASSWORD = process.env.TCC_PASSWORD;
const VOICE_ID = process.env.TCC_VOICE_ID || 'pt-BR-FranciscaNeural';
const SKIP_TTS = process.env.TCC_SKIP_TTS === '1';
const AVATAR_PATH = process.env.TCC_AVATAR_PATH || path.join(__dirname, 'avatar_jorge.glb');
const DISPLAY_MODE = process.env.TCC_DISPLAY_MODE || 'subtitle';

// Estimativa de duração da fala (~2.6 palavras/seg, ritmo de narração calmo).
// Usada como fallback de avanço da cena quando ela não tem áudio — com áudio,
// o player avança quando a narração termina, então o tempo "pega" sozinho.
function estimateDurationSeconds(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(5, Math.round(words / 2.6) + 1);
}

if (!EMAIL || !PASSWORD) {
  console.error('Defina TCC_EMAIL e TCC_PASSWORD (credenciais de uma conta já registrada no ContAR).');
  process.exit(1);
}

const STORY_METADATA = {
  title: 'ContAR: Como eu criei um narrador virtual do zero',
  description:
    'A história por trás do meu Trabalho de Conclusão de Curso — o que motivou, como funciona, e o que aprendi.',
  language: 'pt',
};

const SCENES = [
  {
    title: 'Cena 1 — Apresentação',
    posePreset: 'idle',
    text: 'Olá! Eu me chamo Jorge, sou estudante de Ciência da Computação no CIn da UFPE. E este narrador que você está vendo agora... é exatamente o que o meu TCC faz. Bem-vindo ao ContAR.',
  },
  {
    title: 'Cena 2 — O problema',
    posePreset: 'speaker',
    text: 'Criar um narrador virtual com fala e animação sempre exigiu programação, ferramentas caras ou conhecimento técnico avançado. Educadores, professores, criadores de conteúdo — quem mais precisaria disso — não tinham acesso. Eu queria mudar isso.',
  },
  {
    title: 'Cena 3 — A proposta',
    posePreset: 'speaker',
    text: 'A ideia do ContAR é simples: uma plataforma web onde qualquer pessoa consegue criar um personagem 3D que fala, animado e com lip sync, sem precisar escrever uma linha de código. Você escolhe o avatar, digita o texto, gera a voz, e publica — tudo no navegador.',
  },
  {
    title: 'Cena 4 — Como funciona',
    posePreset: 'walk_circle',
    text: 'Por dentro, o ContAR usa Three.js para renderizar o personagem em 3D, uma API de síntese de voz para gerar o áudio, e um sistema de retargeting que adapta qualquer animação Mixamo ao esqueleto do avatar. O resultado é o que você está vendo: um personagem animado, falando, em tempo real.',
  },
  {
    title: 'Cena 5 — A parte de AR',
    posePreset: 'idle',
    text: 'Mas tem mais. O ContAR também funciona em realidade aumentada. Você pode apontar a câmera do celular para um marcador impresso, ou posicionar o narrador diretamente no chão da sua sala. A história acontece no mundo real, sem precisar instalar nenhum aplicativo.',
  },
  {
    title: 'Cena 6 — O que aprendi',
    posePreset: 'speaker',
    text: 'Construir isso me ensinou muito além de código. Aprendi que tecnologia útil é aquela que some — que o usuário não precisa entender o que está por trás para criar algo com significado. O ContAR ainda tem muito a crescer, mas essa primeira versão já prova que o conceito funciona.',
  },
  {
    title: 'Cena 7 — Encerramento',
    posePreset: 'idle',
    text: 'Obrigado por assistir. Se quiser criar sua própria história com um narrador como este, acesse o link na descrição. O ContAR é gratuito, roda no navegador, e foi feito pensando em você.',
  },
];

const DEFAULT_TRANSFORM = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

let token = '';

async function api(pathname, { method = 'GET', body, isForm = false } = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  if (!isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE_URL}${pathname}`, {
    method,
    headers,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${pathname} -> ${res.status}: ${data?.error || JSON.stringify(data)}`);
  }
  return data;
}

async function login() {
  console.log(`Login em ${API_BASE_URL} como ${EMAIL}...`);
  const data = await api('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
  token = data.token;
  console.log('Login OK.');
}

async function uploadAvatar() {
  console.log(`Enviando avatar local: ${AVATAR_PATH}`);
  const buffer = await readFile(AVATAR_PATH);
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'model/gltf-binary' }), 'avatar_jorge.glb');
  const data = await api('/media/model', { method: 'POST', body: form, isForm: true });
  console.log(`Avatar disponível em: ${data.url}`);
  return data.url;
}

async function generateAndUploadAudio(text, index) {
  console.log(`  Gerando áudio (TTS) para a cena ${index + 1}...`);
  const tts = await api('/tts/generate', { method: 'POST', body: { text, voiceId: VOICE_ID } });
  const buffer = Buffer.from(tts.audioBase64, 'base64');

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'audio/mpeg' }), `cena-${index + 1}.mp3`);
  const data = await api('/media/audio', { method: 'POST', body: form, isForm: true });
  console.log(`  Áudio disponível em: ${data.url}`);
  return data.url;
}

async function createScene(scene, index, avatarUrl) {
  console.log(`Criando "${scene.title}"...`);

  let audioUrl = '';
  if (!SKIP_TTS) {
    try {
      audioUrl = await generateAndUploadAudio(scene.text, index);
    } catch (err) {
      console.warn(`  Aviso: falha ao gerar áudio (${err.message}). Cena ficará sem narração.`);
    }
  }

  const payload = {
    metadata: { title: scene.title, theme: '' },
    content: {
      avatar: {
        modelUrl: avatarUrl,
        posePreset: scene.posePreset,
        transform: DEFAULT_TRANSFORM,
      },
      narrative: {
        text: scene.text,
        audioUrl,
        displayMode: scene.displayMode || DISPLAY_MODE,
        bubbleStyle: { color: '#ffffff', fontSize: 14 },
      },
      timeline: { duration: estimateDurationSeconds(scene.text), blocks: [] },
    },
  };

  const data = await api('/scene', { method: 'POST', body: payload });
  console.log(`  -> sceneId: ${data.sceneId}`);
  return data.sceneId;
}

async function createStory(sceneIds) {
  console.log('Publicando a história...');
  const payload = {
    metadata: STORY_METADATA,
    scenes: sceneIds.map((sceneId, order) => ({
      sceneId,
      order,
      transitionText: '',
      durationSeconds: estimateDurationSeconds(SCENES[order].text),
    })),
  };
  const data = await api('/story', { method: 'POST', body: payload });
  console.log(`-> storyId: ${data.storyId} (${data.sceneCount} cenas)`);
  return data.storyId;
}

async function main() {
  await login();
  const avatarUrl = await uploadAvatar();

  const sceneIds = [];
  for (let i = 0; i < SCENES.length; i++) {
    sceneIds.push(await createScene(SCENES[i], i, avatarUrl));
  }

  const storyId = await createStory(sceneIds);

  console.log('\nPronto! História criada com sucesso.');
  console.log(`Modo de exibição da narração: ${DISPLAY_MODE}`);
  console.log(`Edite em: /editor (procure pelas cenas em /scenes)`);
  console.log(`Assista (local):     /story/${storyId}`);
  console.log(`Assista (produção):  https://avaturn-threejs-1.onrender.com/story/${storyId}`);
}

main().catch((err) => {
  console.error('\nErro:', err.message);
  process.exit(1);
});
