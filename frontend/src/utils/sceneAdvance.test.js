import { describe, it, expect } from 'vitest';
import {
  sceneAdvanceMs,
  normalizeAdvanceOn,
  ADVANCE_ON_TIME,
  ADVANCE_ON_NARRATION,
  NARRATION_TAIL_SECONDS,
  DEFAULT_ADVANCE_ON,
  readingSeconds,
  MIN_READING_SECONDS,
} from './sceneAdvance';

describe('how long a scene stays on screen', () => {
  it('counts the configured seconds when there is no narration to wait for', () => {
    expect(sceneAdvanceMs({ durationSeconds: 5 })).toBe(5000);
    expect(sceneAdvanceMs({ advanceOn: 'time', durationSeconds: 12 })).toBe(12000);
  });

  it('waits for the narration unless a scene says otherwise', () => {
    // The default the AR player has always used. A scene that wants the clock
    // has to ask for it.
    const waiting = { durationSeconds: 2, hasNarrationAudio: true, audioDuration: 9 };
    expect(sceneAdvanceMs(waiting)).toBe((9 + NARRATION_TAIL_SECONDS) * 1000);
    expect(sceneAdvanceMs({ ...waiting, advanceOn: 'time' })).toBe(2000);
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

  it('only counts the clock when a scene actually asks for it', () => {
    expect(normalizeAdvanceOn('time')).toBe(ADVANCE_ON_TIME);
    expect(normalizeAdvanceOn('TIME')).toBe(ADVANCE_ON_TIME);
    expect(normalizeAdvanceOn('narration')).toBe(ADVANCE_ON_NARRATION);
    // Anything unreadable lands on the default rather than silently picking
    // the other behaviour.
    for (const v of ['', null, undefined, 'whatever', 42]) {
      expect(normalizeAdvanceOn(v)).toBe(DEFAULT_ADVANCE_ON);
    }
  });
});

describe('readingSeconds', () => {
  it('is zero when there is nothing to read', () => {
    expect(readingSeconds('')).toBe(0);
    expect(readingSeconds('   ')).toBe(0);
    expect(readingSeconds(undefined)).toBe(0);
  });

  it('never drops below the floor, however short the line', () => {
    // A line that flashes by reads as a glitch, not as pacing.
    expect(readingSeconds('Oi.')).toBe(MIN_READING_SECONDS);
  });

  it('grows with the number of words', () => {
    const short = readingSeconds('uma frase curta aqui');
    const long = readingSeconds(new Array(80).fill('palavra').join(' '));
    expect(long).toBeGreaterThan(short);
    // 80 words at 160 wpm is half a minute.
    expect(long).toBeCloseTo(30, 0);
  });
});

describe('a scene with no narration audio', () => {
  const longLine = new Array(60).fill('palavra').join(' ');

  it('lasts long enough to read, even past its configured seconds', () => {
    // The complaint: silent scenes went by too fast to finish reading, and
    // the author cannot re-tune the seconds every time they edit the line.
    const ms = sceneAdvanceMs({ hasNarrationAudio: false, durationSeconds: 8, text: longLine });
    expect(ms).toBeGreaterThan(8000);
    expect(ms / 1000).toBeCloseTo(22.5, 0);
  });

  it("keeps the author's seconds when they are longer than the reading time", () => {
    const ms = sceneAdvanceMs({ hasNarrationAudio: false, durationSeconds: 30, text: 'Oi.' });
    expect(ms).toBe(30000);
  });

  it('still advances rather than holding forever', () => {
    expect(sceneAdvanceMs({ hasNarrationAudio: false, text: longLine })).not.toBeNull();
  });

  it('applies to the timed mode too', () => {
    const ms = sceneAdvanceMs({ advanceOn: 'time', durationSeconds: 2, text: longLine });
    expect(ms).toBeGreaterThan(2000);
  });
});

describe('a scene whose narration is audible', () => {
  it('follows the audio, not the text length', () => {
    // The voice decides the pace here; a long line read quickly is still the
    // length of the recording.
    const longLine = new Array(60).fill('palavra').join(' ');
    const ms = sceneAdvanceMs({ hasNarrationAudio: true, audioDuration: 4, text: longLine });
    expect(ms / 1000).toBeCloseTo(5.2, 5);
  });
});
