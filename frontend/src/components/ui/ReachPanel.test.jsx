import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';

vi.mock('../../api/sceneApi', () => ({
  pingHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
  getStats: vi.fn(),
}));

import { pingHealth } from '../../api/sceneApi';
import ReachPanel from './ReachPanel';

const stats = {
  users: 7, newUsersLast7Days: 2, verifiedUsers: 3, usersWhoCreated: 5,
  usersWhoPublished: 1, scenes: 81, stories: 10, publishedStories: 1,
  storyViews: 42, storyCompletions: 30, signupsByDay: [],
};

// A free host suspends a service nobody visits, and a suspended service cannot
// wake itself — there is no process left to send anything. What does work is a
// request from outside, and a browser with this page open is outside.
describe('keeping the host awake from the dashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    try { localStorage.clear(); } catch { /* ignore */ }
    pingHealth.mockClear();
  });
  afterEach(() => { vi.useRealTimers(); });

  const advance = async (ms) => { await act(async () => { vi.advanceTimersByTime(ms); }); };

  it('does nothing until it is switched on', async () => {
    const onRefresh = vi.fn().mockResolvedValue(stats);
    render(<ReachPanel stats={stats} onRefresh={onRefresh} />);
    await advance(60_000);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('beats as soon as it is switched on, and keeps beating', async () => {
    const onRefresh = vi.fn().mockResolvedValue(stats);
    const { rerender } = render(<ReachPanel stats={stats} onRefresh={onRefresh} />);

    await act(async () => { screen.getByRole('checkbox').click(); });
    rerender(<ReachPanel stats={stats} onRefresh={onRefresh} />);
    // Immediately, so the host is reached without waiting out the first interval.
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await advance(25_000);
    expect(onRefresh).toHaveBeenCalledTimes(2);
    await advance(50_000);
    expect(onRefresh).toHaveBeenCalledTimes(4);
  });

  it('keeps the heartbeat going when the numbers fail', async () => {
    // Keeping the host awake is the half that matters when nobody is watching
    // the figures — an expired token must not stop it.
    const onRefresh = vi.fn().mockRejectedValue(new Error('401'));
    render(<ReachPanel stats={stats} onRefresh={onRefresh} />);

    await act(async () => { screen.getByRole('checkbox').click(); });
    expect(pingHealth).toHaveBeenCalledTimes(1);

    await advance(25_000);
    expect(pingHealth).toHaveBeenCalledTimes(2);
  });

  it('stops the moment it is switched off', async () => {
    const onRefresh = vi.fn().mockResolvedValue(stats);
    render(<ReachPanel stats={stats} onRefresh={onRefresh} />);

    await act(async () => { screen.getByRole('checkbox').click(); });
    await advance(25_000);
    const beats = onRefresh.mock.calls.length;

    await act(async () => { screen.getByRole('checkbox').click(); });
    await advance(120_000);
    expect(onRefresh).toHaveBeenCalledTimes(beats);
  });

  it('remembers the choice, so a reload does not silently stop it', async () => {
    const onRefresh = vi.fn().mockResolvedValue(stats);
    const { unmount } = render(<ReachPanel stats={stats} onRefresh={onRefresh} />);
    await act(async () => { screen.getByRole('checkbox').click(); });
    unmount();

    onRefresh.mockClear();
    render(<ReachPanel stats={stats} onRefresh={onRefresh} />);
    expect(screen.getByRole('checkbox').checked).toBe(true);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
