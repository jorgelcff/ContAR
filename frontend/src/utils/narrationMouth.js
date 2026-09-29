/**
 * How far the AR avatar's mouth is open this frame, from the narration.
 *
 * AR read the mouth off a live AnalyserNode fed by createMediaElementSource.
 * On iPhone — Safari and Chrome alike, both WebKit — that node can hand back
 * pure silence while the <audio> element plays normally, so the voice was heard
 * and the mouth never moved, for recorded narration in particular. The editor
 * preview did not show it because it runs on a desktop browser.
 *
 * So the mouth no longer depends on that node. In order of preference:
 *   1. envelope — the file is fetched and decoded once, its loudness sampled
 *      into a curve, and the curve read at audio.currentTime. It never touches
 *      the playing element, so WebKit's routing cannot silence it.
 *   2. analyser — the live node, while the envelope is still decoding, and
 *      only if it is actually reporting sound.
 *   3. synthetic — a talking rhythm while the audio plays. Not lip sync, but a
 *      character that speaks with its mouth shut reads as broken; one that
 *      moves roughly in time does not.
 */

/** Loudness samples per second of audio. */
export const ENVELOPE_RATE = 60;

/** Below this (after normalising) the mouth is closed — pauses between words. */
const GATE = 0.12;

/** Analyser RMS above this counts as "the node is really hearing something". */
const ANALYSER_ALIVE_RMS = 0.01;

/** Scale the live analyser RMS the way AR always has. */
const ANALYSER_GAIN = 14;

const envelopeCache = new Map();

/**
 * Loudness curve of a decoded buffer: RMS per 1/rate s window, normalised so
 * the 95th percentile of speaking frames reads as 1. Normalising matters — a
 * quiet phone recording and a loud TTS file should open the mouth alike.
 * @param {Float32Array[]} channels
 * @param {number} sampleRate
 * @param {number} [rate]
 * @returns {Float32Array}
 */
export function computeEnvelope(channels, sampleRate, rate = ENVELOPE_RATE) {
  const length = channels[0]?.length || 0;
  const hop = Math.max(1, Math.round(sampleRate / rate));
  const frames = Math.ceil(length / hop);
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    const end = Math.min(length, start + hop);
    let sum = 0;
    for (const ch of channels) {
      for (let i = start; i < end; i++) sum += ch[i] * ch[i];
    }
    env[f] = Math.sqrt(sum / Math.max(1, (end - start) * channels.length));
  }
  const sorted = Array.from(env).filter((v) => v > 1e-4).sort((a, b) => a - b);
  const ref = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
  if (ref > 0) for (let f = 0; f < frames; f++) env[f] = Math.min(1, env[f] / ref);
  return env;
}

/** Envelope value at `time` seconds, 0 outside the file. */
export function envelopeAt(env, time, rate = ENVELOPE_RATE) {
  if (!env || !env.length || !(time >= 0)) return 0;
  const f = Math.floor(time * rate);
  return f < env.length ? env[f] : 0;
}

/**
 * A talking rhythm: syllables at ~4–5 Hz with a slower phrase swell, and short
 * closed gaps so it does not read as chewing.
 */
export function syntheticMouth(time) {
  const syllable = Math.abs(Math.sin(time * Math.PI * 4.3));
  const phrase = 0.65 + 0.35 * Math.sin(time * Math.PI * 0.9 + 1.3);
  const v = syllable * phrase;
  return v < 0.18 ? 0 : v * 0.75;
}

function decode(buffer) {
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Ctx) return Promise.reject(new Error('no OfflineAudioContext'));
  const ctx = new Ctx(1, 1, 44100);
  // Callback form too: older WebKit never returned the promise.
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(buffer, resolve, reject);
    if (p && typeof p.then === 'function') p.then(resolve, reject);
  });
}

/**
 * Starts (once per URL) fetching and decoding the narration. Resolves to the
 * envelope, or null when the browser cannot decode the file — the caller then
 * falls back, it never waits.
 */
export function loadEnvelope(url) {
  if (!url) return Promise.resolve(null);
  if (!envelopeCache.has(url)) {
    const entry = { env: null, promise: null };
    entry.promise = fetch(url, { mode: 'cors' })
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(decode)
      .then((buf) => {
        const channels = [];
        for (let c = 0; c < buf.numberOfChannels; c++) channels.push(buf.getChannelData(c));
        entry.env = computeEnvelope(channels, buf.sampleRate);
        return entry.env;
      })
      .catch(() => null);
    envelopeCache.set(url, entry);
  }
  return envelopeCache.get(url).promise;
}

function cachedEnvelope(url) {
  return envelopeCache.get(url)?.env || null;
}

function analyserLevel(analyser, buf) {
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length);
}

/**
 * Per-avatar driver the AR render loops call every frame.
 * `level(audioEl, analyser[, nowSeconds])` returns 0–1, 0 meaning "mouth closed".
 */
export function createNarrationMouth() {
  let buf = null;
  let smoothed = 0;
  let lastNow = 0;
  return {
    level(audioEl, analyser, now = performance.now() / 1000) {
      const dt = lastNow ? Math.min(0.1, now - lastNow) : 1 / 60;
      lastNow = now;

      const playing = Boolean(audioEl && audioEl.src && !audioEl.paused && !audioEl.ended);
      let target = 0;
      if (playing) {
        const url = audioEl.currentSrc || audioEl.src;
        loadEnvelope(url);
        const env = cachedEnvelope(url);
        if (env) {
          target = envelopeAt(env, audioEl.currentTime);
        } else {
          let live = 0;
          if (analyser) {
            if (!buf || buf.length !== analyser.frequencyBinCount) buf = new Uint8Array(analyser.frequencyBinCount);
            live = analyserLevel(analyser, buf);
          }
          target = live > ANALYSER_ALIVE_RMS
            ? Math.min(1, live * ANALYSER_GAIN)
            : syntheticMouth(audioEl.currentTime);
        }
        target = target < GATE ? 0 : target;
      }

      // Fast open, slower close — the same shape the editor's jaw smoothing has.
      const speed = target > smoothed ? 28 : 14;
      smoothed += (target - smoothed) * Math.min(1, speed * dt);
      return smoothed < 0.03 ? 0 : smoothed;
    },
  };
}
