import { describe, it, expect } from 'vitest';
import { splitSentences, buildNarrationPlan, variationAt, NEUTRAL_VARIATION } from './narrationGestures';

describe('splitSentences', () => {
  it('splits on sentence-ending punctuation, keeping order', () => {
    expect(splitSentences('Olá! Tudo bem? Sim, tudo.')).toEqual([
      'Olá!', 'Tudo bem?', 'Sim, tudo.',
    ]);
  });

  it('returns the whole trimmed text as one sentence when there is no punctuation', () => {
    expect(splitSentences('  uma frase sem ponto final  ')).toEqual(['uma frase sem ponto final']);
  });

  it('returns nothing for empty or missing text', () => {
    expect(splitSentences('')).toEqual([]);
    expect(splitSentences(undefined)).toEqual([]);
  });
});

describe('buildNarrationPlan', () => {
  it('returns an empty plan for empty text', () => {
    expect(buildNarrationPlan('')).toEqual([]);
  });

  it('lays out sentences back to back with no gaps or overlaps', () => {
    const plan = buildNarrationPlan('Isso é ótimo! Você acha mesmo? Bom, então vamos lá.');
    expect(plan).toHaveLength(3);
    expect(plan[0].startSec).toBe(0);
    for (let i = 1; i < plan.length; i += 1) {
      expect(plan[i].startSec).toBe(plan[i - 1].endSec);
    }
  });

  it('tags exclamations, questions, long and short sentences', () => {
    const plan = buildNarrationPlan(
      'Incrível! Você concorda? Oi. ' +
      'Esta é uma frase bem mais longa, com bastante conteúdo adicional, para garantir que ela realmente conte com muitas palavras ao todo dessa vez.',
    );
    expect(plan.map((s) => s.tag)).toEqual(['exclaim', 'question', 'short', 'long']);
  });

  it('gives exclamations a bigger, quicker accent than short/calm sentences', () => {
    const plan = buildNarrationPlan('Uau! Oi.');
    const [exclaim, short] = plan;
    expect(exclaim.gainMul).toBeGreaterThan(short.gainMul);
    expect(exclaim.tempoMul).toBeGreaterThan(short.tempoMul);
  });

  it('never assigns a lateral bias to punctuation-tagged sentences', () => {
    const plan = buildNarrationPlan('Isso é incrível! Você tem certeza? Talvez.');
    for (const segment of plan) {
      if (segment.tag !== 'neutral') expect(segment.lateralBias).toBe(0);
    }
  });
});

describe('variationAt', () => {
  it('returns the neutral variation for an empty or missing plan', () => {
    expect(variationAt([], 5)).toBe(NEUTRAL_VARIATION);
    expect(variationAt(null, 5)).toBe(NEUTRAL_VARIATION);
  });

  it('finds the segment covering a given time', () => {
    const plan = buildNarrationPlan('Primeira frase aqui. Segunda frase, um pouco mais longa também.');
    const mid = (plan[1].startSec + plan[1].endSec) / 2;
    expect(variationAt(plan, mid)).toBe(plan[1]);
  });

  it('holds on the last sentence once the estimated narration is over', () => {
    const plan = buildNarrationPlan('Uma frase só.');
    const farPast = plan[plan.length - 1].endSec + 100;
    expect(variationAt(plan, farPast)).toBe(plan[plan.length - 1]);
  });
});
