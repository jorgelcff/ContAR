/**
 * What the editor can play back when asked to run the scene.
 *
 * Seeing a scene the way a viewer will meant saving it and opening the viewer
 * in another tab. Everything needed to play it is already on screen — the
 * avatar, the pose, the speech bubble, the lip sync — but nothing started it
 * from the top.
 *
 * Two sources, in order of fidelity: the narration file, which is what a
 * viewer will actually hear, and failing that the browser's own voice, which
 * at least drives the mouth and the timing while a scene is still being
 * written.
 */
export function pickPreviewSource({
  narrationAudioUrl = '',
  speechText = '',
  webSpeechAvailable = false,
} = {}) {
  if (String(narrationAudioUrl || '').trim()) return 'audio';
  if (webSpeechAvailable && String(speechText || '').trim()) return 'speech';
  return 'none';
}
