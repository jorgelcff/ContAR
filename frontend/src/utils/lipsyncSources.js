/**
 * Which source, if any, should be moving the mouth this frame.
 *
 * The bug this exists to stop: the browser's Web Speech path has no analyser,
 * so the mouth is driven straight from the viseme timeline. When the utterance
 * ended, `onend` set the playback clock back to 0 — but the timeline itself was
 * never cleared and the mode stayed "timeline", so the condition kept matching
 * and every frame afterwards blended the cue at t=0. The character finished
 * speaking and then held the first viseme of the sentence indefinitely, which
 * on an open vowel is a wide-open mouth.
 *
 * The reset branch was there all along; it just could not be reached while a
 * stale timeline still satisfied the test. Speech being *active* is now part of
 * the question, so when it stops the answer becomes "none" and the mouth closes.
 */
export function pickMouthSource({
  hasAnalyser = false,
  hasMorphs = false,
  hasJaw = false,
  visemeMode = 'heuristic',
  timelineLength = 0,
  isSpeaking = false,
} = {}) {
  // Real audio through Web Audio: the analyser reports silence on its own once
  // playback stops, so this branch closes the mouth without being told.
  if (hasAnalyser && (hasMorphs || hasJaw)) return 'analyser';

  if (!hasAnalyser && isSpeaking && visemeMode === 'timeline' && hasMorphs && timelineLength > 0) {
    return 'timeline';
  }

  return 'none';
}
