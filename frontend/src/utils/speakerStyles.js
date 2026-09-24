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
  // Broader, but a presenter gesturing widely still has their arms down. The
  // first numbers here were picked by eye and swung the arm out to roughly
  // forty-five degrees at the peak of the cycle, which reads as wings rather
  // than emphasis. Measured against the rig instead — see speakerGestures.test.
  speaker_wide: { gain: 1.55, lateral: 0, tempo: 0.88 },
  speaker_left: { gain: 1.25, lateral: 1, tempo: 0.97 },
  speaker_right: { gain: 1.25, lateral: -1, tempo: 0.97 },
  // Energetic storytelling beat: bigger and quicker than speaker_wide, for an
  // excited moment in a narration rather than a whole scene.
  speaker_excited: { gain: 1.7, lateral: 0, tempo: 1.4 },
  // A hushed, slow beat — smaller and slower than the neutral presenter, for a
  // calm or intimate moment.
  speaker_calm: { gain: 0.55, lateral: 0, tempo: 0.7 },
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
