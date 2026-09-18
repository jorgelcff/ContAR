/**
 * Telling "your session ended" apart from "the server is not answering yet".
 *
 * The session check treated every failure the same: any error at all deleted
 * the stored token and dropped the person at the login screen. On a host that
 * suspends itself after a quiet spell, the first visitor back pays a cold
 * start — the request times out or comes back 502 while the service boots —
 * and was logged out for it, with the token thrown away so reloading did not
 * help either. Bad venue wifi did the same thing.
 *
 * Only the server is entitled to end a session, and it says so with 401.
 * Everything else means "ask again in a moment".
 */
export const EXPIRED = 'expired';
export const UNREACHABLE = 'unreachable';

export function classifyAuthFailure(err) {
  const status = err?.response?.status;
  // 401 is the server rejecting this token; 403 is a valid token being told
  // no, which is not a reason to throw it away.
  if (status === 401) return EXPIRED;
  return UNREACHABLE;
}

/**
 * Spaced out to cover a cold start without hammering: roughly fifty seconds in
 * total, which is about what a suspended service takes to come back, spread
 * over six tries rather than sixty.
 */
export const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 20000];

export function retryDelay(attempt) {
  if (attempt < 0) return null;
  return attempt < RETRY_DELAYS_MS.length ? RETRY_DELAYS_MS[attempt] : null;
}
