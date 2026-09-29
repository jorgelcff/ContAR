import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeEnvelope, envelopeAt, syntheticMouth, createNarrationMouth, ENVELOPE_RATE } from './narrationMouth';

// Stand-in for an AnalyserNode: getByteTimeDomainData fills a flat line (silence,
// what WebKit hands back on iPhone) or a square wave of the given amplitude.
function fakeAnalyser(amplitude = 0) {
  return {
    frequencyBinCount: 256,
    getByteTimeDomainData(buf) {
      for (let i = 0; i < buf.length; i++) buf[i] = 128 + (i % 2 ? amplitude : -amplitude);
    },
  };
}

function playingAudio(currentTime = 1, src = 'https://example.com/never-decodes.webm') {
  return { src, currentSrc: src, paused: false, ended: false, currentTime };
}

describe('computeEnvelope', () => {
  it('normalises so a quiet recording opens the mouth as much as a loud one', () => {
    const quiet = new Float32Array(48000).map((_, i) => 0.02 * Math.sin(i / 5));
    const loud = new Float32Array(48000).map((_, i) => 0.6 * Math.sin(i / 5));
    const q = computeEnvelope([quiet], 48000);
    const l = computeEnvelope([loud], 48000);
    expect(Math.max(...q)).toBeCloseTo(1, 1);
    expect(Math.max(...l)).toBeCloseTo(1, 1);
  });

  it('keeps the pauses closed', () => {
    const sr = 48000;
    const samples = new Float32Array(sr); // 1s: speech, then silence
    for (let i = 0; i < sr / 2; i++) samples[i] = 0.3 * Math.sin(i / 4);
    const env = computeEnvelope([samples], sr);
    expect(envelopeAt(env, 0.2)).toBeGreaterThan(0.5);
    expect(envelopeAt(env, 0.8)).toBe(0);
  });

  it('reads 0 outside the file', () => {
    const env = new Float32Array(ENVELOPE_RATE).fill(1);
    expect(envelopeAt(env, 5)).toBe(0);
    expect(envelopeAt(env, -1)).toBe(0);
  });
});

describe('createNarrationMouth', () => {
  afterEach(() => vi.unstubAllGlobals());

  // Decoding never finishes here, so the driver must fall back rather than wait.
  const neverDecodes = () => vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

  const runFrames = (mouth, audioEl, analyser, frames = 40) => {
    const levels = [];
    for (let i = 0; i < frames; i++) {
      if (audioEl) audioEl.currentTime += 1 / 60;
      levels.push(mouth.level(audioEl, analyser, 100 + i / 60));
    }
    return levels;
  };

  it('still moves the mouth when the analyser is silent while audio plays (iPhone)', () => {
    neverDecodes();
    const levels = runFrames(createNarrationMouth(), playingAudio(), fakeAnalyser(0));
    expect(Math.max(...levels)).toBeGreaterThan(0.2);
    // And it is a rhythm, not a mouth held open.
    expect(Math.min(...levels.slice(10))).toBeLessThan(Math.max(...levels) * 0.5);
  });

  it('uses the live analyser when it is really hearing something', () => {
    neverDecodes();
    const levels = runFrames(createNarrationMouth(), playingAudio(), fakeAnalyser(40));
    expect(Math.min(...levels.slice(20))).toBeGreaterThan(0.8);
  });

  it('keeps the mouth shut when nothing is playing', () => {
    neverDecodes();
    const paused = { ...playingAudio(), paused: true };
    expect(Math.max(...runFrames(createNarrationMouth(), paused, fakeAnalyser(40)))).toBe(0);
    expect(Math.max(...runFrames(createNarrationMouth(), null, null))).toBe(0);
  });
});

describe('syntheticMouth', () => {
  it('opens and closes over a second of speech', () => {
    const values = Array.from({ length: 60 }, (_, i) => syntheticMouth(i / 60));
    expect(Math.max(...values)).toBeGreaterThan(0.4);
    expect(values.filter((v) => v === 0).length).toBeGreaterThan(3);
  });
});
