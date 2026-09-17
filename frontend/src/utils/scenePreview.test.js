import { describe, it, expect } from 'vitest';
import { pickPreviewSource } from './scenePreview';

describe('what the editor plays when running a scene', () => {
  it('prefers the narration file — that is what a viewer will hear', () => {
    expect(pickPreviewSource({
      narrationAudioUrl: 'https://cdn/x.mp3',
      speechText: 'olá',
      webSpeechAvailable: true,
    })).toBe('audio');
  });

  it('falls back to the browser voice while a scene is still being written', () => {
    expect(pickPreviewSource({ speechText: 'olá', webSpeechAvailable: true })).toBe('speech');
  });

  it('has nothing to play without text, and nothing to play without a voice', () => {
    expect(pickPreviewSource({ webSpeechAvailable: true })).toBe('none');
    expect(pickPreviewSource({ speechText: 'olá', webSpeechAvailable: false })).toBe('none');
    expect(pickPreviewSource({})).toBe('none');
  });

  it('treats blank text and blank urls as absent', () => {
    expect(pickPreviewSource({
      narrationAudioUrl: '   ',
      speechText: '   ',
      webSpeechAvailable: true,
    })).toBe('none');
  });
});
