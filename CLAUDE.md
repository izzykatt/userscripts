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
browser [--violentmonkey]        # the pinned browser, project-local profile
watch [--hot] [--violentmonkey]  # ^ plus the scripts injected, live on every save
browser-bump [version]           # refresh the Chrome for Testing pin
diagram [file]                   # mermaid -> ASCII for listings/*.md, capped at 80 columns
check-versions                   # @version monotonicity vs origin/main
deps                             # point ./node_modules at the flake-pinned tree
ci                               # everything CI runs, in CI's order
nix flake check                  # every OFFLINE gate, sandboxed
```

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

## The browser, and watching a script live

**`nix run .#watch` is the loop.** It starts **Chrome for Testing 154.0.8037.57**, pinned in
`nix/chrome-for-testing.nix` and never self-updating, against a **project-local profile** at
`.nix-browser/profile` - so a debugger is never pointed at the operator's own session, cookies or
history. Then it injects every `.user.js` over CDP and re-injects on save.

```bash
nix run .#watch                        # reload on save - faithful document-start
nix run .#watch -- --hot               # swap in place, no reload - fast, less faithful
nix run .#watch -- --violentmonkey     # a REAL install in Violentmonkey 2.49.0
nix run .#watch -- --headless --port 9333   # for a scripted check
```

**THE HOOKS KEEP IT UP, so normally you never type it.** `scripts/watch-daemon.mjs ensure` runs
at session start, after any `.user.js` edit, and at the end of every turn. It is idempotent, it
survives the session that started it (PPID 1), and it restarts the loop if it died.

```bash
nix run .#watch-status    # is it up?
nix run .#watch-stop      # take it down
```

Set `USERSCRIPTS_WATCH=0` (in `.envrc.local`) to switch the auto-start off entirely.

**The daemon NEVER attaches to a browser it did not start.** Typing `nix run .#watch` yourself
attaches to whatever answers CDP on the port - correct, because you asked for it. A hook doing
the same thing would inject these scripts into whatever Chromium happens to be on 9222, which on
this machine is the operator's own profile. So the daemon tracks what it started in
`.nix-browser/watch.json` and declines with a reason otherwise.

- **It attaches rather than launches** when something already answers CDP on the port, and then
  leaves that browser running when it exits. A browser it started, it also kills.
- **The default port is 9222**, which is the port `page-lab`'s `selector-verify.mjs` below
  already expects - so `watch` and the measuring tools are the same browser.
- **A save that does not parse never reaches the page.** `node --check` runs first; the error
  prints and the browser keeps the last good version.
- **`USERSCRIPTS_CHROME=/path/to/chrome`** overrides the pin when you need the browser you
  actually have. Nothing else does - an installed browser self-updates, and then a measurement
  note names a version that no longer exists.

**Why CDP injection is faithful HERE.** `Page.addScriptToEvaluateOnNewDocument` runs before any
page script on every navigation, which is what `@run-at document-start` means, and the `@match` /
`@noframes` gates are compiled into the payload and evaluated in-page - so every other page is
left stock, exactly as installed. What it cannot do is provide manager APIs. **Every script here
is `@grant none`, so nothing is missing** - and if one ever grants something, `watch` refuses to
inject it and tells you to use the Violentmonkey lane instead.

**Three traps already paid for, all measured 2026-09-29:**

- **CDP injection runs EARLIER than a manager's document-start, and that broke
  `leolist-listings-only`.** At `addScriptToEvaluateOnNewDocument` time the document is
  *completely empty* - `documentElement` is `null`, `document.childNodes.length` is `0`,
  `readyState` is `"loading"`. A Chrome content script at `document_start` runs a moment later,
  once the parser has created `<html>` and before any other DOM. The script touches
  `documentElement.dataset` immediately and died with **"Cannot read properties of null"** -
  which, correctly, left the page rendering **stock**, so nothing looked broken except that
  nothing happened. `watch` now waits for `<html>` via a `MutationObserver` on `document`.
  **If you ever hand-roll an injection, do the same** - do not run earlier than the thing you
  are reproducing.

- **`--hot` cannot exercise a document-start gate.** The page has already painted, so a theme or
  pre-paint attribute gate has nothing to gate. Iterate in `--hot`; **sign off on a reload.**
- **Registering against an already-open tab does nothing on its own.**
  `addScriptToEvaluateOnNewDocument` affects the NEXT navigation only, so `watch` reloads every
  page that was already open when it attached. Without that, the script is registered and not
  running - a symptom indistinguishable from a dead selector.

