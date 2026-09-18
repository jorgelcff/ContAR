import { useContext } from 'react';
import { GuestContext } from './guestContextObject';

export function useGuest() {
  return useContext(GuestContext);
}

/**
 * Wraps an action so it only runs for a signed-in user. In guest mode it asks
 * instead — and returns without calling through, so nothing hits an endpoint
 * that would answer 401.
 */
export function useGuestGuard() {
  const { isGuest, invite } = useGuest();
  return (reason, action) => (...args) => {
    if (isGuest) {
      invite(reason);
      return undefined;
    }
    return action(...args);
  };
}
