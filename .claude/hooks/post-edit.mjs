#!/usr/bin/env node
// PostToolUse(Write|Edit). Two jobs, both cheap enough to run on every write:
//
//   *.user.js -> parse it and run the Greasy Fork publish lint on THAT FILE.
//                A userscript is copied verbatim into the browser, so a syntax
//                error is a script that silently never runs. Catching it at the
//                edit is worth far more than catching it in CI.
//   *.nix     -> git add it. A flake evaluates the git tree, so an unstaged new
//                file is invisible to `nix flake check`.
//
// Exit 2 feeds stderr back to Claude to fix. Anything else never blocks.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { relative, isAbsolute } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) input += chunk;

let file;
try {
  file = JSON.parse(input)?.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (!file) process.exit(0);

const rel = isAbsolute(file) ? relative(root, file) : file;
if (rel.startsWith('..')) process.exit(0); // outside the project

const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

if (rel.endsWith('.nix')) {
  try {
    run('git', ['add', '--', rel]);
  } catch {
    /* not a git checkout, or the file is ignored — neither is worth blocking */
  }
  process.exit(0);
}

if (!rel.endsWith('.user.js')) process.exit(0);

const problems = [];
try {
  run('node', ['--check', rel]);
} catch (e) {
  problems.push(`${rel} does not parse — it would silently never run:\n${e.stderr || e.message}`);
}

if (existsSync(`${root}/scripts/meta-lint.mjs`)) {
  try {
    run('node', ['scripts/meta-lint.mjs', rel]);
  } catch (e) {
    problems.push(`${rel} fails the Greasy Fork publish lint:\n${e.stdout || ''}${e.stderr || ''}`);
  }
}

if (problems.length) {
  console.error(problems.join('\n\n'));
  process.exit(2);
}

// The file is good, so make sure it is actually VISIBLE somewhere. `ensure` is
// idempotent and the already-running path is a pid check plus one loopback
// request, so this costs nothing on the common path.
try {
  console.log(run('node', ['scripts/watch-daemon.mjs', 'ensure']).trim());
} catch {
  /* the live loop is a convenience; never fail an edit over it */
}
