/**
 * How long a scene stays on screen before the story moves on.
 *
 * Playback only ever counted seconds off a clock — the narration's own length
 * was never consulted. A 14-second line under an 8-second scene was cut off
 * mid-sentence; a 3-second line left the character standing in silence for
 * five. Getting it right meant hand-tuning a number per scene and re-tuning it
 * every time the voice was regenerated.
 *
 * So a scene can now say it advances when the narration finishes instead.
 */
export const ADVANCE_ON_TIME = 'time';
export const ADVANCE_ON_NARRATION = 'narration';

/**
 * Waiting for the narration is the default, for two reasons. It is what the
 * AR player has always done — it advances when the audio ends — so making it
 * the default is what finally makes the two players agree rather than one
 * cutting lines the other lets finish. And it is the answer that needs no
 * tuning: a scene with no narration still falls back to its seconds, so the
 * default is only ever doing something where there is speech to wait for.
 */
export const DEFAULT_ADVANCE_ON = ADVANCE_ON_NARRATION;

/** A breath after the last word, so the cut does not land on the final syllable. */
export const NARRATION_TAIL_SECONDS = 1.2;

/** Used when a scene carries no duration of its own. */
export const DEFAULT_SCENE_SECONDS = 8;

/**
 * A silent scene is read, not heard, and eight seconds is eight seconds
 * whether the line is three words or sixty. Subtitle guidelines put
 * comfortable reading at roughly 160–180 words per minute; the slower end is
 * the right one here, because the reader is also looking at a character and
 * may not have the scene's language as their first.
 */
export const READING_WORDS_PER_MINUTE = 160;

/** Nobody reads anything in under this, and a flash of text reads as a glitch. */
export const MIN_READING_SECONDS = 3.5;

/** How long this text needs to be read, in seconds. */
export function readingSeconds(text, wordsPerMinute = READING_WORDS_PER_MINUTE) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 0;
  const wpm = Number(wordsPerMinute) > 0 ? Number(wordsPerMinute) : READING_WORDS_PER_MINUTE;
  return Math.max(MIN_READING_SECONDS, (words / wpm) * 60);
}

export function normalizeAdvanceOn(value) {
  const mode = String(value || '').toLowerCase();
  if (mode === ADVANCE_ON_TIME) return ADVANCE_ON_TIME;
  if (mode === ADVANCE_ON_NARRATION) return ADVANCE_ON_NARRATION;
  return DEFAULT_ADVANCE_ON;
}

function timedMs(durationSeconds, text = '') {
  const seconds = Number(durationSeconds) > 0 ? Number(durationSeconds) : DEFAULT_SCENE_SECONDS;
  // Never shorter than the text takes to read. The configured seconds are a
  // floor the author sets, not a ceiling on whether the words can be finished:
  // a scene cut short is a scene whose point was missed, and the author cannot
  // re-tune this every time they edit the line.
  return Math.max(Math.max(1, seconds), readingSeconds(text)) * 1000;
}

/**
 * @returns {number|null} milliseconds to hold the scene, or null for "not
 *   known yet" — the narration's length has not arrived. A null means wait,
 *   never advance: cutting to the next scene because metadata was a few
 *   hundred milliseconds late is the exact failure this is meant to remove.
 */
export function sceneAdvanceMs({
  advanceOn,
  durationSeconds,
  text = '',
  hasNarrationAudio = false,
  audioDuration = 0,
  audioUnavailable = false,
  tailSeconds = NARRATION_TAIL_SECONDS,
} = {}) {
  if (normalizeAdvanceOn(advanceOn) === ADVANCE_ON_TIME) return timedMs(durationSeconds, text);

  // Nothing to wait for, or waiting already failed — the configured seconds are
  // the only answer left, and a story that stalls forever is worse than one
  // that runs a little short.
  if (!hasNarrationAudio || audioUnavailable) return timedMs(durationSeconds, text);

  if (!(Number(audioDuration) > 0)) return null;

  return (Number(audioDuration) + Math.max(0, Number(tailSeconds) || 0)) * 1000;
}
