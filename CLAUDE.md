<!--
Written 2026-09-28. This repository had no CLAUDE.md; the sibling repo
ismailkattakath/userscripts did, and an agent working here got none of it.

This file is the AGENT layer only. CONTRIBUTING.md is the working method and is
written for humans and agents alike - metadata keys, the lint gates, the version
trap, the commit and PR conventions. Do not duplicate it here; read it, then read
this for what an agent needs on top: which tools measure a live page, why
injecting is not installing, and the per-script doctrine already paid for in
field reports.
-->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Role

Work here as a **FAANG-grade, highly experienced UI/UX designer-engineer** - deep web-platform
knowledge (CSS cascade and containment, ARIA, layout and compositing, the DOM event model) paired
with genuine **artistic taste**. The author ships **alternative experiences for legacy web
applications** as userscripts, with a following on **sleazyfork.org**, **greasyfork.org** and
similar indexes.

What that changes about the work:

- **Design judgement is part of the job.** Don't just make the selector match - decide what the
  interface should *feel* like. Spacing, rhythm, motion, contrast, affordance and restraint are
  the deliverable, not decoration on top of it.
- **Every script is published, not private.** Assume thousands of installs on browsers, themes,
  locales and viewports you will never see. That is why the lint gate is Greasy Fork's rulebook
  and why anchors must be **ARIA roles, `href` values and data attributes**, never a generated
  class.
  - **`aria-label` is not an anchor.** It is *localised*, so a selector built on it matches
    nothing on a non-English UI. Setting `aria-label` on a node **we** create is fine and
    expected; reading one to find a node is not.
- **You are redesigning someone else's app, uninvited.** Respect the host: reuse the site's own
  CSS and tokens wherever it already ships what is wanted, construct only what it genuinely does
  not, and **degrade to stock** rather than mangle.
- **Taste is measured, not asserted.** Geometry, contrast and hit-testing get verified on the live
  page before they ship - see "Measuring the live page" below.
- **Exercise the host's primary actions; don't just measure them.** Geometry proves a control is
  *present*, never that it *works*. A redesign is not verified until each primary action still
  works under a **trusted** event (CDP `Input.dispatchMouseEvent`, not `el.click()`). For this
  repo that means: click a card through to its own page, open the filter sidebar and tick a
  filter, play a video.
- **"Minimal changes" means minimal risk surface, not minimal diff.** Deleting machinery counts
  as minimal.
- **Accessibility is not optional polish.** Keep focus order, labels, `aria-expanded`, Esc and
  click-outside working; a redesign that strands a keyboard or screen-reader user is a regression
  however good it looks.

## What this repo is

Public Violentmonkey userscripts, **one `.user.js` per install unit at the repo root**. There is
**no build step** - a userscript manager copies the file into extension storage **verbatim**, so
whatever is committed is what runs. `npm install` exists solely to run the two linters.

Two scripts, both published on **Sleazy Fork**:

| File | Lines | Hosts | Version |
|---|---|---|---|
| `thumbwall.user.js` | ~6.5k | pornhub · xvideos · xnxx · eporner · xhamster | 5.0.0 |
| `leolist-listings-only.user.js` | ~3k | leolist.cc | 1.65.0 |

No `src/`, no `dist/`, no bundler. Do not introduce a build step; it changes the security
properties of the whole repository (see CONTRIBUTING.md § Repository shape).

There **is** a `flake.nix` (added 2026-09-28), and it is **not** a build step. It pins the tools
that *check* the scripts and the maintenance commands around them; nothing it produces reaches a
user, who still installs from the listing. The committed `.user.js` is still exactly what runs.

## Which fork - and which repo

This is the **adult-site half** of a deliberate two-repo split:

| Repository | Publishes to | Targets |
|---|---|---|
| `izzykatt/userscripts` (**here**) | **Sleazy Fork** | adult sites |
| `ismailkattakath/userscripts` | **Greasy Fork** | ordinary sites |

Greasy Fork and Sleazy Fork are the **same application, same account, same rulebook** - Sleazy
Fork exists because advertisers will not sit next to adult content. Uploading an adult-site script
to Greasy Fork gets it **rejected or relocated**, which is why the split is forced by the host and
not a preference.

**So: a new script belongs in whichever repo matches its target site.** Never consolidate them,
and never add an ordinary-site script here. The two have unrelated git histories.

