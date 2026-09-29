---
description: Nix flake evaluation reads the git tree — stage before you evaluate.
paths:
  - "flake.nix"
  - "flake.lock"
  - "nix/**/*.nix"
---

# Working on the flake

## Stage before you evaluate

A flake evaluates the **git tree**, not the working directory. A new file that
has not been `git add`ed is **invisible** to the evaluator, which surfaces as a
confusing `path does not exist` or, worse, a silently stale evaluation.

```bash
git add -A && nix flake check
```

The `PostToolUse` hook stages `.nix` writes as a safety net. Do not rely on it
alone when authoring several files at once.

## What each output is for

- `checks.*` — every gate that runs **offline**, in the sandbox. Adding one here
  means CI gets it for free via `.github/workflows/nix.yml`.
- `packages.*` / `apps.*` — the maintenance commands. Each is a
  `writeShellApplication`, so **shellcheck runs at build time**: a broken
  command fails `nix flake check`, not someone's afternoon.
- `devShells.default` — the CLIs. Add one only after `nix search nixpkgs <name>`
  confirms it is packaged.

Prefer adding a command to the flake over documenting a manual procedure in a
README. The command is checked; the README is not.

## Two traps already paid for

- **`SC2329` is excluded on purpose.** Every command shares one prelude and uses
  only part of it; shellcheck cannot see the other callers.
- **`actionlint` carries two `-ignore` patterns** for
  `actions/create-github-app-token`. Its bundled action metadata predates
  `client-id` auth. Drop them when a newer actionlint stops reporting them.

## Formatting

`nix fmt .` uses `nixfmt-tree`. `checks.formatting` fails on anything
unformatted, so run it before pushing.
