import { describe, it, expect } from 'vitest';
import { SPEAKER_STYLES, isSpeakerPreset, resolveSpeakerStyle } from './speakerStyles';

describe('presenter gesture styles', () => {
  it('recognises every speaker preset and nothing else', () => {
    for (const name of Object.keys(SPEAKER_STYLES)) expect(isSpeakerPreset(name)).toBe(true);
    for (const name of ['idle', 'wave', 'point', '', null, 'speakerish']) {
      expect(isSpeakerPreset(name)).toBe(false);
    }
  });

  it('points left and right to opposite sides, by the same amount', () => {
    const left = resolveSpeakerStyle('speaker_left');
    const right = resolveSpeakerStyle('speaker_right');
    expect(left.lateral).toBeGreaterThan(0);
    expect(right.lateral).toBe(-left.lateral);
    expect(right.gain).toBe(left.gain);
  });

  it('gesticulates more than the neutral presenter, in every variation', () => {
    const base = resolveSpeakerStyle('speaker');
    expect(base.lateral).toBe(0);
    for (const name of ['speaker_wide', 'speaker_left', 'speaker_right']) {
      expect(resolveSpeakerStyle(name).gain, `${name} should be broader`).toBeGreaterThan(base.gain);
    }
  });

  it('falls back to the neutral presenter rather than returning nothing', () => {
    // A saved scene naming a preset a later build dropped must still animate.
    expect(resolveSpeakerStyle('speaker_from_the_future')).toBe(SPEAKER_STYLES.speaker);
    expect(resolveSpeakerStyle(undefined)).toBe(SPEAKER_STYLES.speaker);
  });

  it('excited is bigger and quicker than the neutral presenter', () => {
    const base = resolveSpeakerStyle('speaker');
    const excited = resolveSpeakerStyle('speaker_excited');
    expect(excited.gain).toBeGreaterThan(base.gain);
    expect(excited.tempo).toBeGreaterThan(base.tempo);
  });

  it('calm is smaller and slower than the neutral presenter', () => {
    const base = resolveSpeakerStyle('speaker');
    const calm = resolveSpeakerStyle('speaker_calm');
    expect(calm.gain).toBeLessThan(base.gain);
    expect(calm.tempo).toBeLessThan(base.tempo);
  });
});
