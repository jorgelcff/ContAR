import { describe, it, expect } from 'vitest';
import { classifyAuthFailure, retryDelay, RETRY_DELAYS_MS, EXPIRED, UNREACHABLE } from './sessionRecovery';

describe('why the session check failed', () => {
  it('only a 401 ends the session', () => {
    // The one case where the server has actually said this token is no good.
    expect(classifyAuthFailure({ response: { status: 401 } })).toBe(EXPIRED);
  });

  it('a host that has not woken up yet is not an expired session', () => {
    // The defect: a cold start returns 502 or never answers, and the token was
    // deleted for it — so reloading did not help either.
    for (const err of [
      new Error('Network Error'),
      { response: { status: 502 } },
      { response: { status: 503 } },
      { response: { status: 504 } },
      {},
      undefined,
    ]) {
      expect(classifyAuthFailure(err)).toBe(UNREACHABLE);
    }
  });

  it('a 403 keeps the session — a valid token being told no is not an invalid one', () => {
    expect(classifyAuthFailure({ response: { status: 403 } })).toBe(UNREACHABLE);
  });
});

describe('how long to keep trying', () => {
  it('spaces attempts out instead of hammering', () => {
    const delays = RETRY_DELAYS_MS;
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i], 'each wait should be at least as long as the last').toBeGreaterThanOrEqual(delays[i - 1]);
    }
  });

  it('covers roughly a cold start in total', () => {
    // A suspended service takes about fifty seconds to come back. Giving up
    // sooner logs someone out for being early.
    const total = RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(45_000);
    // And not so long that a genuinely dead server leaves someone waiting.
    expect(total).toBeLessThanOrEqual(90_000);
  });

  it('stops eventually', () => {
    expect(retryDelay(0)).toBe(RETRY_DELAYS_MS[0]);
    expect(retryDelay(RETRY_DELAYS_MS.length - 1)).toBe(RETRY_DELAYS_MS.at(-1));
    expect(retryDelay(RETRY_DELAYS_MS.length)).toBeNull();
    expect(retryDelay(999)).toBeNull();
  });
});