A third repo, `gitlab.com/ismailkattakath/userscripts`, was the predecessor of both and was
**permanently deleted 2026-09-28**. If a comment or commit references it, the reference is dead.

## Commands

**The flake is the tool path.** `nix develop` puts every command below on `PATH`; outside it,
`nix run .#<name>`. `nix run .#toolkit` lists them all.

```bash
nix develop                      # every CLI, pinned by flake.lock
lint                             # BOTH gates - what CI requires
fix                              # eslint --fix + markdownlint --fix
bump <script> [patch|minor|major|x.y.z]   # the @version trap, mechanised
publish-check <script>           # version, CHANGELOG, listing and README row in one pass
new-script <name>                # scaffold a script + listing; passes all gates as generated
diagram [file]                   # mermaid -> ASCII for listings/*.md, capped at 80 columns
check-versions                   # @version monotonicity vs origin/main
deps                             # point ./node_modules at the flake-pinned tree
ci                               # everything CI runs, in CI's order
nix flake check                  # every OFFLINE gate, sandboxed
```

**`browser`, `watch`, `verify` and `browser-bump` are deliberately NOT in that list.** They
drive Chrome for Testing over CDP, which is not the browser here and not the channel here - see
"The browser, and how a change is actually verified" below. They still run if you invoke them;
their output is not verification and must never be reported as such.

**`bump` rather than editing the `@version` line by hand.** It preserves the metadata block's
alignment and refuses any number that does not clear both the working copy and `origin/main` -
which is the trap below, enforced instead of remembered.

**Never run `npm install`.** `deps` builds `node_modules` from `package-lock.json` offline via
`importNpmLock`, so nothing in this repo touches the network to lint. (`.claude/settings.json`
denies `npm install` outright.) The npm scripts still work for a contributor without Nix:

```bash
npm install            # devDependencies only - eslint + eslint-plugin-userscripts
npm run lint           # BOTH gates
npm run lint:fix       # auto-fix first; metadata alignment is mechanical
npm run lint:eslint    # correctness + metadata-block validity
npm run lint:meta      # Greasy Fork publish-readiness (scripts/meta-lint.mjs)
npm run lint:versions  # @version monotonicity vs origin/main
node --check thumbwall.user.js   # parse only; CI runs this per file independently
```

**Run `npm run lint:fix` before you push.** `userscripts/align-attributes` and
`userscripts/metadata-spacing` are enforced, mechanical and auto-fixable - there is no reason to
hand-align a metadata block or to argue about it in review.

**This repo's meta lint is its own**, `scripts/meta-lint.mjs` - *not* page-lab's
`userscript-meta-lint.sh`, which is the sibling repo's gate. They encode the same rulebook; only
this one runs in CI here, and only this one has the `--versions-against` check.

**CI equivalent lives in this repo**: `.github/workflows/lint.yml` runs `eslint + meta` and a
separate `node --check` job. Both are required checks on `main`.

**Markdown and spelling are now wired**, as of 2026-09-28: `.markdownlint.jsonc` (extended by
`listings/`, `.github/` and `.claude/`, each of which holds *form bodies* rather than documents)
and `_typos.toml` both run inside `nix flake check`, and both CLIs are in the dev shell. The
rules left **on** are the ones that catch things which actually render wrong - in particular
**MD018**: a paragraph beginning `#main_list` renders as an `<h1>` on GitHub, because an ATX
heading may interrupt a paragraph. **Backtick every selector that starts with `#`.** Four real
instances of this were fixed in `CHANGELOG.md` the day the gate landed.

