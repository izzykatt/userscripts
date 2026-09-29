#!/usr/bin/env node
// Verify a userscript on a real page, in the browser `nix run .#watch` keeps up.
//
//   node scripts/userscript-verify.mjs <url> [--expect <attr>] [--no-scroll]
//                                          [--prefix nix-,nx-]
//                                          [--gate '<gridSel>,<unitHref>']
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
//
// --gate ANSWERS "WHY NOT?" WHEN A SCRIPT DECLINES. It replays a grid-gallery
// gate signal by signal: how many grids the selector matches, and for each —
// renders, child count, unit count, rows, organic share — then whether a pager
// was found and whether it sits inside the winning grid.
//
// IT TAKES THE SELECTORS RATHER THAN KNOWING THEM. thumbwall alone has four
// modules with four sets of constants, and not even the same variable names,
// so a built-in copy would be stale the week after it was written. Read them
// out of the script and pass them:
//
//   --gate 'ul.videos,/view_video.php'     (pornhub)
//   --gate 'div.thumb-list,/videos/'       (xhamster)
//
// AND IF THE REPLICA DISAGREES WITH THE SCRIPT, THE REPLICA IS WRONG. A gate
// reporting "all signals pass" while the script declines means the measurement
// is off, not the script — which is exactly how three working thumbwall
// modules got written up as broken (2026-09-29). Check the constants and the
// --expect attribute before believing it.

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

// ── the gate replica ─────────────────────────────────────────────────────────

const gateSpec = opt('--gate', null);
const gateExpr = (gridSel, unitHref, [unitsMin, rowsMin, shareMin]) => `(function(){
  var GRID_SEL = ${JSON.stringify(gridSel)}, UNIT_HREF = ${JSON.stringify(unitHref)};
  var UNITS_MIN = ${unitsMin}, ROWS_MIN = ${rowsMin}, SHARE_MIN = ${shareMin};
  var renders = function(el){ var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    var r = el.getBoundingClientRect(); return r.width > 300 && r.height > 150; };
  var isUnit = function(el){ return !!el.querySelector('a[href*="' + UNIT_HREF + '"]'); };
  var rowsOf = function(el){ var ys = new Set();
    for (var kid of el.children){ var r = kid.getBoundingClientRect(); if (r.height > 20) ys.add(Math.round(r.top/10)); }
    return ys.size; };
  var PAGE_TOKEN = /(?:[?&](?:p|page|from)=\\d+)|(?:\\/\\d{1,4}(?:\\/|$))|(?:-\\d{1,4}(?:\\/|$))/;
  var pagedTargets = function(el){
    var anchors = Array.from(el.querySelectorAll('a[href]'));
    if (!anchors.length || anchors.length > 60) return null;
    for (var a of anchors) if ((a.getAttribute('href')||'').includes(UNIT_HREF)) return null;
    var seen = new Set();
    for (var b of anchors){ var u; try { u = new URL(b.getAttribute('href')||'', location.href); } catch(e){ continue; }
      var t = u.pathname + u.search; if (PAGE_TOKEN.test(t)) seen.add(t); }
    return { total: anchors.length, targets: seen.size }; };
  var PAGER_NAMED = '.pagination,[class*="pagin"],[class*="pager"],[class*="page-list"],[class*="load-more"]';
  var named = 0, pager = null;
  for (var el of document.querySelectorAll(PAGER_NAMED)) { named++;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.getBoundingClientRect().height <= 4) continue;
    var p = pagedTargets(el); if (p && p.targets >= 1) { pager = el; break; } }
  var fallback = 0;
  if (!pager) { for (var e2 of document.querySelectorAll('div,nav,ul,section')) {
    var c2 = getComputedStyle(e2);
    if (c2.display === 'none' || c2.visibility === 'hidden') continue;
    if (e2.getBoundingClientRect().height <= 4) continue;
    var p2 = pagedTargets(e2);
    if (p2 && p2.targets >= 3 && p2.targets / p2.total >= 0.5) fallback++; } }
  var grids = Array.from(document.querySelectorAll(GRID_SEL));
  var rows = grids.slice(0, 8).map(function(g){
    var kids = Array.from(g.children), units = kids.filter(isUnit);
    var share = kids.length ? units.length / kids.length : 0;
    return { renders: renders(g), kids: kids.length, units: units.length, rows: rowsOf(g),
             share: +share.toFixed(2),
             passes: renders(g) && kids.length >= UNITS_MIN && units.length >= UNITS_MIN
                     && rowsOf(g) >= ROWS_MIN && share >= SHARE_MIN }; });
  var best = null;
  for (var g3 of grids) {
    var k3 = Array.from(g3.children), u3 = k3.filter(isUnit);
    var s3 = k3.length ? u3.length / k3.length : 0;
    if (!renders(g3) || k3.length < UNITS_MIN || u3.length < UNITS_MIN) continue;
    if (rowsOf(g3) < ROWS_MIN || s3 < SHARE_MIN) continue;
    if (!best || u3.length > best.n) best = { el: g3, n: u3.length }; }
  return JSON.stringify({
    gridSelMatches: grids.length, grids: rows,
    pagerNamedCandidates: named, pagerFound: !!pager, pagerFallbackCandidates: fallback,
    pagerInsideGrid: (best && pager) ? best.el.contains(pager) : null,
    unitHrefsOnPage: document.querySelectorAll('a[href*="' + UNIT_HREF + '"]').length,
    verdict: !pager ? 'no pager found'
      : !best ? 'no grid passes unit/row/share'
      : best.el.contains(pager) ? 'pager sits INSIDE the winning grid'
      : 'all signals pass' });
})()`;

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

