/**
 * Features that exist in the code but are switched off in the interface.
 *
 * Marker AR (AR.js with a printed Hiro or custom marker) works, but nobody is
 * using it, and at a conference it is one more choice on a screen a visitor
 * reaches by scanning a QR code on their phone — where "print this marker"
 * cannot help them. Hidden from the AR menu, the unsupported-device screen and
 * the editor's per-scene marker field. The /ar?mode=marker route and any
 * marker URLs already saved are left alone, so switching this back on is the
 * whole change.
 */
export const MARKER_AR_ENABLED = false;