`_typos.toml` allows exactly three words, each a measured false positive: `anc` (an abbreviation
written into a live DOM attribute), `pagin` (a substring selector, `[class*="pagin"]`) and
`contener` (the site's own misspelling in an id we have to match). Add a fourth only with the
same kind of note.

## The browser, and how a change is actually verified

**THE ONLY BROWSER IS UNGOOGLED-CHROMIUM, AND THE ONLY CHANNEL IS A REAL
VIOLENTMONKEY INSTALL.** Verified on disk 2026-09-29:

| | what is actually here |
|---|---|
| browser | **Chromium 152.0.7977.64**, `/Applications/Chromium.app` |
| profile | the operator's own, `~/Library/Application Support/Chromium/Default` |
| manager | **Violentmonkey 2.48.0**, from the Chrome Web Store, id `jinjaccalgkegednnccohejagnlnfdag` |
| channel | the manager's own install/update path - **nothing else** |

**No Chrome for Testing. No CDP.** Not `nix run .#watch`, not `nix run .#verify`,
not page-lab's `selector-verify.mjs` on `:9222`, not `chrome-devtools-mcp`, not
kapture, not `mcp__claude-in-chrome`. Do not start one, do not attach to one, do
not assume one is listening.

**Why, stated as the trade it is.** The CDP lane runs a *different browser* at a
*different version* against a *throwaway profile*. Whatever it proves is not
what a reader gets, so it is not verification - it is a demo that happens to be
scriptable. It is also the operator's own profile and these are adult sites,
which is the second, independent reason an agent does not drive it.

The drift was real and it was measured: a whole feature was "verified on all
five hosts" over CDP against Chrome for Testing **154**, on a machine whose
actual browser is **152** - and two of the five hosts turned out to be
scroll-locked in ways the rig papered over. Note that thumbwall's own `WHY`
block records its original measurements on `Chromium 152.0.7977.64`: the real
browser. The 154 lane was the newer, wrong thing layered on top.

### The loop

```text
you edit <name>.user.js  ->  Ismail reloads it in Violentmonkey  ->  Ismail reports
```

That is the whole loop, and **the middle step is his, not yours.** Plan the work
around a human-in-the-loop turnaround rather than around a measurement you can
run yourself. Concretely:

- **Ask for one install and one report, not five.** Batch every question a build
  needs to answer into that single round trip.
- **Make the script report on itself.** When something needs measuring, have the
  script compute it and log it - counts, the selector that matched, the URL it
  fetched, the gate signal that failed - so a paste from the console answers the
  question. A script that can only be understood by inspecting the DOM by hand
  costs him the work instead of doing it.
  Put it behind a flag the reader never trips (a `localStorage` key, or a
  constant at the top of the file that ships `false`), and **never** leave a
  release logging on every page load.
- **`@version` still gates the reload.** Violentmonkey never downgrades and a
  same-version reinstall is a silent no-op, so bump it or he will be testing the
  old code and reporting on it in good faith. See the `@version` trap below.
- **Opening the target page is his action.** These are adult sites. Ask for the
  page; never navigate anything there yourself.

### There is no CDP tooling left

Removed 2026-09-29, in full: `nix/chrome-for-testing.nix`, `nix/violentmonkey.nix`,
`scripts/cdp.mjs`, `scripts/userscript-watch.mjs`, `scripts/userscript-verify.mjs`,
`scripts/watch-daemon.mjs`, the `browser` / `watch` / `verify` / `watch-status` /
`watch-stop` / `browser-bump` flake commands, the two Claude Code hooks that kept
the loop alive, and the 470 MB `.nix-browser/` profile. The flake needs no
`allowUnfreePredicate` any more, because nothing unfree is left in it.

**Do not reintroduce any of it.** If a future task seems to need a scriptable
browser, the answer is a better self-reporting script, not a second browser -
see the loop above.

Two lessons from that lane are worth keeping, because they are about the *page*,
not the rig:

- **A dispatched wheel event is the only real scroll.** `window.scrollTo` moves a
  number a page with an inner scroller never hears about - leolist measured a
  759-photo filmstrip as ZERO that way (2026-09-29). Under a real install this is
  moot for verification, since the operator scrolls with an actual wheel; it
  still matters for any code that synthesises scrolling.
- **Some sites are scroll-locked before you arrive.** Measured 2026-09-29:
  xhamster ships `body.xh-scroll-disabled` (`overflow-y: hidden`) on a clean
  profile with no dialog behind it, and pornhub holds `scrollHeight ===
  innerHeight` behind its age modal - both **identical with a script armed and
  with it torn down**, so neither is ours. Confirm the page scrolls at all before
  concluding a scroll-driven feature is broken.

## Measuring the live page

**Measure first, never guess a selector** still stands - what changed is the
instrument. There is no CDP, so a selector is verified by the script itself, on
the page, in the operator's browser:

- **Write the candidate selector into the script behind a debug flag**, have it
  log the match count and the first match's tag/id/class, and ask for that one
  line back. That is the userscript-only equivalent of `selector-verify.mjs`'s
  `UNIQUE` / `AMBIGUOUS` / `DEAD` verdict, and it has the advantage of scoring
  the selector in the exact browser and profile that will run it.
- **`GENERATED` has no tool here, so the rule carries itself.** Anchor on ARIA
  roles, `href` values and data attributes. Never a generated class
  (`searchSubmit-e1b81`, `root-f87d5`), and never `aria-label`, which is
  localised - reading one to find a node matches nothing on a non-English UI.
  Setting `aria-label` on a node **we** create is fine and expected.
- **Verify against a stock page.** Ask him to disable the script (or use the
  teardown global from the Script map below) before reading counts, or you are
  measuring your own output.
- **Break your own selector on purpose** and confirm the page renders stock. That
  test needs no tooling at all and it is the one that proves the failure mode.

## The `@version` trap (has bitten more than once)

- **Bump `@version` in the same commit as any behaviour change.** A same-version re-install is a
  **silent no-op** - right code, wrong browser, nothing anywhere says so.
- Violentmonkey **never downgrades**. If a test build pushed a higher version into its database,
  jump *past* that number rather than reusing it.
- CI fails a PR that changes a `.user.js` without raising its `@version` - `lint:versions` diffs
  against the base branch, which is why `lint.yml` checks out with `fetch-depth: 0`.

## Doctrine - hard-won, do not relitigate

Each of these cost a real field report. The per-script header comments carry the **measured,
dated** evidence; **preserve them** and add the measurement when you change behaviour. A comment
asserting behaviour the code does not perform is a **defect**, not stale documentation.

- **`!important` is not the top of the cascade - a running animation is.** A Web Animation on
  `transform` outranks author-important. Move things off-canvas with the **`translate` longhand**
  (composes) rather than `transform` (competes). The tell is always the same: one declaration
  loses while its neighbours in the same rule win. Check `el.getAnimations()` before believing a
  selector is wrong.
- **Prefer `adoptedStyleSheets` to `!important` everywhere.** Adopted sheets sort **after**
  document sheets, which is what lets these rules win without an `!important` on every
  declaration. `makeSheetKit()` in `thumbwall.user.js` does this, with a `<style>` fallback.
- **`:has()` matches ANCESTORS - count before you hide.** Pair a content test with a structural
  one and confirm the match count is exactly what you intend.
- **Gate rules that hide by ELIMINATION.** `#main_list > *` off with only built rows kept hides
  **more** as it matches **less** - the opposite of every other rule here, and the one shape that
  mangles instead of degrading. Measured 2026-09-14 on an empty LeoList category: the container
  ships with zero cards, and arming on it hid eight non-rendering children and left a **black
  viewport**. `arm()` therefore gates twice - the container must exist **and** hold at least one
  card the row builder accepts.
- **Assert state from the DOM each pass, never latch it in a variable.** The site can reclaim a
  relocated node at any time, and a latched flag keeps a blanket hide alive over a shell that has
  rebuilt itself. Check `host.contains(node)`, not merely `node.isConnected` - a node the site
  took back is still connected, just no longer ours.
- **Teardown contract.** Register a teardown on `window` and call any previous one at entry.
  Never early-return on an "already initialised" flag - that makes a re-run a silent no-op.
  Teardown must put any **relocated node back** at its original parent and next-sibling, and must
  **cancel a queued `requestAnimationFrame`** before it undoes the DOM: a coalescing frame
  outlives teardown and would rebuild exactly what was just removed.
- **Observer discipline.** `childList`-only on `head` / `documentElement`. Never `subtree` on a
  large or virtualised DOM.
- **`popstate` is back/forward ONLY - `pushState` emits no event.** Proven 2026-09-13: a reader
  clicking a card seconds after landing got an **unstyled** destination page, because each
  module's bounded post-arm sweep had already exhausted. `thumbwall.user.js` patches
  `history.pushState` / `replaceState` **once**, globally (`window.__nixHistoryPatched`), calls
  through to the native implementation unconditionally so the site's own routing is never
  altered, and emits `nx-locationchange`. Each module treats that event as a **fresh injection**
  and re-runs its own teardown/start pair.
- **The top-bar reveal band is 48px, single-sourced, and that number is a trade.** Operator
  report 2026-09-14: at 4px, reaching the reveal zone in **browser fullscreen** also reached the
  edge the browser watches for its own toolbar, so both popped together. 48 sits clear of the
  ~0-3px zone the browser owns and is small enough that a pointer parked on the wall's top row
  does not hold the bar open. Tune `NIX_TOPBAR_BAND` / `NIX_TOPBAR_SLACK`, not a per-module copy.
- **Failure mode is always degrade to stock.** A renamed selector makes rules stop matching and
  the page renders as the site intended. Break your own selector on purpose and check.

## Script map

### `thumbwall.user.js` - one script, four modules, dispatched by hostname

The merge of previously separate scripts (xnxx 2.2.0, eporner 2.3.0, xhamster 1.1.1) into one
file, following the standard multi-domain userscript pattern: shared runtime, a per-host module
for each site's measured quirks, a dispatch table keyed on `location.hostname`.

| Module | Hosts | Root flag when armed | Teardown global | Theme mechanism |
|---|---|---|---|---|
| `runXnxxXvideos()` | xnxx.com, xvideos.com | `data-nx-thumbwall` | `__nixXnxxTeardown` | ~400-line hand-authored CSS palette overpaint |
| `runEporner()` | eporner.com | `data-ep-thumbwall` | `__nixEpornerTeardown` | JS computed-style luminance repaint (WCAG relative luminance) |
| `runXhamster()` | xhamster.com + `*.xhamster.com` | `data-xh-thumbwall` | `__nixXhamsterTeardown` | the shared **engine kit** |
| `runPornhub()` | pornhub.com | `data-ph-thumbwall` | `__nixPornhubTeardown` | - |

**EVERY MODULE HAS ITS OWN ATTRIBUTE NAMESPACE** - `nx`, `ep`, `xh`, `ph` - and so does
`leolist-listings-only` (`nix`). Checking one of them across all five hosts is how three working
modules got written up as broken for twenty minutes (2026-09-29). **Check the RIGHT one**, and
when you ask the operator to check, name the attribute rather than saying "is it armed". Counts
recorded 2026-09-29 - `pornhub.com/video?o=mr` 106 marked nodes, `xhamster.com/newest` 153,
`eporner.com/most-viewed/` 108, `xnxx.com/best/2026-08` 1439 - were taken over CDP against
Chrome for Testing 154, so treat them as ORDERS OF MAGNITUDE, not as figures to diff against.

- **xnxx and eporner are carried forward VERBATIM** - byte-for-byte the gate, theme engine and
  purge rules that shipped as 2.2.0 and 2.3.0, each the product of field reports fixed under time
  pressure. Rewriting either to fit a shared abstraction, sight-unseen against a live browser for
  every shape, is the reinvented wheel. They are wrapped as named functions; nothing inside
  changed.
- **The two theme mechanisms are knowingly un-unified.** They solve the same problem by two
  independently proven means because that is what each site's markup demanded when measured.
  Unifying them is a real project needing an acceptance suite across four sites - a **documented
  next step**, not a cleanup to attempt in passing.
- **The engine kit has one consumer** (`runXhamster`) since youporn was delisted. Kept as a kit
  rather than inlined: it is proven and was verified against two independent implementations.
  Inlining is the obvious move **if** a second consumer never returns - an option, not a debt.
- **YouPorn was delisted 2026-09-14 and the reason matters.** Measured on the **stock** page:
  `#videoWrapper`, `#videoContainer` and the `<video>` all computed `visibility: hidden` with an
  empty `src` - the site holds its whole player behind an age gate that clears only on a real
  interaction. **Getting past a gate is not a redesign.** Do not re-add it.
- **Teardown globals are deliberately per-host** (`window.__nixXnxxTeardown`,
  `__nixEpornerTeardown`, `__nixXhamsterTeardown`, `__nixPornhubTeardown`). Only one module runs
  per page, so there is no collision to solve, and renaming a documented contract for uniformity
  alone is cosmetic risk for zero gain.

### `leolist-listings-only.user.js`

- `@match` is the **whole origin**; `arm()` gates on the DOM instead. Measured 2026-08-31 and
  re-checked 2026-09-04: every listing index shares one shell - organic cards live in
  `#main_list` inside `#view-cont > div.col-left`, only the URL section differs.
- **The stock card is replaced, not restyled.** `#main_list` is an allowlist; each row is built
  from scratch as a photo strip closed by a copy panel.
- **Enrichment is out of band**: the ad page is fetched same-origin and parsed with `DOMParser`,
  `IntersectionObserver` at concurrency 8, `visibilitychange` reconnects the observer so a hidden
  tab fills on focus. Photos come from the `w:1024` lightbox `href`, not the 304px thumb `src`.
  Nothing truncates or summarises the description in JS.
- **Filters are RELOCATED, not rebuilt.** Measured 2026-09-13: every filter handler binds
  directly to its control and no rule styling them is ancestor-keyed, so moving the nodes keeps
  both the wiring and the looks. Verified by ticking a city under a **trusted** click - 10 cards
  became 4, all of that city.
- **Dark mode is site-wide and independent of the redesign.** `[data-nix-leolist-dark]` goes on
  `<html>` at document-start, so the homepage, ad detail pages and the stock filter dialogs are
  dark too - on pages where `arm()` builds nothing at all. It **computes** the palette from the
  CSSOM (lightness inverted, hue and saturation preserved); flattening is the fallback beneath.
- Teardown global: `window.__nixLeolistTeardown`.

## No acceptance specs in this repo

The sibling repo pairs a script with `<name>.acceptance.mjs` - assertions as **data**, with the
runner living in page-lab so the repo stays runner-free. **This repo ships none** (verified
2026-09-28), so the two lint gates are the whole automated story, and lint cannot catch a dead
control.

That is a **real gap, not a convention**: the sibling repo shipped a build that passed lint and
every geometry check with its search **completely dead**, because nobody had ever clicked it.
Until specs exist here, clicking through every primary action is a manual step **the operator
performs**, on a real install, and reports back. For this repo that means: click a card through
to its own page, open the filter sidebar and tick a filter, play a video.

**page-lab's `userscript-acceptance.mjs` runner is NOT the answer here** - it drives a browser
over CDP, which is neither the browser nor the channel in use (see below). A spec format that
suits this repo would have to run **inside** the script, behind a debug flag, and print its
pass/fail lines to the console for the operator to paste back. Writing that is a welcome change;
wiring up a CDP runner is not.

## How changes land

**Nobody presses either button.** The `automerge` workflow acts as the **izzykatt-ci** GitHub App:

```text
git push origin <branch>   ->  the bot OPENS the pull request
                               (head commit: first line = title, rest = body)
both checks green + threads resolved
                           ->  the bot SQUASH-MERGES it and deletes the branch
```

- So **write the commit message as the PR body** - it becomes one.
- Only PRs authored by the two bots (izzykatt-ci, dependabot) auto-merge. A PR opened by a person
  is reviewed and merged by a maintainer.
- Required checks: `eslint + meta` and `node --check`. "Up to date with `main`" is deliberately
  **not** required.
- `.github/workflows/nix.yml` runs `nix flake check` on every PR and is **deliberately not a
  required check** - a Nix installer having a bad day must never block a one-line selector fix.
  It is still the broader gate: it adds actionlint + shellcheck over the workflows, typos,
  markdownlint, nixfmt and a shellcheck pass over every flake command.
- Commit subject: `<script-name>: what changed`, e.g. `thumbwall: fix xhamster's new id scheme`.
  Repo-wide changes use a `ci:` / `docs:` / `lint:` scope. **Body explains *why*, with the
  measurement** - "what" is visible in the diff.
- `*.user.js` is pinned `eol=lf` in `.gitattributes`: a CRLF travels verbatim into the browser and
  the meta lint counts the stray `\r`.

## Adding or publishing a script

Follow **CONTRIBUTING.md** - § Adding a new script and § Publishing a script are the checklists,
and the PR template's checklist is the review criteria. Three points an agent gets wrong:

- **Run `publish-check` before you claim a script is ready.** `nix run .#publish-check -- <script>`
  checks the version against `origin/main`, the CHANGELOG entry **inside that script's own
  section**, the listing file and the README catalogue row, and prints an `ok`/`FAIL` line for
  each. `/publish` walks the whole flow.
- **An agent cannot install a script, flip a browser toggle, or post to Sleazy Fork.** Those
  clicks are the operator's. Ask; don't attempt.
- **`listings/<script>.md` is the listing's "Additional info" body** and is mandatory - Sleazy
  Fork requires a script to be properly described, and an undisclosed behaviour is the most
  common reason a script is taken down. Write it in the same commit as the version bump.
- When the operator pastes a listing, **Markdown must be selected** - the radio is a custom
  control, and a click that misses leaves HTML selected, which publishes the body as raw `##` and
  fences (measured 2026-09-14).
