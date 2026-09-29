#!/usr/bin/env node
// Stop gate. Refuses to end a turn that leaves a changed userscript failing the
// two gates CI requires. The point is that "done" and "lints" mean the same
// thing here — a red gate discovered by CI costs a round trip, and a red gate
// discovered after publishing costs an install channel.
//
// Runs ONLY when a .user.js actually changed, so an unrelated turn pays
// nothing. `stop_hook_active` short-circuits the re-entry loop.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) input += chunk;

try {
  if (JSON.parse(input)?.stop_hook_active) process.exit(0);
} catch {
  /* no payload; carry on */
}

const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// Revive the live loop on EVERY turn, not only the turns that touched a
// userscript — "stays running" has to survive a crash during a docs change too.
// Idempotent, and the already-running path is a pid check plus one loopback
// request. Never allowed to block a stop.
try {
  const out = run('node', ['scripts/watch-daemon.mjs', 'ensure']).trim();
  if (out && !/already running/.test(out)) console.log(out);
} catch {
  /* the browser is a convenience; a clean stop is not */
}

let changed = [];
try {
  changed = run('git', ['status', '--porcelain', '--', '*.user.js'])
    .split('\n')
    .map((l) => l.slice(3).trim())
    .filter(Boolean);
} catch {
  process.exit(0);
}
if (changed.length === 0) process.exit(0);

const problems = [];
for (const f of changed) {
  if (!existsSync(`${root}/${f}`)) continue; // deleted
  try {
    run('node', ['--check', f]);
  } catch (e) {
    problems.push(`${f} does not parse:\n${e.stderr || e.message}`);
  }
}

try {
  run('node', ['scripts/meta-lint.mjs']);
} catch (e) {
  problems.push(`meta-lint failed:\n${e.stdout || ''}${e.stderr || ''}`);
}

const eslint = `${root}/node_modules/.bin/eslint`;
if (existsSync(eslint)) {
  try {
    run(eslint, changed);
  } catch (e) {
    problems.push(`eslint failed:\n${e.stdout || ''}${e.stderr || ''}`);
  }
} else {
  problems.push('node_modules is absent, so ESLint did not run. `nix run .#deps` installs it offline.');
}

if (problems.length) {
  console.error(
    `A changed userscript does not pass the gates CI requires. Fix these, then stop:\n\n${problems.join('\n\n')}`,
  );
  process.exit(2);
}
