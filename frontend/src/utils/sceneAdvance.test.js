import { describe, it, expect } from 'vitest';
import {
  sceneAdvanceMs,
  normalizeAdvanceOn,
  ADVANCE_ON_TIME,
  ADVANCE_ON_NARRATION,
  NARRATION_TAIL_SECONDS,
} from './sceneAdvance';

describe('how long a scene stays on screen', () => {
  it('counts the configured seconds by default', () => {
    expect(sceneAdvanceMs({ durationSeconds: 5 })).toBe(5000);
    expect(sceneAdvanceMs({ advanceOn: 'time', durationSeconds: 12 })).toBe(12000);
  });

  it('falls back to a sane default rather than advancing instantly', () => {
    for (const bad of [0, undefined, null, -3, NaN, 'abc']) {
      expect(sceneAdvanceMs({ durationSeconds: bad }), `${bad} should not be instant`).toBe(8000);
    }
  });

  it('waits out the narration, plus a breath, when asked to', () => {
    const ms = sceneAdvanceMs({
      advanceOn: ADVANCE_ON_NARRATION,
      durationSeconds: 8,
      hasNarrationAudio: true,
      audioDuration: 14,
    });
    // The whole point: a 14s line under an 8s scene is no longer cut off.
    expect(ms).toBe((14 + NARRATION_TAIL_SECONDS) * 1000);
    expect(ms).toBeGreaterThan(8000);
  });

  it('also stops the character standing in silence', () => {
    const ms = sceneAdvanceMs({
      advanceOn: ADVANCE_ON_NARRATION,
      durationSeconds: 8,
      hasNarrationAudio: true,
      audioDuration: 3,
    });
    expect(ms).toBe((3 + NARRATION_TAIL_SECONDS) * 1000);
    expect(ms).toBeLessThan(8000);
  });

  it('holds rather than guessing while the length is still unknown', () => {
    // Advancing because metadata was late is the failure this replaces.
    expect(sceneAdvanceMs({
      advanceOn: ADVANCE_ON_NARRATION,
      durationSeconds: 8,
      hasNarrationAudio: true,
      audioDuration: 0,
    })).toBeNull();
  });

  it('never waits forever — no audio, or audio that never arrives, uses the clock', () => {
    expect(sceneAdvanceMs({
      advanceOn: ADVANCE_ON_NARRATION,
      durationSeconds: 6,
      hasNarrationAudio: false,
    })).toBe(6000);

    expect(sceneAdvanceMs({
      advanceOn: ADVANCE_ON_NARRATION,
      durationSeconds: 6,
      hasNarrationAudio: true,
      audioDuration: 0,
      audioUnavailable: true,
    })).toBe(6000);
  });

  it('reads anything it does not recognise as the timed mode', () => {
    expect(normalizeAdvanceOn('narration')).toBe(ADVANCE_ON_NARRATION);
    expect(normalizeAdvanceOn('NARRATION')).toBe(ADVANCE_ON_NARRATION);
    for (const v of ['time', '', null, undefined, 'whatever', 42]) {
      expect(normalizeAdvanceOn(v)).toBe(ADVANCE_ON_TIME);
    }
  });
});
