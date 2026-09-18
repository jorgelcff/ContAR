import React, { useEffect, useMemo, useState } from 'react';
import { onUnauthorized } from '../api/sceneApi';
import { GuestContext } from './guestContextObject';

/**
 * Trying the editor without an account.
 *
 * The one place the funnel leaked hardest: someone watches a story, taps
 * "make your own", and lands on a sign-up form having never touched anything.
 * At a stand that is where almost everyone stops. In guest mode the editor
 * runs on the bundled demo character with the browser's own voice, so a
 * visitor can change the words and hear the character say them before being
 * asked for anything.
 *
 * What still needs an account is exactly what needs the server: keeping the
 * work, publishing it, the paid voices, uploading files. Those call `invite`
 * instead, which asks — once the person has already seen it work.
 */

export function GuestProvider({ isGuest = false, children }) {
  const [invitation, setInvitation] = useState('');

  const value = useMemo(() => ({
    isGuest,
    invitation,
    // `reason` names the thing they just tried to do, so the ask is about
    // their work rather than a generic wall.
    invite: (reason = '') => setInvitation(reason || 'generic'),
    dismiss: () => setInvitation(''),
  }), [isGuest, invitation]);

  // The safety net: anything a guest triggers that needs the server comes back
  // 401, and that is the invitation rather than an error nobody can act on.
  useEffect(() => {
    if (!isGuest) return undefined;
    return onUnauthorized(() => setInvitation((current) => current || 'generic'));
  }, [isGuest]);

  return <GuestContext.Provider value={value}>{children}</GuestContext.Provider>;
}
