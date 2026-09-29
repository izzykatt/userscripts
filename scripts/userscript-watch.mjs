#!/usr/bin/env node
// Live userscript injection over the Chrome DevTools Protocol.
//
// WHAT IT IS. A userscript manager copies a file into extension storage and
// runs it at document-start on every matching page. This does the same thing
// through CDP: `Page.addScriptToEvaluateOnNewDocument`, gated in-page by the
// script's own @match patterns. Save the file, the page comes back with the new
// code — no manager, no clicks, no install.
//
// WHY THAT IS FAITHFUL HERE, AND WHEN IT STOPS BEING. CLAUDE.md § "Injecting is
// not installing" lists what a `Runtime.evaluate` injection gets wrong. The two
// that matter are handled:
//
//   * @run-at document-start. addScriptToEvaluateOnNewDocument runs BEFORE any
//     page script on every navigation, which is exactly what a manager does —
//     unlike evaluating into an already-painted page, where a document-start
//     gate has nothing left to gate.
//   * @match / @noframes. Compiled into the wrapper and evaluated in-page
//     against location.href, so every other page is left stock, as installed.
//
// What it still cannot do is provide manager APIs. Every script in this
// repository is `@grant none`, so nothing is missing — and if one ever grants
// something, this refuses to inject it rather than pretend.
//
// A SAVE THAT DOES NOT PARSE NEVER REACHES THE PAGE. `node --check` runs first;
// on failure the error is printed and the browser keeps the last good version.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, watch } from 'node:fs';
import { basename, join } from 'node:path';
import { wheelUntilSettled } from './cdp.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const PORT = Number(opt('--port', process.env.USERSCRIPTS_CDP_PORT || '9222'));
const HOT = flag('--hot');
const ONCE = flag('--once');
const SCROLL = flag('--scroll');
const explicit = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--port');

const log = (...m) => console.log(`[watch] ${m.join(' ')}`);
const warn = (...m) => console.warn(`[watch] ${m.join(' ')}`);

// ── userscript -> injectable bundle ──────────────────────────────────────────

const META_RE = /\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/;

/** Chrome match pattern -> RegExp. `*://`, `*.host` and `*` in the path only. */
function matchToRegExp(pattern) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = /^(\*|https?|file|ftp):\/\/([^/]*)(\/.*)$/.exec(pattern);
  if (!m) return null;
  const [, scheme, host, path] = m;
  const s = scheme === '*' ? 'https?' : scheme;
  let h;
  if (host === '*') h = '[^/]*';
  // `*.example.com` matches example.com AND any subdomain — Chrome's rule, and
  // the reason thumbwall can list `*.xhamster.com` without a bare entry.
  else if (host.startsWith('*.')) h = `(?:[^/]*\\.)?${esc(host.slice(2))}`;
  else h = esc(host);
  const p = path.split('*').map(esc).join('[\\s\\S]*');
  return new RegExp(`^${s}://${h}${p}$`);
}

function parse(file) {
  const source = readFileSync(file, 'utf8');
  const block = META_RE.exec(source);
  if (!block) throw new Error(`${basename(file)}: no metadata block`);

  const keys = new Map();
  for (const line of block[1].split('\n')) {
    const m = /^\s*\/\/\s*@(\S+)\s*(.*)$/.exec(line);
    if (!m) continue;
    if (!keys.has(m[1])) keys.set(m[1], []);
    keys.get(m[1]).push(m[2].trim());
  }

  const grants = (keys.get('grant') || []).filter((g) => g && g !== 'none');
  const patterns = (keys.get('match') || []).concat(keys.get('include') || []);
  const regexes = patterns.map(matchToRegExp).filter(Boolean);
  const body = source.slice(block.index + block[0].length);

  // The gate is compiled INTO the payload rather than decided here, because a
  // target's URL at attach time is usually about:blank — the real URL only
  // exists in the page, at the moment the script runs.
  const wrapped = `(function(){
  if (${keys.has('noframes') ? 'true' : 'false'} && window.top !== window.self) return;
  var __m = [${regexes.map((r) => `new RegExp(${JSON.stringify(r.source)})`).join(',')}];
  if (__m.length && !__m.some(function(r){ return r.test(location.href); })) return;
  var __run = function(){
${body}
  };
  // addScriptToEvaluateOnNewDocument runs EARLIER than a manager's
  // document-start. Measured 2026-09-29 on leolist.cc: at injection time
  // documentElement is null, document.childNodes.length is 0 and readyState is
  // "loading" — the document is completely empty. A Chrome content script at
  // document_start runs a moment later, once the parser has created <html> and
  // before any other DOM, and a userscript may rely on that; this repository's
  // do (leolist-listings-only touches documentElement.dataset immediately and
  // died with "Cannot read properties of null"). So wait for <html> rather than
  // running earlier than the thing being reproduced.
  if (document.documentElement) { __run(); return; }
  var __o = new MutationObserver(function(){
    if (!document.documentElement) return;
    __o.disconnect();
    __run();
  });
  __o.observe(document, { childList: true });
})();`;

  return {
    file,
    name: basename(file),
    scriptName: (keys.get('name') || ['?'])[0],
    version: (keys.get('version') || ['?'])[0],
    grants,
    patterns,
    wrapped,
  };
}

