const sdk = require('microsoft-cognitiveservices-speech-sdk');

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_DEFAULT_VOICE = '21m00Tcm4TlvDq8ikWAM'; // Rachel

// Azure viseme ID → Rhubarb mouth shape
// https://learn.microsoft.com/azure/ai-services/speech-service/how-to-speech-synthesis-viseme
const AZURE_VISEME_TO_RHUBARB = {
  0: 'X',  // silence
  1: 'A',  // æ ə ʌ
  2: 'A',  // ɑ
  3: 'E',  // ɔ
  4: 'C',  // ɛ ʊ
  5: 'C',  // ɝ
  6: 'C',  // j i ɪ
  7: 'F',  // w u
  8: 'E',  // o
  9: 'A',  // aʊ
  10: 'E', // ɔɪ
  11: 'A', // aɪ
  12: 'X', // h
  13: 'D', // ɹ
  14: 'D', // l
  15: 'H', // s z
  16: 'H', // ʃ ʧ ʤ ʒ
  17: 'G', // ð
  18: 'G', // f v
  19: 'D', // d t n
  20: 'A', // k g ŋ
  21: 'B', // p b m
};

async function synthesizeWithAzure(text, voiceName) {
  const key    = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) throw new Error('AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set');

  const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
  speechConfig.speechSynthesisVoiceName    = voiceName || 'pt-BR-FranciscaNeural';
  speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

  // null audio config = capture to memory (no speaker)
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);

  const rawVisemes = [];
  synthesizer.visemeReceived = (_s, e) => {
    rawVisemes.push({ offsetMs: e.audioOffset / 10_000, visemeId: e.visemeId });
  };

  return new Promise((resolve, reject) => {
    synthesizer.speakTextAsync(
      text,
      (result) => {
        synthesizer.close();
        if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
          return reject(new Error(result.errorDetails || 'Azure synthesis failed'));
        }

        const audioBase64 = Buffer.from(result.audioData).toString('base64');

        // Build { start, end, value } timeline from Azure viseme events
        const visemeTimeline = rawVisemes.map((v, i) => {
          const start = v.offsetMs / 1000;
          const end   = i < rawVisemes.length - 1
            ? rawVisemes[i + 1].offsetMs / 1000
            : start + 0.08;
          return { start, end, value: AZURE_VISEME_TO_RHUBARB[v.visemeId] ?? 'X' };
        }).filter((v) => v.end > v.start);

        resolve({ audioBase64, visemeTimeline });
      },
      (err) => {
        synthesizer.close();
        reject(new Error(String(err)));
      }
    );
  });
}

async function synthesizeWithElevenLabs(text, voiceId) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set');

  const voice = String(voiceId || process.env.ELEVENLABS_VOICE_ID || ELEVENLABS_DEFAULT_VOICE).trim();

  const upstream = await fetch(
    `${ELEVENLABS_API_BASE}/text-to-speech/${voice}/with-timestamps`,
    {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );

  if (!upstream.ok) {
    const detail = await upstream.json().catch(() => ({}));
    throw new Error(detail?.detail?.message || detail?.message || `ElevenLabs error ${upstream.status}`);
  }

  const data = await upstream.json();

  // Convert ElevenLabs character alignment to { start, end, value } timeline
  const { characters = [], character_start_times_seconds = [], character_end_times_seconds = [] } =
    data.alignment || {};

  const CHAR_TO_RHUBARB = (ch, next) => {
    if (!ch) return null;
    if (/\s|[,.!?;:]/.test(ch)) return 'X';
    if (/[ae]/i.test(ch)) return 'A';
    if (/[i]/i.test(ch)) return 'C';
    if (/[o]/i.test(ch)) return 'E';
    if (/[u]/i.test(ch)) return 'F';
    if (/[bmp]/i.test(ch)) return 'B';
    if (/[fv]/i.test(ch)) return 'G';
    if (/[tdnlr]/i.test(ch)) return 'D';
    if (/[szxj]/i.test(ch)) return 'H';
    return 'D';
  };

  const visemeTimeline = characters
    .map((ch, i) => {
      const start = character_start_times_seconds[i];
      const end   = character_end_times_seconds[i];
      const value = CHAR_TO_RHUBARB(ch, characters[i + 1] || '');
      if (!value || !Number.isFinite(start) || !Number.isFinite(end)) return null;
      return { start, end, value };
    })
    .filter(Boolean);

  return { audioBase64: data.audio_base64, visemeTimeline };
}

exports.generateTTS = async (req, res) => {
  const { text, voiceId, provider } = req.body;
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  const safeText = String(text).trim().slice(0, 2500);

  // Priority: Azure (free 500k/month) → ElevenLabs → 503
  const useAzure     = !!process.env.AZURE_SPEECH_KEY && provider !== 'elevenlabs';
  const useElevenLabs = !!process.env.ELEVENLABS_API_KEY;

  try {
    if (useAzure) {
      const result = await synthesizeWithAzure(safeText, voiceId);
      return res.json(result);
    }
    if (useElevenLabs) {
      const result = await synthesizeWithElevenLabs(safeText, voiceId);
      return res.json(result);
    }
    return res.status(503).json({ error: 'TTS not configured — set AZURE_SPEECH_KEY or ELEVENLABS_API_KEY' });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'TTS generation failed' });
    }
  }
};
