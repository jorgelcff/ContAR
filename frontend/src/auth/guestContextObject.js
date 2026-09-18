import { createContext } from 'react';

/** See GuestContext.jsx for what guest mode is and why it exists. */
export const GuestContext = createContext({ isGuest: false, invite: () => {}, invitation: '', dismiss: () => {} });
