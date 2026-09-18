/**
 * Removes accounts left behind by test runs, and everything they own.
 *
 * Test users reached the production database before the E2E suite was moved
 * onto its own ports and its own in-memory database. This clears the residue.
 *
 *   node scripts/purge-test-accounts.js             # shows what would go
 *   node scripts/purge-test-accounts.js --confirm   # actually deletes
 *
 * It refuses to delete without --confirm, on purpose: the default is a report.
 *
 * Which accounts qualify is decided by the address's domain, not by a list
 * typed out by hand. example.com and .local are reserved by RFC 2606 / RFC 6761
 * precisely so they can never belong to anybody — an address there cannot be a
 * real person's, whoever created it and whenever. A hand-written list would
 * quietly stop matching the next time the suite invents a new prefix.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Scene = require('../models/Scene');
const Story = require('../models/Story');

const confirmed = process.argv.includes('--confirm');

// Reserved domains that cannot route anywhere. Anchored, so "example.com.br"
// or "nottest.local" do not match.
const DISPOSABLE = [/@example\.(com|org|net)$/i, /@test\.local$/i, /@example\.invalid$/i];
const isDisposable = (email) => DISPOSABLE.some((re) => re.test(String(email || '')));

function describeTarget(uri) {
  const m = /@([^/?]+)\/?([^?]*)/.exec(uri);
  return `${m ? m[1] : 'unknown host'}${m && m[2] ? `/${m[2]}` : ''}`;
}

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set — nothing to connect to.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Banco: ${describeTarget(uri)}\n`);

  const all = await User.find({}, { email: 1, name: 1, createdAt: 1 }).lean();
  const doomed = all.filter((u) => isDisposable(u.email));
  const kept = all.filter((u) => !isDisposable(u.email));
  const doomedIds = doomed.map((u) => String(u._id));

  // Print what survives as well as what goes. The reassuring half of a
  // destructive operation is the list it is NOT touching.
  console.log(`MANTIDAS (${kept.length}):`);
  for (const u of kept) console.log(`  ✓ ${u.email}${u.name ? `  — ${u.name}` : ''}`);

  if (!doomed.length) {
    console.log('\nNada a remover.');
    await mongoose.disconnect();
    return;
  }

  const [scenes, stories] = await Promise.all([
    Scene.find({ ownerId: { $in: doomedIds } }, { sceneId: 1, ownerId: 1 }).lean(),
    Story.find({ ownerId: { $in: doomedIds } }, { storyId: 1, ownerId: 1, isPublic: 1 }).lean(),
  ]);

  console.log(`\nA REMOVER (${doomed.length} contas, ${scenes.length} cenas, ${stories.length} histórias):`);
  for (const u of doomed) {
    const s = scenes.filter((x) => x.ownerId === String(u._id)).length;
    const h = stories.filter((x) => x.ownerId === String(u._id)).length;
    console.log(`  ✗ ${u.email}  (${s} cena(s), ${h} história(s))`);
  }

  const published = stories.filter((s) => s.isPublic);
  if (published.length) {
    console.log(`\n  Atenção: ${published.length} dessas histórias estão publicadas e seus links vão parar de funcionar.`);
  }

  if (!confirmed) {
    console.log('\nNada foi apagado. Para executar de verdade:');
    console.log('  node scripts/purge-test-accounts.js --confirm');
    await mongoose.disconnect();
    return;
  }

  // Content first: an account removed before its rows would leave them
  // ownerless and no longer selectable by this script.
  const sceneResult = await Scene.deleteMany({ ownerId: { $in: doomedIds } });
  const storyResult = await Story.deleteMany({ ownerId: { $in: doomedIds } });
  const userResult = await User.deleteMany({ _id: { $in: doomedIds } });

  console.log('\nRemovido:');
  console.log(`  ${userResult.deletedCount} conta(s)`);
  console.log(`  ${sceneResult.deletedCount} cena(s)`);
  console.log(`  ${storyResult.deletedCount} história(s)`);

  const left = await User.countDocuments({});
  console.log(`\n${left} conta(s) restante(s).`);

  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('Falhou:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
