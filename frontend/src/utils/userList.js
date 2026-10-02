/**
 * The admin's list of accounts: filtering, searching and the CSV export.
 *
 * Kept out of the component so the rules are tested — at an event the list is
 * how you tell who actually built something from who opened the page and left.
 */

export const USER_FILTERS = ['all', 'created', 'published', 'empty'];

/** Did this account make anything at all? */
export function hasCreated(row) {
  return (row.scenes || 0) > 0 || (row.stories || 0) > 0;
}

/**
 * @param {object[]} rows   from GET /api/stats/users
 * @param {object}   opts
 * @param {string}   opts.query   matched against name and email, accent- and case-insensitive
 * @param {string}   opts.filter  one of USER_FILTERS
 */
export function filterUsers(rows, { query = '', filter = 'all' } = {}) {
  const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = fold(query.trim());
  return (rows || []).filter((row) => {
    if (filter === 'created' && !hasCreated(row)) return false;
    if (filter === 'published' && !(row.published > 0)) return false;
    if (filter === 'empty' && hasCreated(row)) return false;
    if (q && !fold(row.name).includes(q) && !fold(row.email).includes(q)) return false;
    return true;
  });
}

/** How many rows each filter would show, for the counts on the chips. */
export function filterCounts(rows) {
  return Object.fromEntries(USER_FILTERS.map((f) => [f, filterUsers(rows, { filter: f }).length]));
}

/**
 * "3 days ago" in the viewer's language, from an ISO date. Days are the useful
 * grain here: an event runs for a few of them.
 */
export function relativeDay(iso, language, now = Date.now()) {
  if (!iso) return '';
  const days = Math.round((new Date(iso).getTime() - now) / 86400000);
  try {
    return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(days, 'day');
  } catch {
    return new Date(iso).toLocaleDateString();
  }
}

const CSV_COLUMNS = ['name', 'email', 'verified', 'createdAt', 'lastActiveAt', 'scenes', 'stories', 'published', 'views'];

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  // A cell starting with = + - @ is run as a formula by spreadsheet apps; a
  // name typed at sign-up must not become one.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV of the given rows, with a header. Opens cleanly in Excel and Sheets. */
export function usersToCsv(rows) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of rows || []) lines.push(CSV_COLUMNS.map((c) => csvCell(row[c])).join(','));
  return lines.join('\r\n');
}
