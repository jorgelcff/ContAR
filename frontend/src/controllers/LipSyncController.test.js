import { describe, it, expect } from 'vitest';
import { LipSyncController } from './LipSyncController';

// Minimal stand-ins: the controller only reads `isMesh`, `morphTargetDictionary`
// and `morphTargetInfluences`, and walks the tree via `traverse`.
function fakeMesh(name, morphNames) {
  const dict = {};
  morphNames.forEach((n, i) => { dict[n] = i; });
  return {
    isMesh: true,
    name,
    morphTargetDictionary: dict,
    morphTargetInfluences: morphNames.map(() => 0),
  };
}

function fakeModel(meshes) {
  return {
    traverse(cb) {
      cb({ isMesh: false, name: 'root' });
      meshes.forEach(cb);
    },
  };
}

// Taken verbatim from a VALID avatar's rig report.
const VALID_FACE = [
  'h_expressions.AE_AA_h', 'h_expressions.AO_a_h', 'h_expressions.Ax_E_h',
  'h_expressions.TD_I_h', 'h_expressions.UH_OO_h', 'h_expressions.UW_U_h',
  'h_expressions.FV_h', 'h_expressions.S_h', 'h_expressions.SH_CH_h',
  'h_expressions.MPB_Up_h', 'h_expressions.MPB_Down_h', 'h_expressions.KG_h',
  'h_expressions.MouthOpen_h', 'h_expressions.RsmileOpen_h',
  'h_expressions.LeyeClose_h', 'h_expressions.RbrowUp_h',
];
const VALID_TEETH = ['t_AE_AA_h', 't_FV_h', 't_MPB_h', 't_MouthOpen_h'];

describe('LipSyncController viseme discovery', () => {
  it('maps a VALID rig\'s phoneme blendshapes onto the viseme groups', () => {
    const ctl = new LipSyncController(fakeModel([
      fakeMesh('H_DDS_HighRes', VALID_FACE),
      fakeMesh('h_TeethDown', VALID_TEETH),
    ]));

    // Every group the runtime drives must have found something — previously
    // only mouthOpen/aa matched and the rest were empty.
    for (const group of ['aa', 'oh', 'ee', 'fv', 'mbp', 'mouthOpen']) {
      expect(ctl.getGroupTargets(group).length, `group ${group}`).toBeGreaterThan(0);
    }

    const names = (g) => ctl.getGroupTargets(g).map((t) => t.name);
    expect(names('fv')).toContain('h_expressions.FV_h');
    expect(names('mbp')).toContain('h_expressions.MPB_Up_h');
    expect(names('oh')).toContain('h_expressions.UW_U_h');
    // The teeth copies ride along so they follow the mouth.
    expect(names('fv')).toContain('t_FV_h');
  });

  it('does not pull in eyes or brows', () => {
    const ctl = new LipSyncController(fakeModel([fakeMesh('H_DDS_HighRes', VALID_FACE)]));
    const all = ['aa', 'oh', 'ee', 'fv', 'mbp', 'mouthOpen']
      .flatMap((g) => ctl.getGroupTargets(g).map((t) => t.name));
    expect(all).not.toContain('h_expressions.LeyeClose_h');
    expect(all).not.toContain('h_expressions.RbrowUp_h');
  });

  it('leaves ARKit-named rigs matching exactly as before', () => {
    // The VALID patterns are anchored on a trailing `_h`, so a Ready Player Me
    // style rig must be unaffected by them.
    const arkit = ['viseme_aa', 'viseme_O', 'viseme_FF', 'viseme_PP', 'jawOpen', 'mouthSmile'];
    const ctl = new LipSyncController(fakeModel([fakeMesh('Wolf3D_Head', arkit)]));

    expect(ctl.getGroupTargets('aa').map((t) => t.name)).toEqual(['viseme_aa', 'jawOpen']);
    expect(ctl.getGroupTargets('fv').map((t) => t.name)).toEqual(['viseme_FF']);
    expect(ctl.getGroupTargets('mbp').map((t) => t.name)).toEqual(['viseme_PP']);
  });
});
