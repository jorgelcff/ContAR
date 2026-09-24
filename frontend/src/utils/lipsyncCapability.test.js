import { describe, it, expect } from 'vitest';
import {
  lipsyncCapability,
  timelineIsVisible,
  VISEMES,
  JAW_ONLY,
  NONE,
} from './lipsyncCapability';

describe('lipsyncCapability', () => {
  it('reports visemes for an ARKit avatar', () => {
    // Avaturn / ReadyPlayerMe: Azure viseme ids map straight onto blendshapes.
    expect(lipsyncCapability({ hasArkitVisemes: true })).toBe(VISEMES);
  });

  it('reports visemes for an avatar with grouped mouth morphs', () => {
    expect(lipsyncCapability({ mouthMorphCount: 4 })).toBe(VISEMES);
  });

  it('reports jaw-only for an avatar whose mouth is just a bone', () => {
    // This is the case the green check was lying about.
    expect(lipsyncCapability({ hasJaw: true })).toBe(JAW_ONLY);
    expect(lipsyncCapability({ mouthMorphCount: 0, hasJaw: true })).toBe(JAW_ONLY);
  });

  it('does not count non-mouth morphs as a mouth', () => {
    // An avatar can carry blink or brow targets and still have nothing to
    // shape a viseme with.
    expect(lipsyncCapability({ mouthMorphCount: 0, hasJaw: false })).toBe(NONE);
  });

  it('reports none when nothing on the model can move', () => {
    expect(lipsyncCapability({})).toBe(NONE);
    expect(lipsyncCapability()).toBe(NONE);
  });

  it('prefers visemes when the avatar has both a mouth and a jaw', () => {
    expect(lipsyncCapability({ mouthMorphCount: 2, hasJaw: true })).toBe(VISEMES);
  });
});

describe('timelineIsVisible', () => {
  it('is true only where the timeline actually reaches the face', () => {
    expect(timelineIsVisible(VISEMES)).toBe(true);
    expect(timelineIsVisible(JAW_ONLY)).toBe(false);
    expect(timelineIsVisible(NONE)).toBe(false);
    expect(timelineIsVisible(undefined)).toBe(false);
  });
});