if (gateSpec) {
  const [gridSel, unitHref] = gateSpec.split(',').map((x) => x.trim());
  const th = String(opt('--gate-thresholds', '4,2,0.5')).split(',').map(Number);
  if (!gridSel || !unitHref) {
    console.log("  note  gate              --gate needs '<gridSelector>,<unitHref>' read from the script's own source");
  } else {
    const g = JSON.parse(
      (await send('Runtime.evaluate', { expression: gateExpr(gridSel, unitHref, th), returnByValue: true }, sessionId))
        .result.value,
    );
    console.log(`  note  gate              ${gridSel} + ${unitHref}  (units>=${th[0]} rows>=${th[1]} share>=${th[2]})`);
    console.log(`        verdict           ${g.verdict}`);
    console.log(`        grids matched     ${g.gridSelMatches}, passing ${g.grids.filter((r) => r.passes).length}`);
    for (const r of g.grids) {
      console.log(
        `          ${r.passes ? 'pass' : '    '}  renders=${r.renders} kids=${r.kids} units=${r.units}` +
          ` rows=${r.rows} share=${r.share}`,
      );
    }
    console.log(
      `        pager             found=${g.pagerFound} (named ${g.pagerNamedCandidates},` +
        ` fallback ${g.pagerFallbackCandidates}), insideGrid=${g.pagerInsideGrid}`,
    );
    console.log(`        unit links        ${g.unitHrefsOnPage} matching ${unitHref}`);
    if (g.verdict === 'all signals pass' && after.armed.length === 0) {
      console.log('        SUSPECT THE REPLICA, NOT THE SCRIPT — a gate that passes while the');
      console.log('        script declines means wrong constants or a wrong --expect attribute.');
    }
  }
}

const pass = ran && clean && noBroken && armedOk;

// Close the tab on success, LEAVE IT OPEN on failure. A failed verification is
// the one time you want the page still sitting there to poke at.
if (pass) await send('Target.closeTarget', { targetId });
else console.log(`  note  tab left open    ${after.url}`);

close();
process.exit(pass ? 0 : 1);
