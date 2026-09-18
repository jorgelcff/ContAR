/**
 * Picking which narration a visitor hears.
 *
 * A scene used to carry one narration, so a story existed in one language. The
 * case that needs more is a QR code left at a poster with nobody standing next
 * to it: whoever scans it gets whatever language the author happened to record,
 * and there is no one there to explain. A scene can now carry the same
 * narration in several languages, and the visitor's own browser decides.
 *
 * The rule that matters is that a language is never half-applied. A translation
 * is used only when it has its own text; its audio is never borrowed from
 * another language, because English subtitles over Portuguese speech is worse
 * than Portuguese throughout — and the lip sync, which is generated from the
 * text, would be animating words the audio is not saying.
 */

/** Language tag → bare language: 'pt-BR' → 'pt'. */
export function baseLanguage(tag) {
  return String(tag || '').split('-')[0].toLowerCase();
}

function usable(entry) {
  return Boolean(entry && typeof entry === 'object' && String(entry.text || '').trim());
}

/**
 * @returns {{text: string, audioUrl: string, language: string, isFallback: boolean}}
 *   isFallback is true when the visitor's language was not available and the
 *   original was used — the viewer says so rather than pretending.
 */
export function pickNarration(narrative, language) {
  const base = {
    text: String(narrative?.text || ''),
    audioUrl: String(narrative?.audioUrl || ''),
    language: baseLanguage(narrative?.language) || '',
    isFallback: false,
  };

  const wanted = baseLanguage(language);
  if (!wanted) return base;
  // Asking for the language the original is already in is not a fallback.
  if (base.language && wanted === base.language) return base;

  const entry = narrative?.translations?.[wanted];
  if (!usable(entry)) return { ...base, isFallback: Boolean(base.language) && wanted !== base.language };

  return {
    text: String(entry.text || ''),
    // Deliberately not `|| narrative.audioUrl`: see the note above.
    audioUrl: String(entry.audioUrl || ''),
    language: wanted,
    isFallback: false,
  };
}

/**
 * Every language this narration can actually be heard or read in, original
 * first. Drives the viewer's switcher — offering a language with nothing
 * behind it would just dead-end the visitor.
 */
export function narrationLanguages(narrative) {
  const out = [];
  const original = baseLanguage(narrative?.language);
  if (original && String(narrative?.text || '').trim()) out.push(original);

  const translations = narrative?.translations || {};
  for (const tag of Object.keys(translations)) {
    const lang = baseLanguage(tag);
    if (lang && lang !== original && usable(translations[tag])) out.push(lang);
  }
  return out;
}