/** Grows as lazy, viewport-gated content hydrates. Drives when to stop scrolling. */
const HYDRATION_MEASURE =
  `document.querySelectorAll('[class*="nix-"]').length + document.querySelectorAll('img[class*="nix-"]').length`;

/** Teardown every live copy, using this repository's own `__nix*Teardown` convention. */
const TEARDOWN_SWEEP = `(function(){var n=0;
  for (var k of Object.getOwnPropertyNames(window)) {
    if (/^__nix.*Teardown$/.test(k) && typeof window[k] === 'function') {
      try { window[k](); n++; } catch (e) { void e; }
    }
  }
  return n; })();`;

// ── CDP ──────────────────────────────────────────────────────────────────────

let seq = 0;
const pending = new Map();

const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  });

/** sessionId -> { targetId, url, identifiers: Map<file, identifier> } */
const sessions = new Map();

/**
 * sessionId -> the in-flight promise that finishes registering our scripts on
 * it. Target.setAutoAttach RESOLVES BEFORE the attachedToTarget events it
 * causes have been handled, so anything that assumes "attached" also means
 * "registered" races the registration and loses: the reload lands first, the
 * page loads without the script, and the symptom is indistinguishable from a
 * dead selector (measured 2026-09-29).
 */
const attachReady = new Map();

async function registerAll(sessionId) {
  const s = sessions.get(sessionId);
  for (const b of bundles.values()) {
    const { identifier } = await send(
      'Page.addScriptToEvaluateOnNewDocument',
      { source: b.wrapped },
      sessionId,
    );
    s.identifiers.set(b.file, identifier);
  }
}

/**
 * A page that was ALREADY LOADED when we attached has missed its
 * document-start. addScriptToEvaluateOnNewDocument only affects the NEXT
 * navigation, so registering against a live tab and stopping there leaves the
 * script registered and not running — which looks exactly like a dead selector
 * (measured 2026-09-29). Give every pre-existing page its document-start.
 */
async function primeExistingPages() {
  await Promise.allSettled([...attachReady.values()]);
  for (const [sessionId, s] of sessions) {
    if (!/^https?:/.test(s.url || '')) continue;
    try {
      if (HOT) {
        await send('Runtime.evaluate', { expression: TEARDOWN_SWEEP, returnByValue: true }, sessionId);
        for (const b of bundles.values()) {
          await send('Runtime.evaluate', { expression: b.wrapped }, sessionId);
        }
        log(`primed ${s.url} in place`);
      } else {
        await send('Page.reload', {}, sessionId);
        log(`primed ${s.url} by reload`);
      }
    } catch (e) {
      warn(`prime ${s.url}: ${e.message}`);
    }
  }
}

async function reinstall(bundle) {
  for (const [sessionId, s] of sessions) {
    const old = s.identifiers.get(bundle.file);
    try {
      if (old) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: old }, sessionId);
      const { identifier } = await send(
        'Page.addScriptToEvaluateOnNewDocument',
        { source: bundle.wrapped },
        sessionId,
      );
      s.identifiers.set(bundle.file, identifier);

      if (HOT) {
        // Tear the old copy down, then run the new one in place. Fast, and it
        // exercises the teardown contract on every save — but a document-start
        // gate has nothing to gate on an already-painted page, so this is the
        // mode for iterating, never the one you sign off on.
        const n = await send('Runtime.evaluate', { expression: TEARDOWN_SWEEP, returnByValue: true }, sessionId);
        await send('Runtime.evaluate', { expression: bundle.wrapped }, sessionId);
        log(`hot-swapped into ${s.url || '(tab)'} (tore down ${n?.result?.value ?? 0})`);
      } else {
        // The faithful path: a reload runs the script at document-start, which
        // is the only way the theme and pre-paint gates are actually exercised.
        await send('Page.reload', {}, sessionId);
        log(`reloaded ${s.url || '(tab)'}`);
        if (SCROLL) {
          // A reload lands at the top of an UNHYDRATED page. Anything gated on
          // an IntersectionObserver — leolist's filmstrip, for one — is absent
          // until something scrolls, and `window.scrollTo` does not count: the
          // page scrolls an inner column and never hears about it. Drive the
          // real scroller so the save you just made is actually on screen.
          await new Promise((r) => setTimeout(r, 2500));
          // Deliberately SHORTER than `verify`'s sweep: this runs on every
          // save, so it refreshes what you are looking at rather than walking
          // a hundred rows you are not.
          const w = await wheelUntilSettled(send, sessionId, {
            measure: HYDRATION_MEASURE,
            maxRounds: 25,
          });
          log(`  hydrated ${w.before} -> ${w.after} over ${w.rounds} wheel round(s)`);
        }
      }
    } catch (e) {
      warn(`session ${sessionId}: ${e.message}`);
    }
  }
}

