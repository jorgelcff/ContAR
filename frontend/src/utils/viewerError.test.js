import { describe, it, expect } from 'vitest';
import { classifyViewerError, NOT_FOUND, OFFLINE, SERVER } from './viewerError';

const withStatus = (status) => ({ response: { status } });

describe('why a story would not load', () => {
  it('reads a missing story as missing', () => {
    // The API answers 404 both for a story that does not exist and for one
    // that is not published — deliberately, so ids cannot be probed. From the
    // visitor's side those are the same situation.
    expect(classifyViewerError(withStatus(404))).toBe(NOT_FOUND);
    expect(classifyViewerError(withStatus(400))).toBe(NOT_FOUND);
  });

  it('reads no response at all as a connection problem', () => {
    // The common one on the wifi at an event, and the only one where trying
    // again is likely to work.
    expect(classifyViewerError(new Error('Network Error'))).toBe(OFFLINE);
    expect(classifyViewerError({})).toBe(OFFLINE);
    expect(classifyViewerError(undefined)).toBe(OFFLINE);
  });

  it('separates a broken server from a missing story', () => {
    for (const status of [500, 502, 503]) {
      expect(classifyViewerError(withStatus(status))).toBe(SERVER);
    }
  });

  it('treats a refusal as not available, which is what it means here', () => {
    for (const status of [401, 403, 418]) {
      expect(classifyViewerError(withStatus(status))).toBe(NOT_FOUND);
    }
  });
});
