import { describe, it, expect } from 'vitest';
import { pickMouthSource } from './lipsyncSources';

const speaking = {
  hasAnalyser: false,
  hasMorphs: true,
  visemeMode: 'timeline',
  timelineLength: 12,
  isSpeaking: true,
};

describe('which source drives the mouth', () => {
  it('uses the viseme timeline while the browser voice is speaking', () => {
    expect(pickMouthSource(speaking)).toBe('timeline');
  });

  it('lets go the moment speech stops, even though the timeline is still loaded', () => {
    // The exact defect: Web Speech ends, the clock resets to 0, the timeline is
    // never cleared — so the mouth held the sentence's first viseme forever.
    expect(pickMouthSource({ ...speaking, isSpeaking: false })).toBe('none');
  });

  it('prefers the analyser when there is real audio to measure', () => {
    expect(pickMouthSource({ ...speaking, hasAnalyser: true })).toBe('analyser');
    // And keeps it after playback stops: silence measures as a closed mouth,
    // so that branch needs no speaking flag.
    expect(pickMouthSource({ ...speaking, hasAnalyser: true, isSpeaking: false })).toBe('analyser');
  });

  it('drives a jaw-only rig from the analyser even with no morph targets', () => {
    expect(pickMouthSource({ hasAnalyser: true, hasMorphs: false, hasJaw: true })).toBe('analyser');
  });

  it('has nothing to drive with no analyser, no timeline and no morphs', () => {
    expect(pickMouthSource({})).toBe('none');
    expect(pickMouthSource({ ...speaking, timelineLength: 0 })).toBe('none');
    expect(pickMouthSource({ ...speaking, hasMorphs: false })).toBe('none');
    expect(pickMouthSource({ ...speaking, visemeMode: 'heuristic' })).toBe('none');
  });
});
