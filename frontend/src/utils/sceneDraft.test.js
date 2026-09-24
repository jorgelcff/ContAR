import { describe, it, expect, beforeEach } from 'vitest';
import {
  rememberDraft,
  readDraft,
  forgetDraft,
  shouldRestoreDraft,
  DRAFT_KEY,
} from './sceneDraft';

/** A storage that behaves like the real one, including the ways it fails. */
function fakeStorage({ throwOnSet = false } = {}) {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (throwOnSet) throw new DOMException('QuotaExceededError');
      map.set(k, v);
    },
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

const payload = { sceneId: 'abc', metadata: { title: 'Cena 1' } };

describe('rememberDraft', () => {
  let storage;
  beforeEach(() => { storage = fakeStorage(); });

  it('keeps a payload the server refused', () => {
    expect(rememberDraft(payload, { at: 1000, storage })).toBe(true);
    expect(readDraft({ storage })).toEqual({ at: 1000, payload });
  });

  it('refuses a payload with no scene to attach it to', () => {
    expect(rememberDraft({ metadata: {} }, { storage })).toBe(false);
  });

  it('gives up quietly when storage is full rather than throwing at the author', () => {
    expect(rememberDraft(payload, { storage: fakeStorage({ throwOnSet: true }) })).toBe(false);
  });

  it('refuses a payload far larger than any real scene', () => {
    const huge = { sceneId: 'abc', blob: 'x'.repeat(600 * 1024) };
    expect(rememberDraft(huge, { storage })).toBe(false);
    expect(readDraft({ storage })).toBeNull();
  });
});

describe('readDraft', () => {
  it('treats a half-written entry as absent', () => {
    const storage = fakeStorage();
    storage.setItem(DRAFT_KEY, '{"at":1,"payl');
    expect(readDraft({ storage })).toBeNull();
  });

  it('rejects an entry with no scene id', () => {
    const storage = fakeStorage();
    storage.setItem(DRAFT_KEY, JSON.stringify({ at: 1, payload: { metadata: {} } }));
    expect(readDraft({ storage })).toBeNull();
  });

  it('returns null when there is no storage at all', () => {
    expect(readDraft({ storage: null })).toBeNull();
  });
});

describe('forgetDraft', () => {
  it('removes the entry', () => {
    const storage = fakeStorage();
    rememberDraft(payload, { storage });
    forgetDraft({ storage });
    expect(readDraft({ storage })).toBeNull();
  });
});

describe('shouldRestoreDraft', () => {
  const draft = { at: Date.parse('2026-01-10T12:00:00Z'), payload };

  it('restores when the scene has never reached the server', () => {
    expect(shouldRestoreDraft({ draft, sceneId: 'abc', serverUpdatedAt: null })).toBe(true);
  });

  it('restores when the server copy is older than the draft', () => {
    expect(shouldRestoreDraft({
      draft, sceneId: 'abc', serverUpdatedAt: '2026-01-10T11:59:00Z',
    })).toBe(true);
  });

  it('drops the draft when the save got through by another route', () => {
    // Another tab, or a retry that succeeded: restoring would undo real work.
    expect(shouldRestoreDraft({
      draft, sceneId: 'abc', serverUpdatedAt: '2026-01-10T12:00:01Z',
    })).toBe(false);
  });

  it('never restores a draft belonging to a different scene', () => {
    expect(shouldRestoreDraft({ draft, sceneId: 'other' })).toBe(false);
  });

  it('ignores an unparseable server timestamp instead of discarding the work', () => {
    expect(shouldRestoreDraft({
      draft, sceneId: 'abc', serverUpdatedAt: 'not a date',
    })).toBe(true);
  });

  it('is false with nothing to decide about', () => {
    expect(shouldRestoreDraft({})).toBe(false);
    expect(shouldRestoreDraft({ draft, sceneId: '' })).toBe(false);
  });
});
