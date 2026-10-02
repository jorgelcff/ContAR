/**
 * Lists the accounts on whichever database MONGODB_URI points at, with enough
 * context to tell a real person from a throwaway: whether they confirmed their
 * address, and whether they actually built anything.
 *
 * Read-only by construction — it opens no write, and is the thing to run
 * before any cleanup rather than guessing what is in there.
 *
 *   node scripts/list-users.js            # everyone, oldest first
 *   node scripts/list-users.js --empty    # only accounts that made nothing
 *   node scripts/list-users.js --json     # for piping somewhere
 *
 * Never prints MONGODB_URI: it carries the password.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { buildUserRows } = require('../controllers/statsController');

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const onlyEmpty = args.has('--empty');

function describeTarget(uri) {
  const m = /@([^/?]+)\/?([^?]*)/.exec(uri);
  return `${m ? m[1] : 'unknown host'}${m && m[2] ? `/${m[2]}` : ''}`;
}

function ago(date) {
  if (!date) return '—';
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  return `${days}d atrás`;
}

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set — nothing to connect to.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Banco: ${describeTarget(uri)}\n`);

  // Oldest first here, as this script always printed; the dashboard shows newest first.
  const rows = (await buildUserRows()).reverse();

  const shown = onlyEmpty ? rows.filter((r) => !r.scenes && !r.stories) : rows;

  if (asJson) {
    console.log(JSON.stringify(shown, null, 2));
  } else {
    const pad = (s, n) => String(s).padEnd(n).slice(0, n);
    console.log(
      `${pad('EMAIL', 34)} ${pad('NOME', 14)} ${pad('CONF', 5)} ${pad('CENAS', 6)} ${pad('HIST', 5)} ${pad('PUB', 4)} ${pad('VIEWS', 6)} CRIADO`,
    );
    console.log('-'.repeat(96));
    for (const r of shown) {
      console.log(
        `${pad(r.email, 34)} ${pad(r.name, 14)} ${pad(r.verified ? 'sim' : 'não', 5)} ` +
        `${pad(r.scenes, 6)} ${pad(r.stories, 5)} ${pad(r.published, 4)} ${pad(r.views, 6)} ${ago(r.createdAt)}`,
      );
    }
  }

  const made = rows.filter((r) => r.scenes || r.stories).length;
  console.log(
    `\n${rows.length} conta(s) · ${rows.filter((r) => r.verified).length} confirmada(s) · ` +
    `${made} que criaram algo · ${rows.length - made} que não criaram nada`,
  );
  if (onlyEmpty) console.log(`(mostrando ${shown.length} sem nada criado)`);

  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('Falhou:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
