# userscripts

[![lint](https://github.com/izzykatt/userscripts/actions/workflows/lint.yml/badge.svg)](https://github.com/izzykatt/userscripts/actions/workflows/lint.yml)
[![licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![conventions: Greasy Fork](https://img.shields.io/badge/conventions-Greasy%20Fork-670000.svg)](https://greasyfork.org/help/code-rules)

Userscripts that ship **alternative experiences for legacy web applications** —
redesigns, not tweaks.

One `.user.js` file per install unit at the repo root. **There is no build
step**: a userscript manager copies the file verbatim, so whatever is committed
here is exactly what runs in the browser. That is a deliberate constraint, not a
missing feature — it means the published artefact and the reviewable source are
the same bytes.

## Catalogue

<!-- Keep this table sorted by filename. One row per install unit. -->

| Script | Target | Host |
|---|---|---|
| `thumbwall.user.js` | xnxx.com · xvideos.com · eporner.com · xhamster.com — full-bleed thumbnail wall, autohiding header, video page reduced to player + info strip + related | Sleazy Fork |

**Host** is where the script is published: [Greasy Fork](https://greasyfork.org)
for general sites, [Sleazy Fork](https://sleazyfork.org) for scripts targeting
adult sites. Greasy Fork will reject or relocate the latter — see
[CONTRIBUTING.md](CONTRIBUTING.md#which-fork-does-my-script-go-to).

## Installing

1. Install a userscript manager. These are developed against
   **[Violentmonkey](https://violentmonkey.github.io/)**; Tampermonkey and
   Greasemonkey are expected to work but are not tested.
2. Open a script's **raw** URL. The manager intercepts it and offers to install.

There is **no `@updateURL` or `@downloadURL`** in any script here, by design.
Pointed at a repository, those let a push to `main` mutate an installed copy on
every user's machine with no review. Updates are a deliberate manual re-install,
or automatic via Greasy Fork / Sleazy Fork if you installed from there.

## Design rules every script holds to

These are not style preferences. Each one is here because its absence broke
something real.

- **Anchor on ARIA roles, `href` values and data attributes — never a generated
  class name.** Framework class names are compiler output and rotate without
  notice. `aria-label` is not an anchor either: it is localised, so a selector
  built on one matches nothing on a non-English UI.
- **`!important` is not the top of the cascade — a running animation is.** A Web
  Animation on `transform` outranks author-important. Move things off-canvas with
  the `translate` longhand (composes) rather than `transform` (competes).
- **`:has()` matches ancestors.** Pair a content test with a structural one and
  confirm the match count is exactly what you intend before you hide anything.
- **Assert state from the DOM each pass, never latch it in a variable.**
- **Teardown contract.** Register a teardown on `window` and call any previous one
  at entry. Never early-return on an "already initialised" flag — that makes a
  re-run a silent no-op and hides double-injection bugs.
- **Observer discipline.** `childList`-only on `head`/`documentElement`; never
  `subtree` on a large or virtualised DOM.
- **Failure mode is always degrade to stock.** When a selector is renamed
  upstream, rules stop matching and the page renders as the site intended. A
  script that mangles the page on a miss is a defect, not a degradation.

Per-script reasoning — the measured, dated evidence for why each selector and
cascade trick is what it is — lives in that script's own header comments.

## Contributing

New scripts and fixes are welcome. Start with **[CONTRIBUTING.md](CONTRIBUTING.md)**
— it covers the metadata block rules, the two lint gates, and the `@version`
trap that has bitten this project more than once.

- 🐛 [Report a bug](https://github.com/izzykatt/userscripts/issues/new?template=bug_report.yml)
- ✨ [Request a script](https://github.com/izzykatt/userscripts/issues/new?template=script_request.yml)
- 🔒 [Report a security issue](SECURITY.md) — **not** via a public issue
- 📜 [Code of Conduct](CODE_OF_CONDUCT.md)

## Licence

MIT — see [`LICENSE`](LICENSE). Contributions are accepted under the same terms.
