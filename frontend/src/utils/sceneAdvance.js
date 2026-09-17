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

/** A breath after the last word, so the cut does not land on the final syllable. */
export const NARRATION_TAIL_SECONDS = 1.2;

/** Used when a scene carries no duration of its own. */
export const DEFAULT_SCENE_SECONDS = 8;

export function normalizeAdvanceOn(value) {
  return String(value || '').toLowerCase() === ADVANCE_ON_NARRATION
    ? ADVANCE_ON_NARRATION
    : ADVANCE_ON_TIME;
}

function timedMs(durationSeconds) {
  const seconds = Number(durationSeconds) > 0 ? Number(durationSeconds) : DEFAULT_SCENE_SECONDS;
  return Math.max(1, seconds) * 1000;
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
  hasNarrationAudio = false,
  audioDuration = 0,
  audioUnavailable = false,
  tailSeconds = NARRATION_TAIL_SECONDS,
} = {}) {
  if (normalizeAdvanceOn(advanceOn) !== ADVANCE_ON_NARRATION) return timedMs(durationSeconds);

  // Nothing to wait for, or waiting already failed — the configured seconds are
  // the only answer left, and a story that stalls forever is worse than one
  // that runs a little short.
  if (!hasNarrationAudio || audioUnavailable) return timedMs(durationSeconds);

  if (!(Number(audioDuration) > 0)) return null;

  return (Number(audioDuration) + Math.max(0, Number(tailSeconds) || 0)) * 1000;
}
