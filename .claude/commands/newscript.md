---
description: Start a new userscript the right way — measure the live page first, then scaffold.
argument-hint: <name> <target-url>
allowed-tools: Bash, Read, Edit, Write, Glob, Grep
---

Start a new install unit named `$1` targeting `$2`.

**Measure before you scaffold.** A selector that was not verified against the
live page is a guess, and guesses rot silently.

1. **Survey the live page with every userscript disabled** — otherwise you are
   measuring your own output. Follow **CLAUDE.md § Measuring the live page**: it
   carries the exact `page-lab` invocations, the `--target-id` trap, and why
   `selector-verify.mjs`'s `GENERATED` verdict is what enforces the
   no-generated-class-names rule. Opening an adult site in the operator's
   browser is **their** action — ask for the tab.
   Record for each anchor: the selector, the **exact node count** it matched,
   and the date.

2. **Reject any anchor that is a generated class name, a localised
   `aria-label`, or a tool-generated id.** Anchor on ARIA roles, `href` values
   and data attributes instead.

3. **Scaffold.** `nix run .#new-script -- $1`
   This writes `$1.user.js` with the required metadata keys and the teardown
   contract already wired, plus a `listings/$1.md` stub. It passes all three
   gates as generated.

4. **Fill in the header comment with the measurements from step 1**, then the
   `@name`, `@description` and `@match` for `$2`. Decide Greasy Fork vs Sleazy
   Fork now — an adult-site script uploaded to Greasy Fork gets rejected or
   relocated.

5. **Confirm the failure mode.** Break your own selector on purpose and check
   the page renders **stock**, not mangled. That is the contract; a script that
   mangles a page on a miss is a defect.

6. `nix run .#lint`, add the README catalogue row, add a `CHANGELOG.md` entry
   under `## [Unreleased]`, and exercise the site's primary actions in a
   browser before opening anything.