The Violentmonkey lane is the one that matches a reader exactly: a real install, the manager's
own update path. It costs two one-time clicks per profile (Details -> *Allow access to file
URLs*, then open the `.user.js` `file://` URL and tick **Track local file**). `--load-extension`
was verified working on Chrome for Testing 154 despite the Chrome 137+ restriction elsewhere.

## Measuring the live page

CONTRIBUTING.md says "measure first, never guess a selector" but does not say *with what*.
Chromium runs with `--remote-debugging-port=9222` - `nix run .#watch` is now the deterministic
way to get one - and page-lab ships the tooling:

```bash
pl=$(ls -d ~/.claude/plugins/cache/*/page-lab/*/scripts | tail -1)

bash "$pl/page-route.sh"          # FIRST - which browser route is up. Most "broken
                                  # selector" reports are an unreachable browser.
node "$pl/selector-verify.mjs" --target-id "$tid" '<sel>' ...
bash "$pl/devtools-doctor.sh"     # triage when the route is down
node "$pl/survey-recon.mjs"       # survey a page before redesigning it
```

Resolve `$pl` with the glob - a bare path pins one plugin revision and several are installed.
The `page-lab:pick` skill is the other path: the operator points at an element and you get a
dated, verified selector back.

`selector-verify.mjs` returns `UNIQUE` / `AMBIGUOUS` / `DEAD` / **`GENERATED`** - that last
verdict *mechanically enforces* the no-generated-class-names rule this repo states in prose. Use
it rather than eyeballing.

**Three traps, all hit for real:**

- **`--target-id` is not optional.** The default ("first page target") silently scores against a
  Violentmonkey extension page. Same selectors, same instant: `DEAD` without it, `UNIQUE` with
  it. Get the id from `curl -s localhost:9222/json/list`.
- **Verify against a *stock* page.** Tear the script down first (the teardown globals are listed
  under "Script map" below). A selector for a node the script has already relocated reads `DEAD`
  while the script is live - you would be measuring your own output.
- **`chrome-devtools-mcp` points at the wrong browser.** It is launched with a
  `--userDataDir` of its own; the page under test is **Chromium on `:9222`**. Kapture
  (`mcp__kapture__*`) is also live but needs an operator click to attach a tab - and a
  `kapture-N` id is a **minted** id that evaporates on reload, so a selector built on one dies
  silently after the session it was written in.

**Opening the target page is the operator's action.** These are adult sites; an agent does not
navigate the operator's browser there unasked. Ask for the tab, then measure it. `nix run .#watch`
deliberately opens **no URL** of its own for the same reason.

**Injecting is not installing.** `nix run .#watch` now removes the first two of these - it
strips the metadata block itself and registers at document-start - so they apply to a HAND-ROLLED
`Runtime.evaluate` injection, which is what you fall back to when measuring one-off:

- Strip the `// ==UserScript== … ==/UserScript==` block first - metadata, not JS.
- These scripts are `@run-at document-start`. Injected at `readyState: complete` they run against
  a page that already painted, so a document-start gate (theme, pre-paint attribute on `<html>`)
  has nothing to gate. Expect a flash the real install does not have. This is also exactly why
  `watch --hot` is for iterating and a reload is for signing off.
- Animations and transitions are still mid-flight on injection. **Poll until a measured value
  stops changing**; a fixed sleep races it, and two equal reads are not proof - require three.
- Re-injection is exactly the double-injection case the teardown contract exists for, so it
  doubles as the livelock test.

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

| Module | Hosts | Theme mechanism |
|---|---|---|
| `runXnxxXvideos()` | xnxx.com, xvideos.com | ~400-line hand-authored CSS palette overpaint |
| `runEporner()` | eporner.com | JS computed-style luminance repaint (WCAG relative luminance) |
| `runXhamster()` | xhamster.com + `*.xhamster.com` | the shared **engine kit** |
| `runPornhub()` | pornhub.com | - |

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
Until specs exist here, clicking through every primary action under a trusted event is a manual
step you must actually do - and writing the first spec is a welcome change.

The runner, if you add one:

```bash
pl=$(ls -d ~/.claude/plugins/cache/*/page-lab/*/scripts | tail -1)
node "$pl/userscript-acceptance.mjs" --repeat 3 <name>.acceptance.mjs
```

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
