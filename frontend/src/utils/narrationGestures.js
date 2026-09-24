/**
 * Text-only narration pacing: turns a scene's speech text into a timeline of
 * gesture-variation accents (gain/tempo/lateral nudges) layered on top of
 * whichever speaker style the scene author picked — so a long narration
 * doesn't gesticulate identically for its whole duration.
 *
 * Deliberately audio-agnostic: it estimates timing from word count rather
 * than reading real playback position, so it needs no change to how scenes
 * are authored or stored. See AnimationController's narration fields for how
 * this timeline is walked frame by frame.
 */

// A speaking-pace estimate, not a precision figure — only used to apportion
// relative time between sentences, not to sync to actual audio.
const DEFAULT_WORDS_PER_MINUTE = 155;

const NEUTRAL_VARIATION = Object.freeze({ gainMul: 1, tempoMul: 1, lateralBias: 0 });

// Gentle, alternating lateral nudge for plain sentences so a long narration
// doesn't stare dead ahead the whole time. Punctuation-driven tags below
// override this with lateralBias: 0 — addressing a side is a deliberate
// choice (speaker_left/right), not something punctuation should trigger.
const LATERAL_CYCLE = [0, 0.45, -0.45];

const VARIATION_BY_TAG = Object.freeze({
  exclaim:  { gainMul: 1.25, tempoMul: 1.15, lateralBias: 0 },
  question: { gainMul: 0.95, tempoMul: 0.92, lateralBias: 0 },
  long:     { gainMul: 1.15, tempoMul: 1.0, lateralBias: 0 },
  short:    { gainMul: 0.85, tempoMul: 0.92, lateralBias: 0 },
  neutral:  { gainMul: 1.0, tempoMul: 1.0, lateralBias: 0 },
});

/** Splits text into trimmed sentences, kept in their original order. */
export function splitSentences(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const matches = raw.match(/[^.!?…]+[.!?…]*/g) || [raw];
  return matches.map((s) => s.trim()).filter(Boolean);
}

function classifySentence(sentence) {
  if (/[!]\s*$/.test(sentence)) return 'exclaim';
  if (/[?]\s*$/.test(sentence)) return 'question';
  const words = sentence.split(/\s+/).filter(Boolean).length;
  if (words >= 22) return 'long';
  if (words > 0 && words <= 5) return 'short';
  return 'neutral';
}

/**
 * Builds a sentence-by-sentence variation timeline for the given narration
 * text. Each segment's [startSec, endSec) is apportioned by word count
 * against an estimated total speech duration — good enough to pace *relative*
 * accents, without needing the real TTS audio duration.
 */
export function buildNarrationPlan(text, { wordsPerMinute = DEFAULT_WORDS_PER_MINUTE } = {}) {
  const sentences = splitSentences(text);
  if (!sentences.length) return [];

  const wordsPerSecond = wordsPerMinute / 60;
  let cursor = 0;
  return sentences.map((sentence, index) => {
    const wordCount = sentence.split(/\s+/).filter(Boolean).length || 1;
    const duration = Math.max(0.4, wordCount / wordsPerSecond);
    const tag = classifySentence(sentence);
    const base = VARIATION_BY_TAG[tag] || VARIATION_BY_TAG.neutral;
    const lateralBias = tag === 'neutral' ? LATERAL_CYCLE[index % LATERAL_CYCLE.length] : base.lateralBias;

    const segment = {
      startSec: cursor,
      endSec: cursor + duration,
      tag,
      gainMul: base.gainMul,
      tempoMul: base.tempoMul,
      lateralBias,
    };
    cursor += duration;
    return segment;
  });
}

/**
 * The variation active at `timeSec` into the plan. Holds on the last
 * sentence's variation once the estimated narration is over, rather than
 * looping back to the first — real speech doesn't restart mid-scene.
 */
export function variationAt(plan, timeSec) {
  if (!Array.isArray(plan) || plan.length === 0) return NEUTRAL_VARIATION;
  if (timeSec < plan[0].startSec) return plan[0];
  for (const segment of plan) {
    if (timeSec >= segment.startSec && timeSec < segment.endSec) return segment;
  }
  return plan[plan.length - 1];
}

export { NEUTRAL_VARIATION };
