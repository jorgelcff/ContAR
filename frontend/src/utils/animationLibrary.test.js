import { describe, it, expect } from 'vitest';
import { entriesForPresets, presetMapFrom } from './animationLibrary';

// The shipped manifest, reduced to what the selection reads.
const MANIFEST = [
  { file: 'idle.glb', preset: 'idle', tags: ['idle', 'stand'] },
  { file: 'walk.glb', preset: 'walk', tags: ['walk'] },
  { file: 'walk_circle.glb', preset: 'walk_circle', tags: ['walk_circle'] },
  { file: 'slow_run.glb', preset: 'slow_run', tags: ['slow_run', 'jog'] },
  { file: 'run.glb', preset: 'run', tags: ['run'] },
  { file: 'dance.glb', preset: 'dance', tags: ['dance'] },
  { file: 'dance_samba.glb', preset: 'dance_samba', tags: ['dance_samba', 'samba'] },
  { file: 'talking.glb', preset: 'speaker', tags: ['speaker', 'talk', 'talking'] },
  { file: 'agree.glb', preset: 'agree', tags: ['agree', 'nod', 'yes'] },
  { file: 'head_shake.glb', preset: 'disagree', tags: ['disagree', 'headshake', 'no'] },
  { file: 'sad_pose.glb', preset: 'sad', tags: ['sad'] },
  { file: 'sneak_pose.glb', preset: 'sneak', tags: ['sneak', 'tiptoe'] },
];
const files = (presets, manifest = MANIFEST) => entriesForPresets(manifest, presets).map((e) => e.file).sort();

describe('which clips a set of poses needs', () => {
  it('fetches only the clips a story uses, plus idle', () => {
    // The measured story: idle, speaker, walk — 0.26 MB instead of 14.4.
    expect(files(['idle', 'speaker', 'walk'])).toEqual(['idle.glb', 'walk.glb']);
  });

  it('needs no clip for the presenter styles, which are procedural', () => {
    expect(files(['speaker', 'speaker_excited', 'speaker_calm'])).toEqual(['idle.glb']);
  });

  it('needs no clip for poses set from code', () => {
    expect(files(['think', 'bow', 'wave', 'clip:0'])).toEqual(['idle.glb']);
  });

  it('does not pull in a neighbour whose name contains this one', () => {
    // "disagree" contains "agree"; "slow_run" contains "run".
    expect(files(['agree'])).toEqual(['agree.glb', 'idle.glb']);
    expect(files(['run'])).toEqual(['idle.glb', 'run.glb']);
    expect(files(['dance'])).toEqual(['dance.glb', 'idle.glb']);
  });

  it('falls back along the gait chain only as far as a clip exists', () => {
    const noRun = MANIFEST.filter((e) => e.preset !== 'run');
    expect(files(['run'], noRun)).toEqual(['idle.glb', 'slow_run.glb']);
    const onlyWalk = MANIFEST.filter((e) => !['run', 'slow_run'].includes(e.preset));
    expect(files(['run'], onlyWalk)).toEqual(['idle.glb', 'walk.glb']);
  });

  it('is case-insensitive and tolerates junk', () => {
    expect(files(['WALK', null, undefined, ''])).toEqual(['idle.glb', 'walk.glb']);
    expect(files(undefined)).toEqual(['idle.glb']);
  });

  it('finds a clip listed only by tag', () => {
    const tagged = [{ file: 'jog.glb', preset: 'something', tags: ['slow_run'] }, MANIFEST[0]];
    expect(files(['slow_run'], tagged)).toEqual(['idle.glb', 'jog.glb']);
  });
});

describe('presetMapFrom', () => {
  const loaded = (file, preset, tags) => ({ entry: { file, preset, tags }, clip: { name: preset, file } });

  it('keys each clip by its own preset', () => {
    const map = presetMapFrom([loaded('agree.glb', 'agree', ['agree']), loaded('head_shake.glb', 'disagree', ['disagree'])]);
    expect(map.agree.file).toBe('agree.glb');
    expect(map.disagree.file).toBe('head_shake.glb');
  });

  it('lets a clip\'s own preset win over another clip\'s tag, whatever the order', () => {
    const map = presetMapFrom([loaded('jog.glb', 'x', ['walk']), loaded('walk.glb', 'walk', ['walk'])]);
    expect(map.walk.file).toBe('walk.glb');
  });

  it('adds to an existing map without replacing what is there', () => {
    const map = presetMapFrom([loaded('idle.glb', 'idle', ['idle'])]);
    presetMapFrom([loaded('walk.glb', 'walk', ['walk']), loaded('other.glb', 'idle', [])], map);
    expect(map.idle.file).toBe('idle.glb');
    expect(map.walk.file).toBe('walk.glb');
  });
});
