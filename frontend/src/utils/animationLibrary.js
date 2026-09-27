import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { attachSourceRestPose, holdPoseClip } from '../controllers/AnimationController';
import { ANIMATED_PRESETS, ANIMATION_FALLBACK_CHAIN } from './posePresets';

/**
 * The animation clips in /animations/manifest.json, fetched only when a pose
 * needs them.
 *
 * Every viewer, editor and AR page used to download the whole manifest on
 * load: thirteen files, 14.4 MB, of which a story typically uses one or two —
 * measured on a four-scene story using idle, speaker and walk, the clips it
 * needed came to 0.26 MB (speaker is procedural and needs none). On a
 * conference's wifi that was the difference between the next scene arriving
 * and not.
 *
 * Each file is fetched and prepared once per page and shared: the editor's
 * canvas, the story viewer's preloading of the next scene, and the AR views all
 * read the same cache, so nothing comes down twice.
 */

const manifestUrl = () => `${import.meta.env.BASE_URL}animations/manifest.json`;
const fileUrl = (file) => `${import.meta.env.BASE_URL}animations/${file}`;

/** idle is the fallback for every animated pose, and weighs about 0.1 MB. */
const ALWAYS = ['idle'];

let manifestPromise = null;

/** @returns {Promise<Array<{name?: string, file: string, preset?: string, tags?: string[]}>>} */
export function loadManifestEntries() {
  if (!manifestPromise) {
    manifestPromise = fetch(manifestUrl())
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((m) => (Array.isArray(m?.animations) ? m.animations.filter((a) => a?.file) : []));
  }
  return manifestPromise;
}

/** Does this manifest entry answer for `preset`? By its preset, or an exact tag. */
function servesPreset(entry, preset) {
  if (String(entry.preset || entry.name || '').toLowerCase() === preset) return true;
  // Exact, never includes(): "disagree" contains "agree", "slow_run" contains
  // "run", "walk_circle" contains "walk".
  return (entry.tags || []).some((t) => String(t).toLowerCase() === preset);
}

/**
 * Which manifest entries these presets actually need.
 *
 * A preset with a clip of its own gets that clip. One without falls back along
 * the same chain the player uses (run → slow_run → walk), so only the clip that
 * will really play is fetched rather than the whole chain. Poses posed from
 * code or driven procedurally need no clip. idle is always included: it is the
 * player's last resort, and tiny.
 */
export function entriesForPresets(entries, presets) {
  const wanted = new Set(ALWAYS);
  for (const raw of presets || []) {
    const preset = String(raw || '').toLowerCase();
    if (!ANIMATED_PRESETS.includes(preset)) continue;
    const chain = [preset, ...(ANIMATION_FALLBACK_CHAIN[preset] || [])];
    const found = chain.find((p) => entries.some((e) => servesPreset(e, p)));
    if (found) wanted.add(found);
  }
  return entries.filter((e) => [...wanted].some((p) => servesPreset(e, p)));
}

/**
 * The { preset: clip } map the player looks clips up in, from loaded entries.
 * First come, first served per preset — the same rule the manifest loaders
 * always used — with a clip's own preset taking its slot before any tag does.
 */
export function presetMapFrom(loaded, into = {}) {
  const map = into;
  for (const { entry, clip } of loaded) {
    const own = String(entry.preset || entry.name || '').toLowerCase();
    if (own && !map[own]) map[own] = clip;
  }
  for (const { entry, clip } of loaded) {
    for (const preset of ANIMATED_PRESETS) {
      if (!map[preset] && (entry.tags || []).some((t) => String(t).toLowerCase() === preset)) {
        map[preset] = clip;
      }
    }
  }
  return map;
}

let loader = null;
function getLoader() {
  if (!loader) {
    loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.setCrossOrigin('anonymous');
  }
  return loader;
}

/** file → Promise<{entry, clip} | null>. One fetch per file per page. */
const byFile = new Map();

function loadEntry(entry) {
  if (!byFile.has(entry.file)) {
    byFile.set(entry.file, new Promise((resolve) => {
      getLoader().load(
        fileUrl(entry.file),
        (gltf) => {
          const clip = gltf.animations?.[0];
          if (!clip) { resolve(null); return; }
          attachSourceRestPose(clip, gltf.scene);
          holdPoseClip(clip);
          clip.name = entry.preset || entry.name || clip.name || entry.file;
          resolve({ entry, clip });
        },
        undefined,
        () => {
          // Forget a failure, so a later request can try again.
          byFile.delete(entry.file);
          resolve(null);
        },
      );
    }));
  }
  return byFile.get(entry.file);
}

/**
 * Loads (or reuses) the clips these presets need.
 * @returns {Promise<Array<{entry: object, clip: import('three').AnimationClip}>>}
 */
export async function loadClipsForPresets(presets) {
  const entries = await loadManifestEntries();
  const results = await Promise.all(entriesForPresets(entries, presets).map(loadEntry));
  return results.filter(Boolean);
}

/** Fire-and-forget: warm the cache for poses coming up. */
export function preloadPresets(presets) {
  loadClipsForPresets(presets).catch(() => {});
}
