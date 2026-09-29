#!/usr/bin/env node
// Supervisor for `nix run .#watch`, so the live-injection loop is simply THERE.
//
//   ensure   start it if it is not already up, and say what happened
//   status   one line: running / stopped / declined, and why
//   stop     kill the browser and the watcher this daemon started
//
// Claude Code's hooks call `ensure` at session start, after any .user.js edit,
// and at the end of a turn. It is idempotent and the already-running path costs
// a pid check plus one loopback request, so calling it often is free.
//
// THE RULE THAT SHAPES THIS FILE: a hook must never inject scripts into a
// browser it did not start. `watch` on its own will happily ATTACH to whatever
// answers CDP on the port — which is the right behaviour when a person types
// it, and the wrong behaviour entirely when a session-start hook fires and the
// operator's own Chromium is sitting on 9222 with their real profile. So this
// only ever claims a port it opened itself, tracked through a state file, and
// declines with a reason otherwise.

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.env.PROJECT_ROOT || process.cwd();
const DIR = join(ROOT, '.nix-browser');
const STATE = join(DIR, 'watch.json');
const LOG = join(DIR, 'watch.log');
const PORT = Number(process.env.USERSCRIPTS_CDP_PORT || 9222);
const cmd = process.argv[2] || 'status';

const say = (m) => console.log(`[watch-daemon] ${m}`);

const readState = () => {
  try {
    return JSON.parse(readFileSync(STATE, 'utf8'));
  } catch {
    return null;
  }
};

const pidAlive = (pid) => {
  try {
    // Signal 0 tests for existence and permission without delivering anything.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const portAnswers = async (port) => {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 1500);
    const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: c.signal });
    clearTimeout(t);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
};

/** Running only when BOTH halves agree: our process is alive and its port answers. */
async function probe() {
  const st = readState();
  if (!st || !pidAlive(st.pid)) return { running: false, state: st };
  const v = await portAnswers(st.port ?? PORT);
  return { running: Boolean(v), state: st, browser: v?.Browser };
}

function stop() {
  const st = readState();
  if (!st) return say('nothing to stop — no state file.');
  try {
    // Negative pid = the whole process group. `watch` is spawned detached, so it
    // leads its own group and this takes the browser down with the watcher.
    process.kill(-st.pid, 'SIGTERM');
    say(`stopped pid group ${st.pid}`);
  } catch {
    say(`pid ${st.pid} was already gone`);
  }
  rmSync(STATE, { force: true });
}

async function ensure() {
  if (process.env.USERSCRIPTS_WATCH === '0') return say('disabled by USERSCRIPTS_WATCH=0');

  const scripts = readdirSync(ROOT).filter((f) => f.endsWith('.user.js'));
  if (scripts.length === 0) return say('no .user.js in this repo — nothing to watch.');

  const p = await probe();
  if (p.running) {
    return say(`already running — ${p.browser} on :${p.state.port}, ${scripts.length} script(s) live.`);
  }

  // Someone else owns the port. NEVER attach: that browser is not ours, and on
  // 9222 it is most likely the operator's own Chromium with their real profile.
  const squatter = await portAnswers(PORT);
  if (squatter) {
    return say(
      `declined — ${squatter.Browser} already answers CDP on :${PORT} and this daemon did not start it. ` +
        `Attach on purpose with 'nix run .#watch', or set USERSCRIPTS_CDP_PORT to a free port.`,
    );
  }

  // Refuse to make session start wait on a 361 MB download. --offline builds
  // what is local and fails rather than fetching, which is exactly the question
  // being asked: can this start RIGHT NOW?
  try {
    execFileSync('nix', ['build', '--no-link', '--offline', '.#watch', '.#chromium'], {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
  } catch {
    return say("browser not in the store yet — run 'nix run .#watch' once by hand (361 MB), then this takes over.");
  }

  mkdirSync(DIR, { recursive: true });
  const out = openSync(LOG, 'a');
  const child = spawn('nix', ['run', '.#watch', '--', '--port', String(PORT)], {
    cwd: ROOT,
    // detached + unref is what makes it OUTLIVE this hook. A hook process is
    // short-lived and Claude Code reaps it; without its own process group the
    // browser would die with the hook that started it.
    detached: true,
    stdio: ['ignore', out, out],
  });
  child.unref();
  writeFileSync(STATE, JSON.stringify({ pid: child.pid, port: PORT, startedAt: new Date().toISOString() }));

  for (let i = 0; i < 40; i++) {
    const v = await portAnswers(PORT);
    if (v) return say(`started — ${v.Browser} on :${PORT}, ${scripts.length} script(s) live on save.`);
    if (!pidAlive(child.pid)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  say(`started pid ${child.pid} but :${PORT} has not answered yet — see ${LOG}`);
}

if (cmd === 'stop') {
  stop();
} else if (cmd === 'ensure') {
  await ensure();
} else {
  const p = await probe();
  if (p.running) say(`running — ${p.browser} on :${p.state.port} (pid ${p.state.pid})`);
  else if (existsSync(STATE)) say('stopped — stale state file, next ensure will restart it.');
  else say('stopped.');
}
