/**
 * What this avatar's face can actually do with a viseme timeline.
 *
 * "Sync lips to this audio" generates a timeline and reports "12 visemes
 * synced" with a green check. That check was unconditional, and the render
 * loop only applies a timeline to avatars that have mouth morph targets. An
 * avatar without them — which is what some Avaturn exports are — gets a
 * synthetic jaw bone instead, driven by raw loudness. So the author records a
 * line, types the words, sees the confirmation, and watches a mouth that is
 * flapping to the waveform and ignoring every viseme.
 *
 * The timeline is not wrong and the jaw is not broken; the interface was
 * claiming a precision the avatar cannot show. This says which of the three is
 * true so the interface can say it too.
 */

/** Mouth shapes follow the timeline: the real thing. */
export const VISEMES = 'visemes';
/** The jaw opens and closes with loudness. No shapes — a timeline changes nothing. */
export const JAW_ONLY = 'jawOnly';
/** Nothing on this model can move. */
export const NONE = 'none';

/**
 * @param {object} p
 * @param {boolean} p.hasArkitVisemes  ARKit blendshapes (Avaturn/ReadyPlayerMe),
 *   driven straight from Azure viseme ids.
 * @param {number}  p.mouthMorphCount  Grouped mouth targets (aa / mouthOpen).
 * @param {boolean} p.hasJaw           A jaw bone, real or injected.
 * @returns {'visemes'|'jawOnly'|'none'}
 */
export function lipsyncCapability({
  hasArkitVisemes = false,
  mouthMorphCount = 0,
  hasJaw = false,
} = {}) {
  if (hasArkitVisemes || mouthMorphCount > 0) return VISEMES;
  if (hasJaw) return JAW_ONLY;
  return NONE;
}

/** Whether a generated viseme timeline will be visible on this avatar. */
export function timelineIsVisible(capability) {
  return capability === VISEMES;
}
