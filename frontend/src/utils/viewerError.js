/**
 * What went wrong loading a story, in the terms that decide what to offer.
 *
 * The viewer used to render whatever string the server sent, in red, centred,
 * alone — "Story not found", in English, to whoever had just scanned a QR code
 * off a poster. That is a dead end at the one moment someone is standing there
 * wanting to see the thing.
 *
 * The three cases want different offers, so they have to be told apart:
 * a story that is not there is permanent and wants somewhere else to go; a
 * connection that failed is worth retrying; a server that broke is worth
 * retrying later.
 */
export const NOT_FOUND = 'notFound';
export const OFFLINE = 'offline';
export const SERVER = 'server';

export function classifyViewerError(err) {
  const status = err?.response?.status;

  // No response at all: the request never made it. On the wifi at an event
  // this is the common one, and it is the one worth a retry button.
  if (!err?.response) return OFFLINE;

  if (status === 404 || status === 400) return NOT_FOUND;
  if (status >= 500) return SERVER;

  // 401/403 and anything else unexpected: the story is not available to this
  // person, which from where they are standing is the same as not there.
  return NOT_FOUND;
}
