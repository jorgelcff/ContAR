const sdk = require('microsoft-cognitiveservices-speech-sdk');

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

// Rejects if `promise` doesn't settle within `ms` — stops a hung Azure
// websocket from holding the request open until Render's gateway returns a 504.
function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Pulled out as pure functions (no Azure SDK, no network) so the event-array
// → timeline shape can be unit tested directly.

/** Builds the { start, end, value } lip-sync timeline from raw viseme events. */
function buildVisemeTimeline(rawVisemes) {
  return rawVisemes.map((v, i) => {
    const start = v.offsetMs / 1000;
    const end   = i < rawVisemes.length - 1
      ? rawVisemes[i + 1].offsetMs / 1000
      : start + 0.08;
    return { start, end, value: AZURE_VISEME_TO_RHUBARB[v.visemeId] ?? 'X' };
  }).filter((v) => v.end > v.start);
}

/**
 * Builds the { start, end, text } sentence timeline from raw Azure
 * SentenceBoundary events — real audio timing (not a word-count estimate),
 * used to sync the narrator's gestures to the actual speech. See
 * frontend/src/utils/narrationGestures.js for how it's consumed.
 */
function buildSentenceTimeline(rawSentences) {
  return rawSentences
    .map((s) => ({
      start: s.offsetMs / 1000,
      end: (s.offsetMs + s.durationMs) / 1000,
      text: s.text,
    }))
    .filter((s) => s.end > s.start);
}

async function synthesizeWithAzure(text, voiceName) {
  const key    = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) throw new Error('AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set');

  const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
  speechConfig.speechSynthesisVoiceName    = voiceName || 'pt-BR-FranciscaNeural';
  speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
  // Off by default — without this, wordBoundary never fires for sentences,
  // only individual words (which we have no use for here).
  speechConfig.setProperty(sdk.PropertyId.SpeechServiceResponse_RequestSentenceBoundary, 'true');

  // null audio config = capture to memory (no speaker)
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);

  const rawVisemes = [];
  synthesizer.visemeReceived = (_s, e) => {
    rawVisemes.push({ offsetMs: e.audioOffset / 10_000, visemeId: e.visemeId });
  };

  const rawSentences = [];
  synthesizer.wordBoundary = (_s, e) => {
    // This handler also fires per-word (and per-punctuation) once sentence
    // boundaries are requested — only the sentence-level events matter here.
    if (e.boundaryType !== sdk.SpeechSynthesisBoundaryType.Sentence) return;
    rawSentences.push({
      offsetMs: e.audioOffset / 10_000,
      durationMs: e.duration / 10_000,
      text: e.text,
    });
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
        const visemeTimeline = buildVisemeTimeline(rawVisemes);
        const sentenceTimeline = buildSentenceTimeline(rawSentences);

        resolve({ audioBase64, visemeTimeline, sentenceTimeline });
      },
      (err) => {
        synthesizer.close();
        reject(new Error(String(err)));
      }
    );
  });
}

// Azure voice names look like 'pt-BR-FranciscaNeural'. The id arrives from the
// client and went straight into speechSynthesisVoiceName, so anything at all
// could be sent to a paid API and cost a 22s timeout to find out it was junk.
// This only checks the shape — Azure still rejects a well-formed unknown name.
const VOICE_ID_RE = /^[a-z]{2,3}(-[A-Za-z]{2,8})+-[A-Za-z0-9]+Neural$/;

exports.generateTTS = async (req, res) => {
  const { text, voiceId } = req.body;
  if (voiceId !== undefined && !VOICE_ID_RE.test(String(voiceId))) {
    return res.status(400).json({ error: 'voiceId is not a valid Azure voice name' });
  }
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  const safeText = String(text).trim().slice(0, 2500);

  if (!process.env.AZURE_SPEECH_KEY) {
    return res.status(503).json({ error: 'TTS not configured — set AZURE_SPEECH_KEY' });
  }

  try {
    // Azure's SDK opens a websocket that can hang (slow/blocked); cap it so the
    // request fails cleanly instead of timing out as a 504 at the gateway.
    const result = await withTimeout(synthesizeWithAzure(safeText, voiceId), 22_000, 'Azure TTS timed out');
    return res.json(result);
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: err.message || 'TTS generation failed' });
    }
  }
};

// Exported for unit testing — pure functions, no Azure SDK/network involved.
exports.buildVisemeTimeline = buildVisemeTimeline;
exports.buildSentenceTimeline = buildSentenceTimeline;
