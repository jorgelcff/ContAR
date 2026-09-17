/**
 * How a presenter gesticulates.
 *
 * There was one speaker animation: a fixed, symmetric idle layered over the
 * base pose. It reads as "a person talking" and nothing else — the same motion
 * for a whole story, never addressing one side of the room, never emphasising
 * anything. These are variations on that same motion rather than new clips, so
 * they work on any rig the base gestures already work on.
 *
 *  gain     scales every gesture amplitude — how big the movement is.
 *  lateral  which way the presenter is addressing: +1 is the character's own
 *           left, -1 its right, 0 straight ahead. It turns the head and torso
 *           and opens the near arm while the far one tucks in, which is what
 *           actually reads as "gesturing that way" — an arm alone does not.
 *  tempo    scales the clock, so a broader gesture can also be a slower one.
 */
export const SPEAKER_STYLES = {
  speaker: { gain: 1, lateral: 0, tempo: 1 },
  speaker_wide: { gain: 2.1, lateral: 0, tempo: 0.88 },
  speaker_left: { gain: 1.5, lateral: 1, tempo: 0.97 },
  speaker_right: { gain: 1.5, lateral: -1, tempo: 0.97 },
};

export const SPEAKER_PRESETS = Object.keys(SPEAKER_STYLES);

/** True for every preset that drives the procedural presenter gestures. */
export function isSpeakerPreset(preset) {
  return Object.prototype.hasOwnProperty.call(SPEAKER_STYLES, String(preset || '').toLowerCase());
}

/** The style for a preset name; the neutral presenter for anything unknown. */
export function resolveSpeakerStyle(preset) {
  return SPEAKER_STYLES[String(preset || '').toLowerCase()] || SPEAKER_STYLES.speaker;
}
