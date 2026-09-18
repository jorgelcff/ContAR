import { describe, it, expect } from 'vitest';
import { pickNarration, narrationLanguages, baseLanguage } from './narration';

const scene = {
  language: 'pt',
  text: 'Olá, bem-vindo',
  audioUrl: 'https://cdn/pt.mp3',
  translations: {
    en: { text: 'Hello, welcome', audioUrl: 'https://cdn/en.mp3' },
    es: { text: 'Hola, bienvenido' }, // written, not yet recorded
    fr: { text: '   ' },              // started and abandoned
  },
};

describe('which narration a visitor gets', () => {
  it('gives each language its own text and its own audio', () => {
    const en = pickNarration(scene, 'en');
    expect(en.text).toBe('Hello, welcome');
    expect(en.audioUrl).toBe('https://cdn/en.mp3');
    expect(en.isFallback).toBe(false);
  });

  it('ignores the region, so pt-BR and pt-PT both find Portuguese', () => {
    for (const tag of ['pt', 'pt-BR', 'PT-pt']) {
      expect(pickNarration(scene, tag).text).toBe('Olá, bem-vindo');
      expect(pickNarration(scene, tag).isFallback).toBe(false);
    }
    expect(pickNarration(scene, 'en-GB').text).toBe('Hello, welcome');
  });

  it('never speaks one language while showing another', () => {
    // Spanish is written but not recorded. Lending it the Portuguese audio
    // would caption Portuguese speech in Spanish, and the lip sync — generated
    // from the text — would animate words the audio never says.
    const es = pickNarration(scene, 'es');
    expect(es.text).toBe('Hola, bienvenido');
    expect(es.audioUrl).toBe('');
  });

  it('falls back to the original, and admits that is what happened', () => {
    const de = pickNarration(scene, 'de');
    expect(de.text).toBe('Olá, bem-vindo');
    expect(de.audioUrl).toBe('https://cdn/pt.mp3');
    expect(de.isFallback).toBe(true);
  });

  it('treats a started-and-abandoned translation as absent', () => {
    const fr = pickNarration(scene, 'fr');
    expect(fr.text).toBe('Olá, bem-vindo');
    expect(fr.isFallback).toBe(true);
  });

  it('keeps working for a scene from before any of this existed', () => {
    const old = { text: 'Uma cena antiga', audioUrl: 'https://cdn/old.mp3' };
    for (const tag of ['pt', 'en', '', undefined]) {
      const got = pickNarration(old, tag);
      expect(got.text).toBe('Uma cena antiga');
      expect(got.audioUrl).toBe('https://cdn/old.mp3');
      // With no stated original language there is nothing to have fallen back
      // from, so the viewer should not claim a fallback happened.
      expect(got.isFallback).toBe(false);
    }
  });

  it('survives a scene with no narration at all', () => {
    expect(pickNarration(undefined, 'en')).toEqual({ text: '', audioUrl: '', language: '', isFallback: false });
    expect(pickNarration({}, 'en').text).toBe('');
  });
});

describe('which languages to offer in the switcher', () => {
  it('lists the original first, then what is actually available', () => {
    expect(narrationLanguages(scene)).toEqual(['pt', 'en', 'es']);
  });

  it('leaves out languages with nothing behind them', () => {
    // fr is blank above — offering it would dead-end the visitor.
    expect(narrationLanguages(scene)).not.toContain('fr');
  });

  it('offers nothing to switch to when there is only the original', () => {
    expect(narrationLanguages({ language: 'pt', text: 'só isso' })).toEqual(['pt']);
    expect(narrationLanguages({ text: 'sem idioma declarado' })).toEqual([]);
  });
});

describe('baseLanguage', () => {
  it('strips the region and lowercases', () => {
    expect(baseLanguage('pt-BR')).toBe('pt');
    expect(baseLanguage('EN')).toBe('en');
    expect(baseLanguage('')).toBe('');
    expect(baseLanguage(null)).toBe('');
  });
});
