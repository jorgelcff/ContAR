const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel — multilingual

exports.generateTTS = async (req, res) => {
  const { text, voiceId } = req.body;

  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'TTS not configured — set ELEVENLABS_API_KEY' });
  }

  const voice = String(voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID).trim();
  const safeText = String(text).trim().slice(0, 2500);

  try {
    const upstream = await fetch(
      `${ELEVENLABS_API_BASE}/text-to-speech/${voice}/with-timestamps`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          text: safeText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!upstream.ok) {
      const detail = await upstream.json().catch(() => ({}));
      const msg =
        detail?.detail?.message || detail?.message || `ElevenLabs error ${upstream.status}`;
      return res.status(upstream.status).json({ error: msg });
    }

    // { audio_base64, alignment: { characters, character_start_times_seconds, character_end_times_seconds } }
    const data = await upstream.json();

    res.json({
      audioBase64: data.audio_base64,
      alignment: data.alignment || null,
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'TTS generation failed' });
    }
  }
};
