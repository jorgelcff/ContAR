const { buildVisemeTimeline, buildSentenceTimeline } = require('../controllers/ttsController');

// These are pure event-array → timeline builders, deliberately extracted so
// they can be tested without the Azure SDK or a network call — see
// synthesizeWithAzure in ttsController.js for how the raw events arrive.

describe('buildVisemeTimeline', () => {
  it('turns each viseme event into a [start, next-start) span', () => {
    const timeline = buildVisemeTimeline([
      { offsetMs: 0, visemeId: 0 },
      { offsetMs: 120, visemeId: 21 }, // 'p b m'
      { offsetMs: 250, visemeId: 0 },
    ]);
    expect(timeline).toEqual([
      { start: 0, end: 0.12, value: 'X' },
      { start: 0.12, end: 0.25, value: 'B' },
      { start: 0.25, end: 0.33, value: 'X' },
    ]);
  });

  it('maps an unknown viseme id to silence rather than throwing', () => {
    const timeline = buildVisemeTimeline([{ offsetMs: 0, visemeId: 999 }]);
    expect(timeline[0].value).toBe('X');
  });

  it('drops a zero-length span (two events at the same offset)', () => {
    const timeline = buildVisemeTimeline([
      { offsetMs: 100, visemeId: 1 },
      { offsetMs: 100, visemeId: 2 },
      { offsetMs: 200, visemeId: 0 },
    ]);
    // The first event is superseded at the same instant by the second, so it
    // never gets its own span. The second still runs to the third event's
    // offset, which in turn keeps its own synthetic trailing span — same
    // fallback as the "each event into a span" case above.
    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toEqual({ start: 0.1, end: 0.2, value: 'A' });
    expect(timeline[1]).toEqual({ start: 0.2, end: 0.28, value: 'X' });
  });

  it('returns nothing for no events', () => {
    expect(buildVisemeTimeline([])).toEqual([]);
  });
});

describe('buildSentenceTimeline', () => {
  it('turns each sentence boundary event into a [start, start+duration) span with its text', () => {
    const timeline = buildSentenceTimeline([
      { offsetMs: 0, durationMs: 900, text: 'Olá, tudo bem?' },
      { offsetMs: 950, durationMs: 1400, text: 'Isso é um teste.' },
    ]);
    expect(timeline).toEqual([
      { start: 0, end: 0.9, text: 'Olá, tudo bem?' },
      { start: 0.95, end: 2.35, text: 'Isso é um teste.' },
    ]);
  });

  it('drops a zero/negative-length span rather than passing it through', () => {
    const timeline = buildSentenceTimeline([
      { offsetMs: 0, durationMs: 0, text: 'nada' },
      { offsetMs: 500, durationMs: 300, text: 'real' },
    ]);
    expect(timeline).toEqual([{ start: 0.5, end: 0.8, text: 'real' }]);
  });

  it('returns nothing for no events (e.g. sentence boundaries not requested)', () => {
    expect(buildSentenceTimeline([])).toEqual([]);
  });
});