async function onAttached(sessionId, targetInfo) {
  if (targetInfo.type !== 'page' || /^(devtools|chrome-extension):/.test(targetInfo.url)) {
    // waitForDebuggerOnStart pauses EVERY new target, so one we do not inject
    // into must still be released or that tab hangs on a blank page forever.
    await send('Runtime.runIfWaitingForDebugger', {}, sessionId).catch(() => {});
    return;
  }
  sessions.set(sessionId, { targetId: targetInfo.targetId, url: targetInfo.url, identifiers: new Map() });
  try {
    await send('Page.enable', {}, sessionId);
    await registerAll(sessionId);
  } catch (e) {
    warn(`attach ${targetInfo.targetId}: ${e.message}`);
  }
  await send('Runtime.runIfWaitingForDebugger', {}, sessionId).catch(() => {});
  log(`attached to ${targetInfo.url || '(new tab)'}`);
}

// ── bundles + watching ───────────────────────────────────────────────────────

const bundles = new Map();

function load(file) {
  try {
    execFileSync('node', ['--check', file], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    warn(`${basename(file)} DOES NOT PARSE — keeping the last good version in the browser`);
    console.warn(String(e.stderr || e.message).trim());
    return null;
  }
  const b = parse(join(ROOT, basename(file)));
  if (b.grants.length) {
    warn(
      `${b.name} declares @grant ${b.grants.join(' ')} — injection cannot provide manager APIs.`,
      'Verify this one through the Violentmonkey lane: nix run .#browser -- --violentmonkey',
    );
    return null;
  }
  bundles.set(b.file, b);
  return b;
}

function targetFiles() {
  if (explicit.length) return explicit.map((f) => join(ROOT, basename(f)));
  return readdirSync(ROOT)
    .filter((f) => f.endsWith('.user.js'))
    .sort()
    .map((f) => join(ROOT, f));
}

// ── main ─────────────────────────────────────────────────────────────────────

const endpoint = `http://127.0.0.1:${PORT}`;
let version;
try {
  version = await (await fetch(`${endpoint}/json/version`)).json();
} catch {
  console.error(`[watch] nothing is answering CDP on ${endpoint} — start the browser first:`);
  console.error('[watch]   nix run .#browser');
  process.exit(1);
}

for (const f of targetFiles()) load(f);
if (bundles.size === 0) {
  console.error('[watch] no injectable userscript found');
  process.exit(1);
}
log(`${version.Browser} on ${endpoint}`);
for (const b of bundles.values()) log(`  ${b.name} ${b.version} — ${b.patterns.length} @match pattern(s)`);

// Declared below its first textual reference in send(): that closure only
// runs after the socket is open, so the temporal dead zone is never entered.
const ws = new WebSocket(version.webSocketDebuggerUrl);

ws.addEventListener('message', async (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    return;
  }
  if (msg.method === 'Target.attachedToTarget') {
    const { sessionId, targetInfo } = msg.params;
    attachReady.set(sessionId, onAttached(sessionId, targetInfo));
  }
  if (msg.method === 'Target.detachedFromTarget') {
    sessions.delete(msg.params.sessionId);
    attachReady.delete(msg.params.sessionId);
  }
  if (msg.method === 'Target.targetInfoChanged') {
    for (const [, s] of sessions) {
      if (s.targetId === msg.params.targetInfo.targetId) s.url = msg.params.targetInfo.url;
    }
  }
});

ws.addEventListener('close', () => {
  log('browser closed');
  process.exit(0);
});

await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
await send('Target.setDiscoverTargets', { discover: true });
// waitForDebuggerOnStart is what makes this document-start rather than
// best-effort: a new tab is held before its first script runs, long enough to
// register ours.
await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });

// setAutoAttach attaches to every EXISTING target before it resolves, so by
// here `sessions` holds the tabs that were already open — and those are exactly
// the ones that missed their document-start.
await primeExistingPages();

if (ONCE) {
  log('registered; --once, exiting');
  process.exit(0);
}

log(
  `watching ${ROOT} — ${HOT ? 'HOT swap (no reload)' : 'reload on save (faithful document-start)'}` +
    (SCROLL ? ' + wheel-scroll to rehydrate' : ''),
);

let timer = null;
watch(ROOT, (_event, filename) => {
  if (!filename || !filename.endsWith('.user.js')) return;
  if (explicit.length && !explicit.some((f) => basename(f) === filename)) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const b = load(join(ROOT, filename));
    if (!b) return;
    log(`${filename} -> ${b.version}`);
    await reinstall(b);
  }, 120);
});
