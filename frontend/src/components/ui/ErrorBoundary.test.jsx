import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

// There was no boundary anywhere in the app: any throw during render unmounted
// the whole tree and left a white page, with no message and no way back short
// of the browser's reload button.
function Boom({ explode = true }) {
  if (explode) throw new Error('rig has no skeleton');
  return <p>rendered fine</p>;
}

describe('ErrorBoundary', () => {
  let consoleError;
  beforeEach(() => { consoleError = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { consoleError.mockRestore(); });

  it('renders its children when nothing is wrong', () => {
    render(<ErrorBoundary><Boom explode={false} /></ErrorBoundary>);
    expect(screen.getByText('rendered fine')).toBeTruthy();
  });

  it('catches the throw and shows something to act on, not a blank page', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeTruthy();
    // "Something went wrong" with no detail is the least useful error screen
    // there is — the actual message has to survive.
    expect(screen.getByText(/rig has no skeleton/)).toBeTruthy();
  });

  it('still reports the failure to the console', () => {
    // A boundary that swallows the stack trades a white page for a silent one.
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(consoleError).toHaveBeenCalled();
  });

  it('gives the content another chance when asked', () => {
    function Flaky({ shouldThrow }) {
      if (shouldThrow.current) throw new Error('first time only');
      return <p>recovered</p>;
    }
    const shouldThrow = { current: true };
    render(<ErrorBoundary><Flaky shouldThrow={shouldThrow} /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeTruthy();

    shouldThrow.current = false;
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('recovered')).toBeTruthy();
  });

  it('clears itself when the thing that failed is replaced', () => {
    // Loading a different avatar must not keep showing the previous one's
    // failure — a latched boundary would need a page reload to escape.
    const { rerender } = render(
      <ErrorBoundary resetKey="avatar-a"><Boom /></ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();

    rerender(
      <ErrorBoundary resetKey="avatar-b"><Boom explode={false} /></ErrorBoundary>,
    );
    expect(screen.getByText('rendered fine')).toBeTruthy();
  });

  it('offers a way home from a full-page failure, and not from a canvas one', () => {
    const { unmount } = render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole('link')).toBeTruthy();
    unmount();

    render(<ErrorBoundary compact><Boom /></ErrorBoundary>);
    // The canvas is one part of a working screen; sending someone home from it
    // would throw away the scene they are editing.
    expect(screen.queryByRole('link')).toBeNull();
  });
});
