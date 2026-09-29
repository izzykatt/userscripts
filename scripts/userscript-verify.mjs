#!/usr/bin/env node
// Verify a userscript on a real page, in the browser `nix run .#watch` keeps up.
//
//   node scripts/userscript-verify.mjs <url> [--expect <attr>] [--no-scroll]
//                                          [--prefix nix-,nx-]
//
// Four questions, in the order they matter:
//
//   1. Did the script RUN?    (its teardown global exists)
//   2. Did it THROW?          (any exception while the page loaded)
//   3. Did it ARM?            (a data-nix-* attribute on <html>)
//   4. Did the lazy content actually HYDRATE?
//
// (3) is reported, never failed on unless you name the attribute you expect.
// Declining to arm is this repository's contract — the homepage and an empty
// category are meant to render stock. And "armed" is not one bit: leolist's
// DARK THEME arms site-wide while the listings rebuild does not, so on the
// homepage `data-nix-leolist-dark` is present and
// `data-nix-leolist-listings-only` is absent, both correctly. A check for "any
// data-nix-* attribute" passes there and tells you nothing — measured
// 2026-09-29, and it is why this takes a NAME.
// (1) and (2) are failures. So is a broken injected image.
//
// (4) IS WHY THIS COMMAND EXISTS. Measuring straight after load measures an
// unhydrated page. leolist.cc gates its filmstrip on an IntersectionObserver
// and scrolls an inner column, so a filmstrip of 759 photos read as ZERO until
// a real wheel event drove the real scroller (2026-09-29). The wheel step is
// not a nicety here; without it the answer is confidently wrong.

