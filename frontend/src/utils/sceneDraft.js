/**
 * Keeping a scene the server refused to take.
 *
 * The editor autosaves, so "your work is safe" is the promise the interface
 * makes. It was not true in two places, and both are the same failure the
 * author sees as "check your connection":
 *
 *   - A failed autosave left the payload in a ref and nothing else. The timer
 *     only re-arms on the next edit, so an author who typed a line, got the
 *     warning and walked away lost the line.
 *   - Opening a scene clears the store *before* fetching, so the fetch can fail
 *     onto an editor that has already been emptied — and since the store is
 *     persisted, the empty version is what survives the reload.
 *
 * So the rule here is: a save that did not reach the server leaves a draft
 * behind, and the draft outranks the server copy only while the server has
 * nothing newer. If the save actually landed somewhere else (another tab, a
 * retry that succeeded), the server's own `updatedAt` moves past the draft and
 * the draft is dropped rather than resurrecting stale text over fresh text.
 */

export const DRAFT_KEY = 'contar:unsaved-scene';

/** Well past any real scene; a payload this large is a symptom, not a scene. */
const MAX_DRAFT_BYTES = 512 * 1024;

function storageOf(storage) {
  if (storage) return storage;
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Blocked storage (private mode, site data off) throws on access, not on use.
    return null;
  }
}

/**
 * Keep a payload the server did not accept. Returns whether it was kept —
 * false is a normal outcome (no storage, quota full, payload too big), never
 * a reason to interrupt the author.
 */
export function rememberDraft(payload, { at = Date.now(), storage } = {}) {
  const store = storageOf(storage);
  if (!store || !payload?.sceneId) return false;
  try {
    const serialized = JSON.stringify({ at, payload });
    if (serialized.length > MAX_DRAFT_BYTES) return false;
    store.setItem(DRAFT_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

/** @returns {{at: number, payload: object}|null} */
export function readDraft({ storage } = {}) {
  const store = storageOf(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.payload?.sceneId || !Number.isFinite(Number(parsed.at))) return null;
    return { at: Number(parsed.at), payload: parsed.payload };
  } catch {
    // Corrupt or half-written entry — treat it as absent rather than throwing
    // inside the load path and taking the whole editor down with it.
    return null;
  }
}

export function forgetDraft({ storage } = {}) {
  const store = storageOf(storage);
  if (!store) return;
  try {
    store.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to do — a draft we cannot clear is harmless once it is stale */
  }
}

/**
 * Should this draft be put back on screen instead of what the server sent?
 *
 * `serverUpdatedAt` being absent means the scene has never been saved, so
 * there is nothing the draft could be older than.
 */
export function shouldRestoreDraft({ draft, sceneId, serverUpdatedAt } = {}) {
  if (!draft?.payload || !sceneId) return false;
  if (draft.payload.sceneId !== sceneId) return false;

  if (serverUpdatedAt) {
    const serverTime = Date.parse(serverUpdatedAt);
    // A server copy at least as new as the draft means the work got through by
    // some other route; restoring would undo it.
    if (Number.isFinite(serverTime) && serverTime >= draft.at) return false;
  }
  return true;
}
