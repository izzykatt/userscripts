#!/usr/bin/env node
// SessionStart digest. Three things that are invisible until they bite:
//
//   1. whether ./node_modules is the flake-pinned tree or an npm install,
//   2. untracked .nix files (a flake evaluates the GIT TREE, so they are
//      invisible to `nix flake check` and the result is silently stale),
//   3. each script's @version against origin/main — the difference between
//      "ready to publish" and "a re-install would be a silent no-op".
//
// Never fails the session: every probe is wrapped, and the worst case is a
// shorter digest.

import { execFileSync } from 'node:child_process';
import { lstatSync, readlinkSync, readdirSync, readFileSync } from 'node:fs';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const out = [];

const git = (args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const versionOf = (text) => /^\/\/\s*@version\s+(\S+)/m.exec(text)?.[1] ?? null;

try {
  const st = lstatSync(`${root}/node_modules`);
  if (st.isSymbolicLink()) {
    out.push(
      readlinkSync(`${root}/node_modules`).includes('/nix/store/')
        ? 'deps: node_modules is the flake-pinned tree.'
        : 'deps: node_modules is a symlink OUTSIDE the Nix store.',
    );
  } else {
    out.push('deps: node_modules is an npm install — `nix run .#deps` pins it instead.');
  }
} catch {
  out.push('deps: node_modules is ABSENT — run `nix run .#deps` (never `npm install`).');
}

try {
  const untracked = git(['ls-files', '--others', '--exclude-standard', '--', '*.nix']);
  if (untracked) {
    out.push(`WARNING: untracked .nix files are INVISIBLE to nix flake check — git add them:\n  ${untracked.split('\n').join('\n  ')}`);
  }
} catch {
  /* not a git checkout; nothing to say */
}

try {
  const scripts = readdirSync(root).filter((f) => f.endsWith('.user.js')).sort();
  for (const f of scripts) {
    const head = versionOf(readFileSync(`${root}/${f}`, 'utf8'));
    let base = null;
    try {
      base = versionOf(git(['show', `origin/main:${f}`]));
    } catch {
      /* new script, or no origin/main locally */
    }
    if (head && base && head === base) out.push(`${f}: @version ${head} (same as origin/main — bump before publishing).`);
    else if (head && base) out.push(`${f}: @version ${head}, origin/main has ${base}.`);
    else if (head) out.push(`${f}: @version ${head} (not on origin/main yet).`);
  }
} catch {
  /* unreadable checkout; nothing to say */
}

if (out.length) console.log(out.join('\n'));
