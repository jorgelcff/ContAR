#!/usr/bin/env node
/**
 * Fails the build if the entry bundle grows back to shipping the 3D engine.
 *
 * Every page used to be imported eagerly in App.jsx, so ARPage dragged three.js
 * and its loaders into the entry chunk and opening the landing page downloaded
 * ~1.5 MB of JavaScript — nearly all of it a renderer the visitor had not asked
 * for. The routes are split now; this keeps them that way, because a regression
 * is invisible in the UI and would only surface as a slow first load on a
 * student's phone.
 *
 * Measured the way the browser actually pays for it: the entry module plus
 * everything index.html tells it to preload. Deliberately loose — this is here
 * to catch the 3D stack landing back in the entry, not to police normal growth.
 */
import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const BUDGET_KB = 700;

const html = readFileSync(join(DIST, 'index.html'), 'utf8');

// The entry <script type="module"> and every modulepreload beside it are all
// fetched before the first route renders.
const eager = [
  ...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g),
].map((m) => m[1]);

if (!eager.length) {
  console.error('[bundle] could not find the entry script in dist/index.html');
  process.exit(1);
}

let total = 0;
for (const href of eager) {
  // Hrefs are site-absolute (and carry VITE_BASE_PATH when set); dist is flat.
  total += statSync(join(DIST, href.replace(/^.*\/assets\//, 'assets/'))).size;
}

const kb = total / 1024;
const summary = `${kb.toFixed(0)} KB across ${eager.length} file(s), budget ${BUDGET_KB} KB`;

if (kb > BUDGET_KB) {
  console.error(`[bundle] entry bundle too large — ${summary}`);
  console.error('[bundle] something heavy is imported eagerly; lazy-load it in App.jsx.');
  process.exit(1);
}
console.log(`[bundle] entry bundle ok — ${summary}`);