import { readdirSync, readFileSync } from 'node:fs';
import { connect, wheelUntilSettled } from './cdp.mjs';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i === -1 ? d : argv[i + 1]; };
const url = argv.find((a) => /^https?:\/\//.test(a));
const PORT = Number(opt('--port', process.env.USERSCRIPTS_CDP_PORT || '9222'));
const ROOT = process.env.PROJECT_ROOT || process.cwd();

if (!url) {
  console.error('usage: userscript-verify.mjs <url> [--expect <html-attribute>] [--no-scroll] [--port N]');
  process.exit(2);
}

// THE MARKER NAMESPACE IS NOT ONE STRING, AND NOT EVEN ONE PER SCRIPT.
// leolist writes `data-nix-leolist-*`. thumbwall writes a DIFFERENT namespace
// per host module: `data-nx-*` (xnxx/xvideos), `data-ep-*` (eporner),
// `data-xh-*` (xhamster), `data-ph-*` (pornhub). Checking one of them reports a
// clean "not armed" on every host that uses another — which is how three of
// five hosts were briefly written up as broken when they were not
// (2026-09-29). Override with --prefix when a script adds a sixth.
const PREFIXES = String(opt('--prefix', 'nix-,nx-,ep-,xh-,ph-'))
  .split(',').map((p) => p.trim()).filter(Boolean);

// Injected nodes are counted by ATTRIBUTE, not class: thumbwall marks the
// site's own cards with `data-<ns>-card` and injects almost no classes of its
// own. Class matching stays restricted to the two prefixes actually used as
// class names, because `[class*="ph-"]` would match pornhub's own markup and
// `xh-` would match xhamster's.
const CLASS_PREFIXES = PREFIXES.filter((p) => p === 'nix-' || p === 'nx-');
const attrTest = PREFIXES.map((p) => `n.indexOf('data-${p}') === 0`).join(' || ');
const SCAN = `(function(){
  var pre = ${JSON.stringify(PREFIXES.map((p) => `data-${p}`))};
  var cls = ${JSON.stringify(CLASS_PREFIXES)};
  var n = 0;
  var all = document.getElementsByTagName('*');
  for (var i = 0; i < all.length; i++) {
    var el = all[i], hit = false;
    for (var a = 0; a < el.attributes.length && !hit; a++) {
      for (var j = 0; j < pre.length && !hit; j++) {
        if (el.attributes[a].name.indexOf(pre[j]) === 0) hit = true;
      }
    }
    if (!hit && el.className && typeof el.className === 'string') {
      for (var k = 0; k < cls.length && !hit; k++) {
        if (new RegExp('(^|\\s)' + cls[k]).test(el.className)) hit = true;
      }
    }
    if (hit) n++;
  }
  return n;
})()`;
const imgSel = CLASS_PREFIXES.map((p) => `img[class*="${p}"]`).join(',') || 'img.__none__';

const MARKERS = `(function(){
  var imgs = Array.from(document.querySelectorAll('${imgSel}'));
  return JSON.stringify({
    url: location.href,
    ran: Object.getOwnPropertyNames(window).filter(function(k){ return /^__nix.*Teardown$/.test(k); }),
    armed: Array.from(document.documentElement.attributes).map(function(a){ return a.name; })
             .filter(function(n){ return ${attrTest}; }),
    injected: ${SCAN},
    images: imgs.length,
    decoded: imgs.filter(function(i){ return i.complete && i.naturalWidth > 0; }).length,
    // An <img> with no src yet reports complete === true and naturalWidth 0,
    // which is PENDING, not broken. Requiring a non-empty src is what stops
    // this crying wolf at every element the script has created but not yet
    // filled (measured 2026-09-29: 2 "broken" images that were simply empty).
    broken: imgs.filter(function(i){
      var src = i.getAttribute('src') || '';
      return src !== '' && i.complete && i.naturalWidth === 0;
    }).length,
    pending: imgs.filter(function(i){
      return (i.getAttribute('src') || '') === '' || !i.complete;
    }).length
  });
})()`;

// Grows as lazy content hydrates; the wheel step stops when it stops growing.
const MEASURE = `${SCAN} + document.querySelectorAll('${imgSel}').length`;

let version;
try {
  version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
} catch {
  console.error(`no browser on :${PORT} — start one with 'nix run .#watch'.`);
  process.exit(1);
}

const { send, on, close } = await connect(version.webSocketDebuggerUrl);
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

// An injected script has NO source URL — it is `<anonymous>` to the debugger —
// while the site's own scripts all have one. Without that split, a page's own
// error is blamed on the userscript: eporner's video preview throws
// "AbortError: The play() request was interrupted" on its own, and verify
// failed the script for it (measured 2026-09-29).
const thrown = [];
const pageThrown = [];
on((msg) => {
  if (msg.sessionId !== sessionId) return;
  if (msg.method !== 'Runtime.exceptionThrown') return;
  const d = msg.params.exceptionDetails;
  const frame = d.stackTrace?.callFrames?.[0];
  const ours = !d.url && !frame?.url;
  const line = (d.exception?.description || d.text || '').split('\n')[0];
  (ours ? thrown : pageThrown).push(line);
});

await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Page.navigate', { url }, sessionId);
await new Promise((r) => setTimeout(r, Number(opt('--settle', '9000'))));

const read = async () => JSON.parse(
  (await send('Runtime.evaluate', { expression: MARKERS, returnByValue: true }, sessionId)).result.value,
);

const before = await read();
let wheel = null;
if (!flag('--no-scroll')) {
  // Thorough: a verification that stops early reports a number it knows is
  // short. The settle detector still exits in seconds on a page that has
  // nothing lazy.
  wheel = await wheelUntilSettled(send, sessionId, {
    measure: MEASURE,
    maxRounds: Number(opt('--max-rounds', '150')),
  });
  await new Promise((r) => setTimeout(r, 2000));
}
const after = await read();

const scripts = readdirSync(ROOT)
  .filter((f) => f.endsWith('.user.js'))
  .map((f) => /^\/\/\s*@version\s+(\S+)/m.exec(readFileSync(`${ROOT}/${f}`, 'utf8'))?.[1] ?? '?');

const ok = (b) => (b ? 'ok  ' : 'FAIL');
const ran = after.ran.length > 0;
const clean = thrown.length === 0;
const noBroken = after.broken === 0;
const expect = opt('--expect', null);
const armedOk = !expect || after.armed.includes(expect);

console.log(`verify ${after.url}`);
console.log(`  scripts in tree   ${scripts.join(', ')}   markers ${PREFIXES.join(' ')}`);
console.log(`  ${ok(ran)}  ran               ${after.ran.join(', ') || '(no teardown global — the script never executed)'}`);
console.log(`  ${ok(clean)}  threw nothing     ${thrown.slice(0, 3).join(' | ') || 'no exception from the injected script'}`);
if (pageThrown.length) {
  console.log(`  note  page's own errors ${pageThrown.length} (not the script's): ${pageThrown[0].slice(0, 80)}`);
}
console.log(
  `  ${expect ? ok(armedOk) : 'note'}  armed             ` +
    (after.armed.join(', ') ||
      `no ${PREFIXES.map((x) => `data-${x}*`).join(' / ')} attribute — stock, which is the contract unless you expected otherwise`),
);
if (expect && !armedOk) console.log(`        expected          ${expect}`);
if (wheel) {
  console.log(
    `  note  wheel-scrolled    ${wheel.rounds} round(s), hydrated ${wheel.before} -> ${wheel.after}` +
      (wheel.settled ? ' (settled)' : ' — STILL GROWING at --max-rounds, the count below is a floor'),
  );
} else {
  console.log('  note  wheel-scrolled    SKIPPED (--no-scroll) — lazy content is NOT measured');
}
console.log(`  note  injected nodes    ${before.injected} before scroll, ${after.injected} after`);
console.log(
  `  ${ok(noBroken)}  images            ${after.images} total, ${after.decoded} decoded, ` +
    `${after.broken} broken, ${after.pending} pending`,
);

const pass = ran && clean && noBroken && armedOk;

// Close the tab on success, LEAVE IT OPEN on failure. A failed verification is
// the one time you want the page still sitting there to poke at.
if (pass) await send('Target.closeTarget', { targetId });
else console.log(`  note  tab left open    ${after.url}`);

close();
process.exit(pass ? 0 : 1);
