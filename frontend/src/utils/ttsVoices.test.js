import { describe, it, expect } from 'vitest';
import { TTS_VOICES, voicesForLanguage, defaultVoiceFor, isKnownVoice } from './ttsVoices';

/** The shape the backend validates against before calling Azure. */
const VOICE_ID_RE = /^[a-z]{2,3}(-[A-Za-z]{2,8})+-[A-Za-z0-9]+Neural$/;

describe('the catalogue', () => {
  it('has no duplicate ids', () => {
    const ids = TTS_VOICES.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only holds ids the backend will accept', () => {
    const rejected = TTS_VOICES.filter((v) => !VOICE_ID_RE.test(v.id));
    expect(rejected).toEqual([]);
  });

  it('offers both genders in every language the app narrates in', () => {
    // The complaint that started this: English had one voice, and it was female.
    for (const lang of ['pt', 'en', 'es', 'fr']) {
      const voices = voicesForLanguage(lang);
      expect(voices.some((v) => v.gender === 'm'), `${lang} has no male voice`).toBe(true);
      expect(voices.some((v) => v.gender === 'f'), `${lang} has no female voice`).toBe(true);
    }
  });
});

describe('voicesForLanguage', () => {
  it('returns only voices that speak that language', () => {
    for (const v of voicesForLanguage('en')) {
      expect(v.locale.startsWith('en')).toBe(true);
    }
  });

  it('matches on the bare language, so a regional tag still works', () => {
    expect(voicesForLanguage('pt-BR')).toEqual(voicesForLanguage('pt'));
    expect(voicesForLanguage('PT')).toEqual(voicesForLanguage('pt'));
  });

  it('falls back to everything rather than an empty picker', () => {
    expect(voicesForLanguage('ja')).toEqual(TTS_VOICES);
    expect(voicesForLanguage('')).toEqual(TTS_VOICES);
    expect(voicesForLanguage(undefined)).toEqual(TTS_VOICES);
  });
});

describe('defaultVoiceFor', () => {
  it('picks a voice that actually speaks the language', () => {
    for (const lang of ['pt', 'en', 'es', 'fr']) {
      const id = defaultVoiceFor(lang);
      expect(isKnownVoice(id)).toBe(true);
      expect(TTS_VOICES.find((v) => v.id === id).locale.startsWith(lang)).toBe(true);
    }
  });

  it('always returns something usable', () => {
    expect(isKnownVoice(defaultVoiceFor('ja'))).toBe(true);
    expect(isKnownVoice(defaultVoiceFor(undefined))).toBe(true);
  });
});

describe('isKnownVoice', () => {
  it('rejects anything not in the catalogue', () => {
    expect(isKnownVoice('pt-BR-FranciscaNeural')).toBe(true);
    expect(isKnownVoice('pt-BR-NobodyNeural')).toBe(false);
    expect(isKnownVoice('')).toBe(false);
  });
});
