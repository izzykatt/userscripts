# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Each script carries its **own** `@version` and is versioned independently —
there is no repository-wide version number, because each `.user.js` is a separate
install unit that users update on its own schedule.

Entries are grouped by script. Within a release, use the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) categories: `Added`,
`Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

## [Unreleased]

### Added

- Repository scaffolding: contribution guide, code of conduct, security policy,
  issue and pull request templates, and two CI lint gates.
- `automerge` workflow: dependabot's and the owner's pull requests are merged
  by the izzykatt-ci GitHub App once both required checks pass.

## leolist-listings-only

### [1.65.0] - 2026-09-14

#### Fixed

- **A category with no listings rendered BLANK, not stock.** The script hides
  by elimination - `#main_list > *` off, only built rows kept - and `arm()`
  gated solely on `#main_list` existing. On an empty index (measured
  2026-09-14: `/jobs/software-qa-dba/central-ontario`, `data-count="0"`, zero
  `.lst-item`) it armed, hid every child, built nothing, and left a black
  column. `arm()` now also requires at least one card that `listingCard()`
  accepts - the same test the allowlist uses, so gate and rows cannot
  disagree. A `childList` observer on `#main_list` (self-limiting, registered
  for teardown) still arms if rows arrive late.
- The old gate failed toward **blank** - an id survives any card-class rename,
  so a renamed `.lst-item` would still have armed and still hidden everything.
  The new gate fails toward **stock**, which is the contract.


#### History before 1.65.0

Ported verbatim from the private repository this script came from, in the
shape it was written there (no dates; the measurement inline). 1.64.0 was the
move itself - metadata re-pointed at this repository, no logic change.


Version history for [`leolist-listings-only.user.js`](./leolist-listings-only.user.js).


### v1.63.0

The stock dialogs could not be dismissed with a pointer, and the root cause was not where it looked.

Escape always worked, so the dialog was not "stuck" in the sense of a trapped event — it was stuck in the sense that a mouse had nowhere to click. Measured on the live page: opened from the relocated trigger, #modal-filters renders at 480x664 with body.modal-open set, and all three of the site's backdrops stay at display:none. A click anywhere outside does nothing. Force one backdrop visible by hand, click it, and the dialog closes and clears its own class — which says plainly that dismissal is the site's backdrop handler, and the backdrop simply never got shown. Opened from the stock bar in its original position the same backdrop shows at 1512px wide, so this was a consequence of the relocation: the site pairs a dialog with a backdrop by DOM position, and the bar no longer lives where that lookup expects it.

The fix uses the site's own element and its own handler rather than adding a dismissal path of our own. Each backdrop immediately FOLLOWS its modal — .main-list holds #modal-filters then its backdrop, .main-list-filter holds the category dialog then its backdrop then the ethnicities dialog then its backdrop — so an adjacent-sibling rule shows exactly one scrim, the right one, and can never stack two. Verified on all three dialogs: each opens with its scrim at rgba(0, 0, 0, 0.72), a pointer click outside closes it and clears body.modal-open, and the filter panel stays open behind it.

Motion, kept small and consistent: one duration scale and one easing curve for the panel, the corner controls and the dialogs. Dialogs and their scrim fade rather than appear, which needs both transition-behavior: allow-discrete and a @starting-style — display:none is not an animatable state and without both the transition is skipped silently. Photos fade in as they land, keyed on a marker the loader sets on 'load' rather than on [src]: src is assigned before a byte has decoded, so a src-keyed fade plays against an empty box and the picture still pops in at the end. The two corner controls and the panel's close take a small scale on :active. All of it sits inside a prefers-reduced-motion: no-preference query, and under reduce the photo fade resolves to plain opacity 1 rather than to an invisible image.

Tested: 65 acceptance checks green (25/25 filters — three of them new and covering exactly this bug, 14/14 hardening, 13/13 strip/black, 13/13 fullscreen close) plus the 25/25 responsive gate. The new checks assert the scrim is shown and sized, that a pointer click outside dismisses the dialog and clears body.modal-open, and that dismissing it leaves the panel open — the last one because a click-outside that closed both would be its own bug. Inject to return 82ms on a 100-row page; remap 1690 rules in 23ms.

One note for the next reader: the first version of those checks failed, and the failure was in the test, not the code — they had been inserted after the Escape check, so they ran against a dialog Escape had already closed. The spec re-opens the dialog between the two now.

### v1.62.0

A hardening pass over the whole file, driven by four parallel read-only audits (platform primitives, redundancy, responsiveness/accessibility, stability) and then verified live rather than taken on trust. Two of the audits' sharpest claims did not reproduce and were dropped; three of the defects fixed here were introduced by this session's own earlier versions.

**Off-the-shelf over hand-rolled.** One AbortController now owns every listener and every fetch, so teardown is abort() plus the observer disconnects rather than five hand-matched removeEventListener blocks that each had to repeat their own capture flag. AbortSignal.timeout(15s) rides along on the two fetch paths: without it a hung request held one of eight concurrency slots forever, because the finally() that frees the slot never runs, and eight of them deadlocked enrichment for the life of the page with no retry path. CSS.escape() guards the one selector built from a value read back off the DOM — it lives in the unguarded sweep at document-start, so a quote in that value took the entire script down rather than degrading. The inert attribute, checkVisibility(), matchMedia change events and env(safe-area-inset-*) replace hand-rolled equivalents.

Rejected, with reasons, rather than adopted for the sake of it: popover (a top-layer panel would paint over the site's own z-index-10000 dialogs, which are opened from controls inside the panel), @layer (unlayered author styles beat layered ones for normal declarations, so wrapping this sheet in a layer would lose every non-important rule to stock), :where() (this file fights FOR specificity, not against it), URLSearchParams for the pager (the hand-rolled regex tolerates /page=2 and #page=2, the platform parser does not), and scroll-snap in place of the edge-snapping arrow step.

**Defects found and fixed.** A pending animation frame fired after teardown and rebuilt the panel and both buttons on a page that had just been returned to stock — the two-panel state, arriving one tick late; every coalescer and every builder now checks the torn flag. Three listeners (two DOMContentLoaded, one load) survived teardown entirely and could re-arm a dead copy: they ride the controller now. The DOMContentLoaded arming path read `if (!arm()) obs.disconnect()` — it threw away the only remaining arming path on exactly the pages where the list arrives late; it disconnects on success now, and its observer no longer watches documentElement with subtree:true. arm() sets its elimination flag LAST and drops it if anything throws, so a half-built page degrades to stock instead of showing an allowlist with nothing in it. A wholesale replacement of #main_list was invisible to every observer — nothing watched between col-left and the list, and the list observer watched the node itself, so its own removal never fired: the island pass re-asserts the node from the DOM and rebinds. LUM_INK_LIGHT was 0.7833 against an ink whose real luminance is 0.8169 — a stale constant from an earlier colour; both are derived from their hex now. The OURS guard listed main-list-items but not main-items-list: near-transposed names, both real on the live page, and only one was being skipped. body.light and body.modal-open are restored by teardown rather than merely dropped.

**Non-redundant.** Deleted: a ground block whose every declaration provably lost to the flattening rule's ID-weighted transparent (the page renders identically without it), a duplicate sponsors rule that the site-wide bare layer already outranked, and two rules byte-identical to earlier ones over a superset of elements. The constructed title's hover colour could never render and a:visited was recolouring listing titles behind the sheet's back — both because the site-wide layers scored an ID through their own :not() and our own UI was not excluded from them. One OWN_UI list, rendered two ways, is now the single source for all four exclusion sites including the rules the remap emits at runtime; measured before and after, the title went from rgb(173, 199, 209) to the accent token it asks for.

**DRY.** 57 colour literals became one 17-token palette on the root; var() carries no specificity, so none of the cascade measured elsewhere in this file moved. The ad-link selector was written at five sites with the href re-derived at four (one of them missing the empty-string fallback) — one constant, one accessor. Five identical try/disconnect blocks became one helper, two identical "collect every listing wrap" loops became one, and the WCAG ratio formula is written once.

**Responsive, and now gated.** The copy panel was a non-shrinkable 420px box — wider than a 390px phone and wider than any desktop at 400% zoom, a WCAG 1.4.10 reflow failure by construction; it sizes with min() and clamp() now. The root cause of the sideways scroll was the site's own 990px floor on body and .wrap leaking through the island, which also meant the strip's 100% never constrained anything: relaxed, the strip went 990px to 390px at a 390px viewport and the copy panel to 370px. Fullscreen stopped restating inset:0 in large-viewport units (with a mobile URL bar every row was taller than the visible area) and every height is dvh. The filter button's ride-along is gated to >=700px, where there is room for it, and both corner controls respect the safe-area insets. A new responsive gate asserts no horizontal overflow, a fitting copy panel and an on-screen >=44px control at 320, 390, 768, 1512 and 2560px: 25/25.

**Accessible.** Each row is an <article> named by its own <h2> — the site's heading markup is hidden wholesale by the island, and nothing had replaced it, so the feed announced "article, article, article" with no names. Each description is a focusable labelled region: it is a fixed-height scroll box holding text kept whole, and no keyboard could reach past the visible lines of the primary content. Each strip is a labelled group, since every photo is necessarily alt="". Entering fullscreen focuses the way out and exiting restores focus rather than dropping it on body. The document-level key handler stands down for contenteditable and for listbox/combobox/menu/tablist/slider/grid targets — it had been taking all four arrows from every custom widget on the site.

Tested: four acceptance specs, 62 checks, all green (14/14 hardening, 13/13 strip/black, 13/13 fullscreen close, 22/22 filters), plus the 25/25 responsive gate. The hardening spec is new and covers what this pass added: heading and region semantics, the palette surviving the remap, the key handler standing down (asserted on defaultPrevented, because bailing out correctly still lets the browser scroll natively), teardown leaving zero constructed nodes, zero markers, zero adopted sheets and the stock filter bar back home, and a second inject/teardown cycle producing exactly one of everything. Dark mode re-audited on a homepage, an ad detail page and a listing index: zero light backgrounds and zero text below 3:1 on all three.

Not done, deliberately: a <dialog>-based panel. It would delete the inert toggle, the focus dance and the Escape branch — but a closed dialog is display:none, and the stock controls relocated into the panel would then have zero geometry while it is shut. Nothing measured says the site never re-measures them, so that is a change to make against evidence, not in a hardening pass.

### v1.61.0

Site chrome is gone everywhere, not just on the pages this script rebuilds. A listing index already hid it — applyIsland keeps one island and hides the rest — but an ad detail page, the homepage and every other route still carried the full furniture. Measured on a detail page: HEADER.main-header 1512x92, FOOTER.footer 1512x1073, the sponsors row 1512x64, the notice band 1512x130 and the floating side rail 94px. The document went from 3399px to 2040px, and more than a viewport of paid links stopped sitting under every ad.

Anchored on the SEMANTIC elements at page level — body > header, body > footer, and the one header inside the page's first wrapper, which is where this site puts its own. That is what makes it hold across routes: the homepage ships header-home and footer-home, different classes entirely, and the same two selectors catch them. Nothing nested can match, so a dialog's own <header> — the sign-in sheet's included — is untouched, and the filter panel's header survives on an armed page.

The three named strips (.main-list-sponsors, body > .human-rights, body > .sticky-side) are site classes rather than landmarks, and they are hidden under the same root flag so that a rule which already existed for listing pages now covers the rest of the site too.

The flag is its own: [data-nix-leolist-bare], set beside [data-nix-leolist-dark] at document-start and removed by teardown. Two concerns, two attributes — one says what colour the site is, the other says what is on it.

Verified live 2026-09-13 on an ad detail page, the homepage and a listing index: every one of the five elements goes from its measured height to display:none, and the panel's own header keeps rendering at 65px. Specs 13/13 strip/black, 13/13 fullscreen close, 22/22 filters; both gates pass.

### v1.60.0

The corner controls swap instead of coexisting. The filter button moves from bottom-right to top-right, where fullscreen already put the close icon, and the two are now mutually exclusive: the normal view shows the filter button, fullscreen shows the close icon, never both. They share one geometry block — same 48px circle, same offset, same translucent fill — so the control under the pointer keeps its place and only its job changes.

That reads as one contextual control rather than two that happen to overlap, and it drops a rule the old layout needed: the filter button no longer has to outrank the fullscreen list, because it is not on screen there at all. Both halves of the swap are :has() on the root, for the reason v1.58.0 documented — #main_list sits in DIV.main-items-list inside .col-left, so it is the buttons' uncle and a sibling combinator matches nothing — and :has() carrying its argument's specificity is what lets those two rules outrank the shared block above them.

The panel-edge shift stays on the filter button only. Opening the panel leaves fullscreen, so the close icon is never on screen beside it.

Dark mode computes colour variants from the site's own CSS rather than flattening. The flattening layer below was right for page chrome and wrong wherever the light fill WAS the widget: the age slider proved it, its track and its selected-range bar both went rgba(0, 0, 0, 0) while the handles survived only because they are drawn with a background-image. So every declaration the site ships is now read back out of the CSSOM, its lightness inverted with hue and saturation preserved, and re-emitted under the same selector — 1690 to 1781 rules per page, in 17 to 48ms. A #fff surface becomes near-black; the slider's rgb(72, 107, 224) range bar stays exactly that blue.

Four things that had to be measured rather than assumed:

CHROMA decides neutrality, not HSL saturation. The homepage ground is rgb(252, 252, 248) — four points of yellow in a near white — and HSL calls that saturation 0.40, because its denominator collapses at the light end. Treated as an accent it was pushed to lightness 0.26 WITH that saturation: a cream page became rgb(93, 93, 40), olive, behind every photo. Chroma says 0.02 and gets it right.

Kept colours are re-declared, not skipped. The flattening rule scores an ID through its own :not(), so a colour this layer decides to PRESERVE is wiped by it unless the override says so out loud. The slider accent survived while the mapping was darkening it and vanished the moment the mapping started leaving accents alone.

The page ground is this script's, not the site's. Ground selectors (html, body, :root) and the containers this stylesheet already paints are skipped outright, because a remapped rule carries an ID and would otherwise outrank the base black.

Text needs one runtime pass the stylesheet cannot do. A rule maps colours without knowing what the element will sit ON: rgb(17, 102, 130) text on a kept rgb(77, 170, 218) strip read 2.49 in stock and 1.80 after the lift. One bounded walk of the rendered page now re-inks any text below 3:1 with whichever of a dark or light ink measures better, and every element it touches is remembered so teardown can undo it. A "background is light" gate would have missed that strip entirely — it is a mid-tone at luminance 0.35.

Audited on three page types after the change: homepage, an ad detail page and a listing index all report zero light backgrounds and zero text below 3:1. Two chips that still measure 2.10 and 2.88 were checked against stock and are identical there — the site's own contrast, not this script's.

Also fixed, and it was a real defect: teardown left an orphan. Only one teardown global can exist, so a third injection undoes the second copy and the FIRST copy's panel stays on the page forever — with the site's own filter bar parked inside it. Measured: teardown then re-inject left two panels and two buttons. Relocated nodes now leave a hidden slot behind at their original position, the entry sweep runs ALWAYS rather than only when the global is missing, and a stale panel's non-ours children are parked on the body rather than deleted with it. Teardown now leaves zero panels, zero buttons and zero sheets, and a re-inject gives exactly one.

Dark mode is site-wide, and independent of the redesign. [data-nix-leolist-dark] goes on <html> at document-start, before and regardless of arm(), so an ad detail page, the homepage, a login form and the stock filter dialogs are all dark — every page this script otherwise builds nothing on. The rules are anchored on ELEMENTS, never a framework class: the site ships one light theme and no dark rules, so the element is the only reliable handle.

Two deliberate choices in it. Painted backgrounds are DROPPED rather than repainted, which keeps every background-IMAGE — logos, sprites, icons — exactly where it was while the black root shows through. And text is forced to one light colour: a site-set dark colour on a now-dark surface is invisible text, and legibility beats preserving a semantic red nobody can read.

!important is measured, not defensive. Without it eleven elements on an ad detail page still painted themselves white — DIV.wrap #fff, three DIV.container in #f5f5f0/#fff/#f0f0f0 — because a plain element selector under one root attribute scores (0,1,2) and the site's single-class rules outrank it. A :not() keeps the layer off this script's own UI, which has its own skin and must not lose it to a blanket override.

Dialogs keep their surface, which the blanket rule had taken away. Dropping every painted background is right for page chrome and wrong for a popup: the sign-in / sign-up sheet, the filter dialogs and the language picker all floated transparent over the page behind them. They get an opaque panel (#0b0b10) and an edge, their children stay transparent so the panel reads as one surface, and the scrim behind them is a 72% black instead of nothing.

The :not(#nix-leolist-filters) on those two rules is load-bearing, not decoration. The blanket rule excludes this script's own panel by ID, and a :not() takes the specificity of its most specific argument — so that rule scores an ID, and a plain class rule loses to it even with !important. Measured: the dialog panel came back the moment its rule carried the same :not(), and the backdrops stayed fully transparent until theirs did too.

Audited live 2026-09-13 with a contrast walk rather than a glance. The sign-in / sign-up popup: opaque panel rgb(11, 11, 16) at 480x690, 40 elements inside, zero light backgrounds and zero text below 3:1, over a backdrop at rgba(0, 0, 0, 0.72). Ad detail page: light backgrounds 11 to 1 (a 25px icon chip left white on purpose, so its dark glyph stays visible), text below 3:1 contrast 4 to 0. Homepage: 0 light backgrounds, 0 low-contrast text.

The panel is pure black too. v1.57.0 took every page surface to #000, but the sidebar arrived afterwards carrying Mocha's off-blacks — #0a0a0a on the shell, #11111b on the relocated inputs and buttons, rgb(17 17 27) on the corner controls. All of them are #000 or a black alpha now, so the panel reads as the same surface as the page behind it rather than a grey card laid on top. Hover keeps a lift (#14141c): a black hover on black is no feedback at all. Borders stay #313244, which is what gives the controls their edges against the black.

Measured live 2026-09-13 in all four states, with the hit test rather than geometry alone: normal view puts the filter button at (1440, 24) 48x48 and hit-testable with the close icon display:none; fullscreen inverts it exactly; clicking the close icon restores the first; opening the panel slides the filter button to (1020, 24) and the close icon stays hidden. Specs: 13/13 fullscreen close (now asserting the swap, not merely that the two do not collide), 22/22 filters, 13/13 strip/black.

### v1.59.0

The panel fits its own column now. v1.58.0 was measured on a /property index, where the stock bar happens to be narrow; on /personals the same bar overflowed the 383px rail by 558px, which clipped the category heading, pushed the centred More Filters label clean off screen (the button read as an empty box) and hid the Verified toggle entirely.

It was grid tracks, not widths. The bar is display:grid sized for a full-width page — and so is .filters__row inside it, asking for 410px + 409px + 108px. max-width:100% cannot help there: a track wider than its container overflows it, and the item's percentage resolves against the track. Every grid inside a relocated island is one minmax(0, 1fr) column now, which stacks the controls — the right shape for a sidebar anyway — and min-width:0 goes with it, because an unset min-width:auto pins a flex or grid item to its content width no matter what max-width says.

Relocated islands carry their own mark, [data-nix-leolist-moved], set when they move and deleted when teardown puts them back. That is what the sizing rules hang off, so the panel still names none of the site's classes.

The category heading is a nowrap flex row of category / "in" / location, each half with its own ellipsis. Squeezed into the rail it truncated both halves and broke the word "in" across two lines. It is a block-level flex row that wraps now — display:flex pinned rather than assumed, because an inline-flex heading would shrink-wrap and take its width from its content instead of the column — left-aligned, with the ellipsis machinery switched off inside it.

Wrapping alone was not enough: the chevron still landed on a line of its own, and the reason was margins, not text. Stock spaces the parts for a 960px bar — 9px either side of "in", 17px before the chevron — which came to 400px of content in a 383px column. Those margins are zeroed inside the heading and a 6px column-gap does the spacing, so "Transsexual Escorts in Greater Toronto Area" and its chevron sit on one 37px line, 19px clear of the edge. A longer title still wraps, and now wraps left-aligned like a heading rather than centred like an orphan.

Verified live 2026-09-13 on /personals/shemale-escorts/greater-toronto: zero overflowing elements in the panel, down from seven. All three specs green after every step — 22/22 filters, 13/13 strip/black, 12/12 fullscreen close.

Worth knowing for the next live run: a backgrounded tab stalls enrichment, because IntersectionObserver does not fire in it. The strip spec failed four checks that way and passed 13/13 the moment the tab was activated. Focus the tab first (curl localhost:9222/json/activate/<id>); it is not a regression.

### v1.58.0

All filtering now lives in an overlay sidebar, opened by a fixed action button bottom-right. The controls in it are the site's own, relocated rather than rebuilt, so nothing here reimplements LeoList's query-param plumbing.

Why that is safe is measured, not assumed. DOMDebugger.getEventListeners on the live page says every filter handler is bound DIRECTLY to its control — #search-q change + paste, #form-search submit, #city_barrie change, #available-now change — with nothing delegated through a container, so the nodes keep their wiring when they move. CSS.getMatchedStylesForNode on all ten filter nodes returned ZERO ancestor-keyed rules (every rule that styles them is self-keyed BEM), so they keep their layout outside their old parents too.

Stock filtering turned out to be five islands, not one: the bar (.filters.js-filters), three .ll-modal dialogs (#modal-category-location, #modal-filters, #ethnicities) and the city rail (fieldset.cities-container, over in .col-right). The bar and the rail move into the panel. The dialogs stay exactly where they are — they are position:fixed at z-index 10000 and the site's own JS opens them — and only needed an exemption from applyIsland, which is now a [data-nix-leolist-show] mark rather than a special case in the hide loop.

The panel slides on the 'right' offset, NOT transform/translate. A transformed ancestor becomes the containing block of a fixed descendant, so a dialog opened from inside a translated panel would have been trapped in a 420px box. For the same reason the panel sits at z-index 9000, BELOW the dialogs' 10000, and opening it leaves the fullscreen list (2147483646) so the stack stays honest: page < panel < dialog.

Two bugs the live page caught. The action button was painted over by the fullscreen list because `#main_list.nix-leolist-list--full ~ .nix-leolist-fab` matched nothing — measured DOM says #main_list sits in DIV.main-items-list inside .col-left, so it is the button's uncle, not its sibling; the rule is a :has() on the root now. And Escape closed the panel out from under an open dialog, because the guard tested the event target and a trigger click leaves focus inside the panel; it asserts .ll-modal--open from the DOM instead.

The fullscreen view gets a fixed close icon, top-right. Entering it is a click on a photo; leaving it was the Escape key and nothing else, which is no affordance for a pointer at all. The icon exists only there — display:none by default, switched on by the same root :has(#main_list.nix-leolist-list--full) the action button needs, since #main_list is nobody's sibling — and sits in the opposite corner from the filter button so the two never collide. It rides z-index 2147483647, above the fullscreen list's 2147483646, and the two ways out now share one exitListFull(): the key handler's exitFakeFull is that function, and so is the panel's own "leave fullscreen before opening".

Accessibility: the closed panel is inert, not merely off-canvas, so Tab cannot walk into filters nobody can see. aria-expanded tracks the button, focus moves into the panel on open and back to the button on close, Escape and click-outside both close, and arrows or typing inside the panel never reach the list's keyboard navigation.

Verified live 2026-09-13 under trusted events: 22/22 for the panel, 12/12 for the close icon (hidden at rest, shown and hit-testable on top of the fullscreen list once a photo is clicked, exits on a trusted click, returns on a second entry, Escape still works, gone after teardown), plus the v1.57.0 spec re-run at 13/13. The one that matters: ticking Barrie from inside the panel refetched the site — 10 cards became 4, all Barrie, rows rebuilt, panel still open, bar still in the panel. Teardown puts the bar back under .main-list-filter and the rail back under .col-right, clears the exemptions and removes the panel and button. Also measured: typing a keyword and then clicking More Filters fails to open that dialog on the STOCK page too, so it is the site's behaviour and not a regression from the move.

### v1.57.0

Every surface is black. The four background declarations were Catppuccin Mocha — base #1e1e2e on the page, the list, the strip and the fullscreen overlay, surface0 #313244 on the row behind the copy panel — and on a page whose whole content is photographs that pair reads as a frame drawn around each picture. #000 throughout: the 2px strip gaps and the row margins go black with it, so photos meet black on every edge and nothing boxes them in. The copy panel loses its surface0 lift and now floats on the same black as the strip; it keeps its own 420px column, so the boundary is still the photo edge next to it.

Contrast goes up, not down. Measured against the existing text colours: the description #cdd6f4 is 14.52:1 on black (was 11.34:1 on #1e1e2e), the title link #89b4fa 9.97:1 (was 7.79:1) and its hover #89dceb 13.50:1 (was 10.54:1). All three were already past AAA and all three gained.

Verified live 2026-09-12 on /personals with the same acceptance run as v1.56.0, now 13/13: body, #main_list, .col-left, .nix-leolist-row and .nix-leolist-photos all compute to rgb(0, 0, 0), and the strip order, keyboard walk and teardown checks are unchanged.

### v1.56.0

The copy panel closes each strip instead of leading it. Photos now own the resting frame of every row — the title and description are the end card you arrive at after the last photo, rather than the 420px you scroll past to reach the first one. ensureRow still builds the panel as the strip's only child, so a row with no photos yet is unchanged; renderPhotos inserts every image *before* it (leadWithCopy is trailWithCopy, and the insert anchor is nulled unless the panel really is a child of that strip, because insertBefore throws on a reference node it does not own).

stepPhotos needed no change — it snaps to child edges, not a fixed delta, so it follows the panel wherever it sits. Verified against real layout: four photos of 500/400/600/300 plus the 420px panel with 2px gaps give edges 0/502/904/1506/1808, clientWidth 1200 and maxScroll 1028. Right walks 502, 904, 1028 and holds; Left walks 904, 502, 0 and holds. Both monotonic with no overshoot, and the final Right lands on maxScroll with the whole panel flush against the right edge, so the text is still one key away from the last photo. Only its comment moved (children[0] was the panel; the last child is).

Exercised on a live /personals page 2026-09-12 under trusted events (page-lab's acceptance harness, 12/12): every enriched strip ends on the panel and opens on a photo, none leads with it, exactly one panel per strip. A measured row: six photos at 0/422/844/1266/1687/2109 plus the panel at 2531x420, scrollWidth 2951 against a 1512px viewport, so maxScroll is 1439 and the panel's own edge is past it — the final Right clamps to 1439, where the visible window [1439, 2951] holds the whole panel flush against the right edge. Right walked forward with no backward step and reached it, Left walked back to 0, and teardown put the stock list back (0 rows, flag gone, stock children unhidden).

### v1.55.0

Removed the fact chips. paintFacts, TAG_LABEL and five CSS rules rendered price, area and tag chips from a facts field that no producer has ever written — grep shows x is only ever read back or passed through from a previous read, so paintFacts returned at its first guard every single time. It was an extension point for an external Ollama writer that was never built; the plumbing through readStore, loadDetail, renderPhotos and scan is gone with it.

paintDark is dropLightTheme: it added a .dark class that no rule in this stylesheet has ever matched, and only the .light removal did anything.

hrefSeen was O(rows) per candidate, so O(rows x cards) for every page appended. It is a Set now, topped up by scan() on each list mutation and by growIndex as it appends. scan() itself was two full walks of the list plus a localStorage read per listing; it is one pass that seeds the set, builds the row, arms the observer and marks the snap point, and markSnap is gone.

wait() short-circuits at zero. The gap constants are the fair-use knob and are both 0 today, and setTimeout(0) is still a macrotask — four of them were being paid per listing for nothing. The knob still works if a delay is ever reinstated.

Also: userscripts are linted. eslint's flat config sits next to them and checks.<system>.userscripts-lint runs it under nix flake check, so a typo fails the same gate as everything else instead of surfacing as a dead script in the browser. Verified in both directions — clean on both scripts today, and an injected undefined reference fails the check with no-undef and no-unused-vars.

### v1.54.0

Cleanup pass, plus one real bug. currentIndex() compared row tops against #main_list's own rect top, which is 0 only while the list is the scroll container — true on desktop and in the fullscreen overlay, false below 900px where the media query does not apply and the document scrolls instead. There the list's top goes negative as you move down, every row failed the test and the index pinned to 0, so arrows jumped back to the top of the list. It now clamps to the viewport. Verified against real layout at container tops 0, -300, -900 and -1500: the old formula returned 0 in all four where the correct answers were 0, 1, 3 and 5; the new one is right in all four, and the container-top-0 case is unchanged so desktop and fullscreen do not move.

The [hidden] rule is !important now. applyIsland() and ensureRow() hide by setting the hidden attribute, and this site is already known to ship !important display declarations that outrank plain rules — the same failure that kept SECTION.fa-section on screen for thirty versions.

Dead code removed: a dataset key that was deleted but never set (nixLeolistListingsOnlyInit), both document.exitFullscreen blocks (nothing has called requestFullscreen since v1.43 made the overlay a CSS class, so neither could fire), and the fullscreen rule hiding rowless children, which v1.51.0's allowlist already does with !important.

### v1.53.0

Left/Right stopped working after Up/Down in the fullscreen overlay because the row you landed on had no photos in it yet, and stepPhotos() returns immediately when the strip has nothing to scroll. It looked like clicking an image fixed it; the click was incidental — by then the images had loaded. Measured on a live page in the overlay: of 100 strips only 10 had any overflow, and the rows two and three ahead of the current one had enrich undefined, zero images and canStep false while the current row had four painted images and 2623px of overflow. The cause is geometry: the card IntersectionObserver used a flat 600px margin, which spans several windowed rows but less than one fullscreen row, so arrowing always outran enrichment. The margin now scales with the viewport (max(600, 1.5x innerHeight)) and, more importantly, arrow navigation primes the row it lands on plus the next two through the normal queue instead of waiting for an intersection. Left/Right primes too, so a strip that is not ready fills instead of silently doing nothing.

### v1.52.0

Left/Right arrows step one photo within the listing you are on. They did nothing before: the key handler only matched Up/Down/PageUp/PageDown, and the native fallback could not help either because .nix-leolist-photos has no tabindex so it never takes keyboard focus, and the document cannot scroll sideways. Horizontal movement was trackpad-only, which left the keyboard flow half finished. The step snaps to a child edge rather than moving a fixed delta, because photos are w:1024 at native aspect and every one is a different width; children[0] is the copy panel, so Left from the first photo lands back on the text. The row is picked with the same rule Up/Down already used to decide which listing to leave from, now factored out as currentIndex(). Verified against real layout: five children of 420/300/500/250/400 with 2px gaps give edges 0/422/724/1226/1478 and maxScroll 1078; Right walks 422, 724, 1078 and holds, Left walks 724, 422, 0 and holds, both monotonic with no overshoot.

### v1.51.0

#main_list is an allowlist now, not a blocklist. Every child is hidden and only wraps containing a .nix-leolist-row (plus our tail sentinel) are shown, so anything LeoList injects into the list fails closed instead of rendering raw until a rule catches up. The rules need !important, and that is measured rather than defensive: without it the plain rule hid DIV.js-listing-results-count but left DIV.group and SECTION.fa-section visible, which is why the old `#main_list > section` rule never actually worked — a 220px promo section ("Rachel 23 - Mixed City of Toronto") had been rendering between listings the whole time. Verified on a live /personals page: 118 children, 101 visible = the 100 wraps that have rows plus the tail, 0 visible without a row, fa-section and js-listing-results-count both hidden. The now-subsumed `#main_list > section` and `#main_list > :not(div)` rules are gone; the sponsors, safety-tips, pagination and img.huge rules stay because those can also appear outside #main_list, where applyIsland does not reach them. The fullscreen tail rule was raised to !important so it still outranks the allowlist.

### v1.50.0

Purged the hero image. Every photo in a row now comes from the detail page lightbox at w:1024; the list card's [data-testid="listing-pic"] thumb is no longer read at all. It was a 304px square crop of a photo the detail page already serves full size, so it painted one image at the wrong resolution and aspect and then had to be deduped out of the real set by s3 payload — that dedupe is gone too, so the photo it used to shadow now shows at full size like the rest. Follow-on renames: .nix-leolist-extra is .nix-leolist-photo and renderExtra is renderPhotos, since "extra" only ever meant "extra to the hero". Also dropped a dead `stock` lookup in ensureRow. Trade-off: a row is now copy-panel-only until its detail fetch lands, where the thumb used to paint immediately from the list page.

### v1.49.0

Dropped every typographic spacing override in the constructed UI: 5 line-height, 6 letter-spacing and 2 word-spacing declarations, plus font-variant-ligatures:none and hyphens:none. The v1.36 tracking was tuned when the type was silently rendering at 5/8 size (see v1.48.0); at the correct size it read as loose and harder to scan, not easier. Text now uses the browser defaults. Sizes, colours, the 36ch measure and the flex gaps between title/chips/description are unchanged.

### v1.48.0

The constructed UI sizes type in absolute px instead of rem. LeoList sets html{font-size:10px}, so every rem in this script had been rendering at 5/8 of the size it was written for — the description at 10.5px, the title at 12.5px, chips at 12.5px — and the v1.36 "bigger, spaced type" never actually landed. The 142px of dead space on the right of every copy panel was a symptom: the 36ch measure shrank with the font while the panel stayed a fixed 420px. Measured on the live page, the description now fills the panel exactly (36ch at 17px = 385px vs a 380px content box, dead space 0). Sizes are now immune to whatever root font-size the site sets.

### v1.47.0

Runs on every LeoList listing index, not just /personals/. Verified live on /community/activities/greater-toronto: the same shell (#view-cont > div.col-left, #main_list, .lst-item, a.lst-item__link.mainlist-item, [data-testid="listing-pic"]) with only the URL section differing, and all 18 cards enriching. @match is now the whole origin, arm() gates on #main_list so ad detail pages and the homepage are left alone, and the enrichment guard is a section-agnostic /<section>/../<slug>-<id> test instead of a hardcoded '/personals/' substring that silently skipped every other index.

### v1.46.0

The copy panel (title, fact chips, description) is the first slide of .nix-leolist-photos instead of the last. Text is readable at rest, without scrolling the strip past every photo to reach it. Strip order is now copy -> hero -> extras; the redundant second appendChild of the copy panel is gone.

### v1.45.0

A pause no longer latches cards to 'fail' — they mark 'retry' and re-arm when the pause expires (one 403 used to blank the list for the rest of the session). Pagination follows page N+1 (the first pager control can be "previous") and stops on a repeat/absent next page instead of looping. Cache Storage is swept of legacy versions and trimmed to IMG_MAX — it had no eviction at all; opaque hits are no longer re-put on every load. localStorage pruning is amortized (startup + every PRUNE_EVERY writes + quota), not a full-store parse on every single write.

### v1.44.0

Fair-use delays off (0 ms HTML/image gaps, concurrency 8). 403/429/503 still pause the origin for 1h.

### v1.43.0

Fullscreen overlay on #main_list (no nested Fullscreen API). Only listing wraps snap on Y. Images no longer carry scroll-snap-align (that made every photo a vertical snap point and broke ↑/↓).

### v1.42.0

Vertical snap/arrows step 1 row, not 2.

### v1.41.0

Fact chips are large type (ADHD scan), bigger still in fullscreen.

### v1.40.0

ArrowUp/Down always step listings (1 row fullscreen, 2 rows windowed). Capture-phase scrollIntoView — do not require fullscreen.

### v1.39.0

Fullscreen the list, not a single row. Vertical CSS snap (100vh per listing) so swipe/wheel/arrows move without re-requestFullscreen.

### v1.38.0

Overlay extracted facts (price, area, tags) on the copy pane. Facts come from catalog x (Ollama extract, not more LeoList hits).

### v1.37.0

Desktop CSS scroll-snap on #main_list — 3 rows visible, snap step 2 rows (even wraps get .nix-leolist-snap).

### v1.36.0

Fullscreen ↑/↓, swipe, or wheel moves to the next/prev row and fullscreens it. Bigger, spaced type (ADHD/dyslexia): system-ui, long line-height, tracking, wider copy pane.

### v1.35.0

Hide .main-list-pagination. Append the next index page when the sentinel nears the viewport (same 10s HTML gap). Grow the strip; no pager.

### v1.34.0

Click a photo → that row requestFullscreen() (Escape exits). Same strip, 100vh, scroll-snap. Class fallback if the Fullscreen API denies.

### v1.33.0

Pagehide pauses the fetch queue; pageshow+persisted reconnects IO so listing → ad → Back can restore from bfcache instead of re-fetching.

### v1.32.0

Drop the 1px row border — it stacked with the 2px group margin so image-to-image vertical gap was 4px vs 2px horizontal.

### v1.31.0

Photo strip and copy panel height 384px (was 256).

### v1.30.0

Vertical gap between listing groups matches the 2px photo-strip gap.

### v1.29.0

Window.__nixLeolistTeardown so Kapture can re-inject this file without duplicating rows, observers, or adopted sheets. Preview plugin depends on it.

### v1.28.0

No padding on .nix-leolist-row — the strip is edge to edge in the card.

### v1.27.0

Drop Open. The title in .nix-leolist-copy is the listing link.

### v1.26.0

No extra-photo cap. Every a.href is a slide and a Cache API put; still one image at a time (1s gap on network, 0 on cache hit). Drop +N.

### v1.25.0

Title joins the description in that last slide (.nix-leolist-copy).

### v1.24.0

Description is the last slide of .nix-leolist-photos (after extras / +N). Title stays under the rail. Open stays extreme right, not in the strip.

### v1.23.0

Cache API stores image bytes (www.leolist.cc → imx URLs). localStorage only has URL strings — that is why Application>Cache Storage was empty and Cmd-R still hit the CDN. Hits skip the 1s gap. DevTools "Disable cache" still bypasses HTTP cache; Cache API does not.

### v1.22.0

Drop 304 overlay. Thumb is a square crop; original is not. Extras are a.href only (w:1024/h:0), one by one. Store prefix v4.

### v1.21.0

Hide #main_list > section (and any non-div sibling). Enrich already skipped them; they still painted.

### v1.20.0

Open button on the extreme right of the photo rail.

### v1.19.0

Rows are ours (.nix-leolist-row). Stock .lst-item is hidden. Page-1 title/hero paint immediately; extras still serial.

### v1.18.0

Slower on purpose — 10s between ad HTML, 1s between images.

### v1.17.0

Never lose the page-1 rows. HTML fetches wait 2.5s apart. 403/429/503 pauses origin HTML for this tab (1h). Cache hits still paint extras.

### v1.16.0

Fair use — one listing at a time (HTML), then that row's 304 thumbs one by one, then 1024s one by one. Rows already come from page 1.

### v1.15.0

Enrich only #main_list > div listing rows (Chrome JS path #main_list > div:nth-child(N)). Skip section/aside/sponsors/pagination.

### v1.14.0

Match Catppuccin style-guide + sample.png — page=base, cards=surface0, labels=subtext1, links=blue. Headline is a link so blue, not text.

### v1.13.0

Catppuccin Mocha palette (crust/base/text/subtext0/surface0/blue). Hex only — no @require. Photos unchanged.

### v1.12.0

Constructed dark surface. Dump body was class "light"; no .dark rules in the sheets we fetched, so we don't replay a site theme.

### v1.11.0

Stack 304 img.src under 1024 a.href in one 256px slot (LQIP). Store {lo,hi}; prefix v3. 304 paints first; 1024 fades on load. Same box (object-fit cover) so the square thumb sets width — no blank rail.

### v1.10.0

Height 256px lives on img, not .lst-item. width auto. Card is height auto so title/desc still fit. Drop 3/4 crop so w:1024/h:0 aspect holds.

### v1.9.0

Every .lst-item img is width/height auto (site CSS still pins some).

### v1.8.0

Drop 160px height locks (auto). .lst-item is 256px.

### v1.7.0

Successful rows do not expire. imx filenames are content-hashed UUIDs; a URL is that blob forever. Ads can still swap in new hashes — we only refetch HTML when the listing is unknown or LRU-evicted (cap).

### v1.6.0

Store a.href not img.src. Signed imgproxy paths cannot be rewritten from 304→1024. Cache prefix bumped to v2 so stale 304 URLs are not reused (one HTML refetch of near-viewport misses).

### v1.5.0

#view-cont full width. The 960px well is the parent .main-list-container.container (measured 2026-08-31, col-left x=276 w=960 on a 1512px viewport); widening #view-cont alone is a no-op.

### v1.4.0

Parsed {desc, photos} live in localStorage (key nix-leolist.v1:<href>, TTL 6h, cap 400, 15min negative cache). Refresh/revisit hits the store, not the origin. In-memory Map is L1 for the current document. Fair-use: we never crawl pagination; we only fetch a card that is near-viewport AND uncached.

## thumbwall

### [5.0.0] - 2026-09-15

#### Added

- **pornhub is host 5.** Major version because the host list changed - the same
  reason 4.0.0 was major when youporn left. Both surfaces are redesigned, at
  parity with the other four: gallery pages become the full-bleed wall with
  the hover title overlay and the autohiding header, and `/view_video.php`
  becomes player + info strip (title, views/likes/actions, channel +
  Subscribe) + the related wall below it.
- **Why this Aylo host and not the other one.** youporn was delisted at 4.0.0
  because its player was gated, not styled: on a stock watch page
  `#videoWrapper`, `#videoContainer` and the `<video>` all computed
  `visibility:hidden` with an empty `src`. pornhub, measured 2026-09-15 on
  stock pages, does not do that - `video.mgp_videoElement` computes
  `visibility:visible`, lays out a real 989x556 box and reaches
  `readyState 4`. The difference is architectural, so the host gets the full
  treatment rather than a delisting.
- Measured gate, all four signals, on `/video?page=2` at 1512x862:
  `ul#videoCategory` renders 1098x3033 as a real `display:grid` box with 43
  video children of 45 (share 0.96) across 11 rows, and
  `div.pagination3` exposes 7 distinct `?page=N` targets. Armed and
  screenshot-confirmed on `/`, `/video?page=N` and `/video?c=N`;
  `/information/terms` renders stock, as do both surfaces when a selector is
  broken on purpose.

#### Fixed

- **A percentage `padding-bottom` re-resolved against the widened ancestor and
  produced a 295px-too-tall hero.** `#player` carries no height - it is
  `padding-bottom: 56.25%`, and a percentage padding resolves against the
  containing block's WIDTH. Full-bleed widens that block from 989 to 1512, so
  the hack produced a 989x851 box: right width, wrong height, measured
  2026-09-15. `max-width` on the hero cannot fix it (the cap applies to the
  hero, the percentage reads the parent), so the sheet zeroes the padding,
  pins `aspect-ratio: 989 / 556` and stretches the four boxes the site nests
  inside it. This is the same class of trap as youporn's `display:contents`
  grid - an Aylo engine sizing a box by something other than its own height.
- **The kept strips sat 10px wider than the hero.** They compute
  `content-box` and carry their own 10px side padding, so `max-width: 989px`
  rendered 1009px against a 989px player - a visible stagger down the left
  edge. `box-sizing: border-box` on the strip rule.

#### Changed

- `@name` and `@description` lead with pornhub; `@match` gains
  `https://www.pornhub.com/*` and `https://pornhub.com/*`; dispatch gains a
  `pornhub.com` branch. Nothing in the other four modules changed.

### [4.4.0] - 2026-09-14

#### Changed

- **xnxx / xvideos info strip is one row, not stacked rows.** Laid out by the
  operator in DevTools on 2026-09-14 and reproduced in CSS: title block on
  the left, rating / votes / actions on the right, wrapping on narrow
  viewports. On xnxx both strips are direct children of
  `#video-content-metadata`, so that parent becomes a wrapping flex row -
  nothing moves in the DOM. On xvideos `#main` (already the flex box that
  orders hero / strips / grid) switches from a column to a wrapping row; the
  hero's and grid's chains keep their explicit `width:100%` and take a whole
  line each, the three strips share the line between. Measured 2026-09-14:
  xnxx 1002px title + 486px actions on one 68px row at 1512; xvideos
  1057 / 160 / 247 on one row at 1512 and a clean two-line wrap at 900.

### [4.3.3] - 2026-09-14

#### Fixed

- **4.3.2 could blank xvideos video pages.** Its ad-slot rule hid
  `.exo-ad-ins-container` page-wide; on some video pages the site adds that
  class to `<body>` itself (adblock bait, dynamic - 2 of 3 loads measured
  2026-09-14), so the whole document went `display:none`. The two slots are
  now named by id (`div.e-banner-game`, `#e-banner-game`), like every other
  entry in the chrome list. Do not run 4.3.2.

### [4.3.2] - 2026-09-14

#### Fixed

- Search pages on xvideos and xnxx kept a 728x90 ad banner above the wall
  (`div.e-banner-game > #e-banner-game.exo-ad-ins-container`). The xvideos
  chrome list was enumerated on 2026-09-13 before the slot had filled, so it
  measured 0px and was never named. Measured 2026-09-14 on six stock shapes:
  `.exo-ad-ins-container` is only ever `#ad-footer` (already hidden) or this
  slot, and never inside the grid, so the class is hidden page-wide on
  gallery pages along with its wrapper.

### [4.3.1] - 2026-09-14

#### Changed

- `@name` is now `XVideos, XNXX, xHamster & Eporner – Clean Widescreen
  Gallery`, shaped like the scripts that rank on Sleazy Fork's by-site pages
  (sites first in their own casing, then the words people search for).
  "Thumbwall" was this repository's coinage, not a term anyone searches;
  "FullScreen"/"Autoplay" were considered and rejected as claims the code
  does not make. `@description` gains "uncluttered". No code change.

### [4.3.0] - 2026-09-13

#### Changed

- Moved here from the author's private repository and re-identified for
  public publication: `@namespace` is now `izzykatt.ca`, `@author` Izzy Katt,
  `@homepageURL`/`@supportURL` point at this repository, and `@name` carries
  the four host names so the script is findable on Sleazy Fork's search.
  **Because `@namespace` changed, Violentmonkey treats this as a new script:
  uninstall the old `kattakath.com` thumbwall once, then install this one.**
  No behaviour change from 4.2.1.

#### History before 4.3.0

The entries below are ported verbatim from the private repository's
changelog, in the shape they were written (no dates; measured evidence
inline). `eporner-thumbwall`, `xhamster-thumbwall`, `youporn-thumbwall` and
`xnxx-thumbwall` were the four separately shipped scripts merged into this
one file at 3.0.0.


Version history for [`thumbwall.user.js`](./thumbwall.user.js) — the merge of
`xnxx-thumbwall`, `eporner-thumbwall`, `xhamster-thumbwall` and `youporn-thumbwall` into
one install unit. Each host's own history before the merge is preserved below under its
original section (`## xnxx-thumbwall`, `## eporner-thumbwall`, `## xhamster-thumbwall`,
`## youporn-thumbwall`) — those entries describe real, measured, per-host fixes and stay
the record of how each module got to its current behaviour; only the FILE changed, not
the per-host history.

### v4.2.1

**`@description` rewritten for full disclosure** - Greasy/Sleazy Fork's
code rules require the description to state everything the script does;
"thumbnail wall" undersold a whole-page redesign. It now names the gate
(multi-row hover-preview grid with real pagination), the purge, the
autohiding header, the theme handling, the video-page reduction to player +
info strip + related grid, and what it does NOT do (no infinite scroll,
filters, downloads or network calls; every other page stock). 496 chars,
under the 500-char line rule. No code change.

Selector cross-check against PervertMonkey (sleazyfork, 2026-09-13), as an
independent measurement of the same pages: xvideos cards are keyed by them
on `div.thumb-block[id^=video_]:not(.thumb-ad)` where this file keys on the
`/video-` href (the `[id^=video_]` trap is documented in the xnxx header);
eporner cards agree on `[data-id]` (`div[id^=vf][data-id]` vs
`div.mb[data-id]`); xhamster agrees on `.thumb-list`. Their xhamster pager
anchor `.prev-next-list` was then measured on five stock listing pages
(home, newest, category, search, channel, 2026-09-13): it is the INNER
569px list inside `nav.desktop-pagination.pager-section`, absent on search
where the site renders `ul.test-pager` instead. This file's named list
already anchors the OUTER section on all five via `[class*="pagin"]` /
`[class*="pager"]` (UNIQUE, 8-9 page links each; the heuristic scan is
never reached), so nothing was adopted - the outer node is the better keep
unit and needs no per-shape alternate.

### v4.2.0

**The info strip: the site's own title, channel link, like/favorite and
subscribe controls, kept and laid out under the hero on every host.**
Nothing built, nothing moved, no API calls: each host already renders
these as real controls with working handlers and the watch purge was
deleting them. Every strip block measured 2026-09-14 as a DIRECT child of
the node each module's purge already targets, so the whole keep mechanism
is one `:not([data-*-strip])` on that rule plus a marker set each pass
(`watchMarkStrip` / `epMarkStrip` / `markStrip`, cleared by teardown).
Inside each block only the noise is hidden.

| host | kept | hidden inside it |
|---|---|---|
| xnxx | `div.clear-infobar` (title, uploader), `.metadata-row.video-metadata` (votes) | the sponsor link |
| xvideos | `h2.page-title`, `.video-metadata.video-tags-list` (uploader chip + subscribe), `#video-tabs` (views, votes) | tag chips, the Comments/Download/Save/Share/Report tabs |
| eporner | `#video-info` (h1, pornstar link, Subscribe), `#uvpmenu` (views, like/dislike) | category chips, `#uvmnew` |
| xhamster | the h1 block, `nav#video-tags-list-container` (channel + Subscribe), `.controls` (rating, Favorite, Share) | tag/category links, the tags expander, divider lines, the grey AI button, report |

Subscribe on xnxx/xvideos lives in the player's own control bar, which was
already kept.

**"Right below the video."** On xvideos, eporner and xhamster the title
block precedes the player in stock DOM order. Each of those containers is
now a column flex box with `order` on its direct children - hero first,
strips next, related wall last. Column flex stretches the cross axis, so
it cannot collapse a width the way the row-flex experiment on the hero did
(recorded in the hero WHY blocks). On xvideos this is scoped to `#main`
having the h2 as a direct child, and if the hero and grid ever share one
child of `#main` both order rules match it and the strips fall back to
stock position - never worse.

Caught on the way: xvideos' `h2.page-title` stayed hidden under the strip
rule because a gallery-level rule (search/tag-page heading) out-ranks it
by order - fixed by doubling the strip attribute to lift specificity
without touching the older rule; and `.clear-infobar` had to become
`div.clear-infobar` because xvideos' share panels use `h4.clear-infobar`
headings.

Verified live on all four hosts with screenshots, not just counts. Known
and deliberately not widened here: xhamster's related rail is LAZILY
HYDRATED - 234 placeholder cards whose `/videos/` hrefs fill in on scroll,
so the organic share the watch gate measures depends on when it looks
(11/234 on one load, 89/234 on another, the 12-card sidebar variant on a
third). In a fresh test profile that can leave the gate shut; in normal
use it hydrates before the reader looks. The same href-hydration observer
xnxx grew for its `.after-15` cards is the shape of the fix if it ever
bites for real.

### v4.1.0

**Top-bar reveal band: one value, every host, 48px.** Each module carried
its own (4px xnxx/xhamster, 6px eporner). Operator report: in browser
FULLSCREEN, reaching y<=4 to reveal our bar also reaches the top edge the
browser watches for its own fullscreen toolbar, so both popped together.
The band is now `NIX_TOPBAR_BAND` at the top of the file, aliased by each
module's existing constant name so nothing else in a module changed, and
wide enough (48) that the pointer can stop well short of the browser's
edge. Verified live: hidden at rest, revealed at pointer y=30 (which the
old band ignored), closed again past the bar's measured bottom. The close
hysteresis (`NIX_TOPBAR_SLACK`, 8px) is single-sourced the same way.

**xvideos/xnxx thumbnail badges removed.** Measured on the live card:
`span.top-right-tags` is an absolutely positioned cluster pinned to the
thumbnail's top-right (72x18 at 191,16 in a 267x150 thumb) holding
`.video-hd-mark` ("1080p") and `.video-cc-mark` ("CC"). Chips painted ON
the image, not metadata - the wall is the image. Hidden by container and
by each mark's own class so a shell that places one outside the container
still loses it. This supersedes the earlier recolouring of the HD/SD chips.
Verified: 24 clusters on the page, 0 visible, 0 HD marks visible, and a
crop screenshot of the card to confirm the eye agrees with the count.
Duration was already hidden by the image-only wall design and is unchanged.

**Researched, not built - the gallery 3-dot menu.** xvideos already ships
one natively: `button.action-menu` on every thumb, the site's own
hover-reveal (display:none at rest, block on a trusted hover - the site's
CSS, not ours). Under this script's CSS it still reveals on hover and a
trusted click opens the site's own `div.x-popup` with Watch later,
Subscribe, Add to a playlist, and like/dislike - working handlers, no code
from us. Left exactly where the site puts it. eporner and xhamster cards
carry only a title and an uploader link, so a menu there would need the
sites' APIs - not worth hand-rolling.

### v4.0.0

**youporn delisted. Four hosts, not five.** Major version because a host
this script used to claim is gone from `@match` entirely.

The reason, measured rather than assumed: on a STOCK youporn watch page,
BEFORE this script runs at all, `#videoWrapper`, `#videoContainer` and the
`<video>` itself all compute `visibility: hidden` with an empty `src`. The
site holds its entire player hidden behind an age-verification gate that
only clears on a real interaction. It never rendered a player - the
long-standing "doesn't even show a thumbnail" report was accurate and was
never ours to fix. Getting past an age gate is not a redesign, so there was
no version of this that ended in a working surface.

It was also the odd one out in every other dimension: the only
Aylo/MindGeek engine, the only `display:contents` grid (which is why its
gate had to measure CARD boxes where every other host measures the
container), and the only host needing a `grid-template-columns` override
to reclaim a purged sidebar's reserved track. Every one of those was a
special case carried for a surface that never worked. Removing it took
559 lines out of the file and removed the reason the gates could not be
unified.

The engine kit it shared with xhamster stays. It now has one consumer, and
is kept rather than inlined: it is proven, already verified against two
independent implementations, and folding it back into `runXhamster()` would
be churn with a regression surface and no behavioural gain. Inlining is a
documented option if a second consumer never returns - not a pending debt.

Verified after removal: xnxx, xvideos and eporner all still arm on the
watch page with the hero sized and no overlap, and youporn now renders
completely stock (no root attribute, no marks - the "degrade to stock"
contract, reached by never arming at all).

### v3.9.0

**xnxx/xvideos: the player's own controls were being purged. Root cause of
"no play button at all".**

`watchMarkHero()` marked `player.parentElement` - `div.video-bg-pic`, which
holds the `<video>`, the click handler and the poster image, but NOT the
site's controls. The play button, scrub bar, timer and control bar are
SIBLINGS of that wrapper, inside `#html5video`. The watch-page purge
eliminates every child of a bled ancestor that is not itself bleed/grid/hero,
and `#html5video` is bled - so all of that chrome was deleted, leaving the
poster visible inside the surviving hero and nothing else. The player was
never broken; its controls were purged out from around it.

Fixed by marking `#html5video` - the site's own player container, and
exactly what every other host already marked (`.player-container`,
`#moviexxx`) precisely so all player chrome sits INSIDE the protected hero.
Screenshot-verified: big play button, scrub bar, play/pause, volume,
`00:00 / 09:09`, CC, settings, screenshot, PiP and fullscreen all present.

Also fixed in the same pass, and only visible because a screenshot was
finally taken instead of trusting the numbers: the ratio was forced to
16/9 when the site's own is 964x516 (1.869). At the same 964px width that
made the box 542px tall instead of 516 and it overhung the related-videos
grid by 26px - while every box measurement read `964x542` for both hero and
video, agreeing with each other and with the rule. Numbers green, render
wrong.

### v3.8.0

**xnxx/xvideos: the hero was a 300x250 video AD, not the player. The actual
root cause of every "just the thumbnail, or nothing" report.**

`findPlayer()` on this host alone guessed - "the first `<video>` wider than
200 and taller than 100" - and the WHY block beside it recorded "no
ad-shaped candidate to reject", which was true of the single page sampled
the day it was written and false in real use. Measured live 2026-09-13:
the element it returned was **300x250**, the standard display-ad
rectangle, because an ad's `<video>` had loaded earlier in document order
than the real player. Everything downstream then went to the ad - the
hero mark, the sizing, and critically the purge EXCLUSION - while the
real player, unmarked, was eliminated as furniture. That is exactly
"thumbnail or nothing": the poster survives, the player does not.

Fixed by anchoring on the site's own player container -
`#html5video video, div.video-bg-pic > video` - the same discipline every
other host in this file already used (`video#EPvideo_html5_api`,
`#xplayer__video`, `video.mgp_videoElement`). A size test cannot tell a
300x250 ad from a player; a container anchor can. This also explains the
host split that made the bug so hard to place: eporner and xhamster were
**never exposed to it**, because they never guessed - which is why they
worked throughout while xnxx/xvideos did not.

Verified live on three consecutive xnxx videos: hero is `.video-bg-pic`
every time, real `blob:` source, 964x542, centered - with the ad
`<video>` elements present on the page and correctly skipped.

**Two experiments tried and reverted along the way**, recorded so they are
not repeated: (1) capping and centering instead of full-bleed - kept, it
is the current shape and was never the fault; (2) touching the player with
NO CSS at all, including a `:has()` flex parent to centre it from outside.
That second one is a dead end on this file's DOM and worth knowing why: on
every host whose `<video>` is `position:absolute`, a flex parent collapsed
the wrapper to ZERO width, because an absolutely positioned child
contributes nothing to a flex item's intrinsic width any more than it
contributes to a block's intrinsic height - the same root cause as the
overlap bug this file already documents, surfacing on the other axis.
The aspect-ratio wrapper is load-bearing and stays.

### v3.7.0

**Watch-page hero: centered at a capped size, not forced full-bleed. All 5
hosts, operator directive.** The exact-edge-to-edge hero player was working
CORRECTLY the entire time - the exhaustive real-usage troubleshooting this
version closes out traced heroBox measurements as small as 756px wide not
to a script bug but to DevTools docked to the side of the browser, eating
roughly half the visible viewport; `width:100%` up the marked ancestor
chain was faithfully filling whatever space the page actually had. That is
correct behaviour with a bad failure mode: the instant anything narrows
the visible viewport for any reason, the hero visibly shrinks and reads as
broken. The operator's call: stop chasing exact width, cap the hero at a
sane, centered size instead - `max-width: <the site's own measured stock
width>` plus `margin: 0 auto`, per host (964px xnxx/xvideos, 1192px
eporner, 946px xhamster, 978px youporn). The related-videos wall below
each hero is UNCHANGED - it stays genuinely full-bleed; only the player's
own sizing rule changed.

Caught in the process: eporner's aspect box uses `padding-top: 56.25%`
(the site's own pattern, carried forward) - a padding PERCENTAGE resolves
against the CONTAINING BLOCK's width, not the element's own, so capping
only the width left the box 1192px wide but 851px tall (computed against
the still-full-bleed ~1512px parent), the wrong ratio entirely. Switched
to `aspect-ratio: 16/9`, which resolves against the element's own box -
the only one of the four hosts using the padding-top hack; the other
three already used `aspect-ratio` and were unaffected. Verified live,
all 5 hosts, all correctly centered (equal left/right margins) at the
right ratio.

**Root-cause summary for the three "still broken" reports investigated
this round**, since the actual fixes above turned out to be small:
Violentmonkey's site-access permission was confirmed "On all sites" (not
the cause); with the ad blocker (uBlock Origin) both on and off, the DOM
markup was identical and correct (not the cause); the DOM was independently
confirmed correct on a real xnxx page mid-session (`data-nx-hero` present,
a real `blob:` video src loaded) - the only thing left unaccounted for was
the exact pixel width, which the operator has now told this script to
stop optimizing for. No further script defect was found in xnxx/xvideos
or youporn behaviour this round; the eporner ad-leak and xhamster
id-scheme fixes from the two versions before this one stand as the real,
confirmed fixes from this investigation.

### v3.6.0

**xhamster watch-page gate fix, CONFIRMED real cause of "no change at all."**
`WATCH_ROUTE` required a bare numeric id (`-\d{4,}`) - true of the sample
measured when the feature was built, but re-measurement 2026-09-13 against
24 real links pulled from the CURRENT homepage found every one of them
carrying the site's newer id shape instead: "xh" plus 5+ mixed-case
alphanumeric characters (`-xhinZiY`, `-xh32vic`, ...). The route regex
matched **zero** of 24 current watch links - the gate was never opening
on anything a reader would actually click through to. Fixed by accepting
either id shape; both the legacy numeric form and the new `xh`-prefixed
form verified live, no regression.

**Forward-navigation hardening, all 4 non-eporner-shape modules - real
and safe, but NOT confirmed as an xvideos fix.** `history.pushState`/
`replaceState` are now patched once, globally, to fire a custom
`nx-locationchange` event (popstate already covers back/forward; pushState
emits no event of any kind). Each module reruns its own re-check on that
event - a plain re-sweep for xnxx/xvideos/xhamster/youporn (their apply
functions already re-evaluate from scratch every call), a full
teardown()+startEarly() for eporner (whose `arm()` latches permanently
once true and would otherwise never re-ask `wallGateOk()` on a same-
document route change).

This was built to explain "xvideos: thumbnail, no player" - a live click
on a real xvideos gallery thumbnail reproducibly left the destination page
unstyled. Root-caused further, that click turns out to be a REAL, full
page reload, not a pushState transition: `history.pushState`/
`replaceState` were never called, and the page's own JS execution context
was completely replaced (confirmed by a wiped instrumentation flag).
Re-testing with the userscript-manager's own per-page injection properly
simulated (inject fresh on the NEW page, exactly as Violentmonkey's
`@match` + `@run-at document-start` already does automatically) showed the
existing code working correctly with no changes at all - `armed:true,
watch:true, heroBox:1512x851`. The pushState patch is kept anyway: it is
correct, safe (unconditional call-through, guarded against double-
patching), and covers a real architectural gap this file's own comments
already named ("pushState emits no event... covered by a bounded sweep")
for any future or other same-document transition these sites make - it
is just not what explains this specific report. The xvideos/general
"no change" reports remain otherwise unreproduced after 19 sampled
videos across two test passes; the xhamster fix above is the one
CONFIRMED root cause found this round.

Also fixed: `@description` still read "the video page... is left stock",
a claim the file has been false since v3.1.0 - a comment asserting
behaviour the code does not perform is a defect per this repo's own rule.

### v3.5.0

**Watch-page player unmuted, all 5 hosts.** Reported from real usage: the
hero player defaults to muted (the standard autoplay-policy trick every
one of these sites uses), and a redesigned watch page is a deliberate
destination the reader navigated to - not an incidental background
autoplay - so the mute should not persist. Each host's hero-marking
function (`watchMarkHero()` for xnxx/xvideos, `epMarkHero()`,
xhamster's and youporn's `markHero()`) now unmutes the located `<video>`
if it is muted, re-applied every pass rather than once in case the site's
own player JS resets it.

Verified live: eporner's sampled video WAS muted by default and stayed
correctly unmuted after a further 1.5s settle (no site re-init loop fights
it); xhamster, youporn and xvideos samples were already unmuted by
default on this pass, so nothing to observe there, but the fix is in
place and idempotent (`if (video.muted)`) for whichever video does default
muted.

### v3.4.1

**eporner watch-page fix, reported from real usage.** v3.2.0's furniture purge
named every ad/stats id it found on ONE sampled video (#video-info,
#adstripe, #cutscenes, #statisticsdiv, #sharediv, #reportdiv, #downloaddiv,
#commentdiv, #movieplayer-box-adv) - an ALLOWLIST, not elimination. On
different videos this left a large blue "Advertisement" placeholder
(anonymous, no id, an ad-rotation slot the sample never rendered) sitting
between the player and the related wall, and left #inplaylistsdiv visible
(only present when the video is actually in a playlist, so also invisible
to a single sample).

Replaced with elimination-by-marking at the three container levels the
watch surface actually touches - `#movieplayer-left`, `#vidcontent`,
`#movieplayer-box` - keeping only whatever is ANC/WALL/HERO-marked at each
level and purging everything else. This is the same mechanism the gallery
grid already uses one level up; it generalises to whatever the site injects
next instead of requiring another named id the next time an ad rotates in.
Verified on two more videos: no ad gap, #inplaylistsdiv and the
never-explicitly-purged #admobilemiddle both correctly hidden.

**Investigated, not a script bug:** a youporn "blank video area" report
traced to the site's OWN age-verification interstitial, which blocks video
initialisation until dismissed and reproduces identically with NO script
injected at all - confirmed on the stock page. Checked xvideos/xhamster/
eporner for the same gate; none show it. xvideos ("thumbnail, no player")
and xhamster ("no change at all") did not reproduce across five sampled
videos in a clean browser - most likely a stale Violentmonkey install
(the pre-merge four-script setup, or a same-version reinstall no-op)
rather than a code defect; needs confirming against the actual installed
script list.

### v3.4.0

**Watch-page redesign, host 5 of 5 (last host): youporn.** Completes the
rollout started in v3.1.0 - all five hosts (xnxx, xvideos, eporner,
xhamster, youporn) now redesign both surfaces every gallery card touches:
the grid it lives on AND the video page it links to.

youporn's gate is architecturally the odd one out among the three
mark-based hosts - `qualifyingGrids()` groups cards by `closest(GRID_SEL)`
because the Aylo/MindGeek grid renders `display:contents` through nested
wrappers with no box of its own (documented in this module's own WHY
block). The watch page's related rail, `#relatedVideosWrapper`, carries
NONE of the gallery's `div.full-row-thumbs` class, so `closest()` finds
nothing. `qualifyingGridsWatch()` runs the identical per-grid scoring but
groups by `card.parentElement` instead - cards are real boxes on the watch
page too, so grouping by actual DOM parent needs no shared class name at
all. `qualify()`'s hard pager requirement is skipped here exactly as it
was for xhamster. `findPlayer()`/`markHero()` mark the OUTER
`#videoWrapper` (not the inner `#videoContainer`) so its player-chrome
siblings survive without enumeration, joining the shared elimination
rule's exclusion list the same way as the other two hosts.

Two real defects, both found by measuring rather than assuming a CSS
override would simply take:

- **A two-column CSS grid kept its sidebar's TRACK reserved after the
  sidebar ITEM was purged.** `.watch-contentWrapper` is `display:grid`
  with an explicit `980px 320px` (later measured `1176px 320px` at full
  width) column template; a `display:none` grid item does not collapse its
  own track, so the player column stayed capped even once its sidebar was
  gone. Fixed with `grid-template-columns: 100% !important` under the
  watch scope.
- **`height:auto` alone did not un-clamp the player wrapper.** The site
  sets BOTH a fixed `height` and a matching `max-height` (552px each) on
  `#videoWrapper`; overriding only `height` left `max-height` still
  capping the box at the old size while its aspect-ratio'd child grew
  underneath it. Fixed by overriding both.

Verified live (throwaway browser, a real followed watch URL): `armed:true,
watch:true`, hero `1514x854` (the video's own 978:552 ratio, full width,
2px over viewport from measurement rounding - `overflowX:0` confirms no
real overflow), 23/23 related cards visible and full-bleed, zero
horizontal overflow. Screenshot-confirmed clean related-wall; the hero
frame itself rendered black on this particular video because its OWN
poster was already a blank 1x1 placeholder before the script ran (checked
against the stock, pre-injection page) - not a redesign defect.

All five hosts now ship the same watch-page contract: topbar hidden, deep
dark theme, no footer/sidebar chrome, full-bleed hero player at the top,
related videos dressed identically to the gallery, everything else
(other-videos blocks, ads, comments, toolbars) gone.

### v3.3.0

**Watch-page redesign, host 3 of 5: xhamster.** Same contract as the first
two hosts. xhamster's gallery already purges by marking too - `qualify()`
finds any qualifying `div.thumb-list` and elimination-purges everything
outside its and the pager's ancestor chains - and the watch page's related
rail (`div.thumb-list.thumb-list--sidebar.thumb-list--related`) shares the
same `div.thumb-list` selector, so once a watch-shaped route was allowed to
qualify at all, the rail needed no separate purge system.

What WAS needed: `qualify()` hard-requires a pager (`if (!pager) return
null`), and a related rail has none, so a new `qualifyWatch()` runs the
identical per-grid scoring minus that one check. `findPlayer()` /
`markHero()` mark the OUTER `.player-container` (not the inner
`#player-container` - two different elements, same near-identical name) so
its four children - the real aspect box, a fallback image, a script tag,
and an unlabelled scrubber strip - all survive without needing to know
what each one is; `[data-xh-hero]` joins the SAME shared elimination
rule's exclusion list the gallery grid already uses, rather than adding a
second purge mechanism. `apply()` now tries the gallery gate first and
falls back to the watch gate only when it fails, exactly mirroring how a
non-qualifying gallery page already rendered stock.

Two real defects, both screenshot-caught after the DOM-level checks looked
clean:

- **A 946x80 unlabelled div sat where a scrubber strip was expected** and
  turned out, after marking the whole `.player-container` HERO, to be
  harmless - this one resolved itself for free rather than needing a fix,
  worth recording because the alternative (marking only the INNER
  `#player-container`) would have orphan-purged it.
- **Three ad/promo widgets rendered below the player** - `.underplayer`
  (a cam-site banner), and two more sharing a build-hash class prefix
  (`FYjf-gW...`) with no plain-English companion token - sat outside BOTH
  marked ancestor chains entirely, so the elimination purge never reached
  them. Confirmed the hash is stable across two reloads before anchoring
  on it; purge stops working on the next site deploy that changes it,
  never breaks anything else.

Verified live (throwaway browser, a real followed watch URL): `armed:true,
watch:true`, hero `1512x898` (the video's own 946:562 ratio at full
width), 11/11 related cards visible and full-bleed, zero horizontal
overflow, tags nav / rating-report bar / footer / all three ad widgets
computed `display:none`. Screenshot-confirmed clean at both the hero and
the scrolled related-wall. youporn is next - the last of the five.

### v3.2.0

**Watch-page redesign, host 2 of 5: eporner.** Same contract as xnxx/xvideos -
topbar hidden, dark theme, no chrome, hero player, related rail dressed like
the gallery, everything else gone - but a very different build, because
eporner's gallery already purges by marking (`wallContainers()` marks ANY
parent of `div.mb[data-id]` cards, not by name), so `#relateddiv` - the
watch page's related-videos container - was picked up and full-bled for
free the moment watch routes were allowed to arm at all. No parallel
`data-nx-watch`-style purge system was needed here, unlike xnxx.

What *was* needed: `epFindPlayer()`/`epMarkHero()` mark the site's own
aspect-ratio box (`#moviexxx`) and reuse `wallMarkAncestors()` - the same
ancestor-widener the grid containers use - rather than inventing a second
full-bleed mechanism. `startEarly()`'s watch-route early return is gone;
`wallGateOk()` (organic card count + share) is what actually decides
whether a watch-shaped URL arms, so a dead/removed-video URL still renders
stock exactly as before.

Six real defects, all found by MEASURING the live page rather than
assuming, several only visible in a screenshot the DOM inspection missed:

- **`#vidcontent` is a same-id, different-purpose problem.** The existing
  gallery purge hides `#vidcontent` as a description block on other shapes;
  on the watch route the SAME id wraps the entire player. Fixed by scoping
  that one rule `:not([data-ep-watch])` rather than purging it here too.
- **A 300px companion ad (`#movieplayer-box-adv`, `float:right`) squeezed
  the player to 1208px in a 1512px row** - a floated sibling shrinks an
  adjacent block's line box even after `float:none` is forced on the block
  itself. Purged; the player claims the full row.
- **`#uvpmenu`** (view-count/like/comment-count row, flex, sibling of the
  player) and **`#EPimLayerOuter`** (a `position:fixed` floating corner ad
  parented to `<body>`) both survived the named-block purge because neither
  sits inside a furniture container the id-enumeration walked - caught only
  by screenshot.
- **`.vjs-inplayer-container`** (video.js's own in-player ad slot) and
  **`.exo-native-widget`** (an ExoClick native ad styled as a fake title
  bar) both render on TOP of the video itself, inside the hero box - a
  second screenshot pass after the first four fixes caught these two.

Verified live (throwaway browser, two different followed watch URLs):
`heroBox:1512x851` (the video's own 0.5625 ratio, full width), 24/24
related cards visible and full-bleed, topbar `translate 0 -100%` at rest /
`0 0` on hover-reveal (opacity was the wrong signal to check - this bar
moves by `translate`, not `opacity`, per the file's own longhand-over-
transform doctrine), zero horizontal overflow, all nine purge targets
computed `display:none`. Screenshot-confirmed clean at both the hero and
the scrolled related-wall. xhamster and youporn are next.

### v3.1.0

**Watch-page redesign, host 1 of 5: xnxx / xvideos.** Every gallery thumb on these two
hosts links to a video page; that page now gets the same treatment as the gallery it came
from — topbar hidden, deep dark theme, no footer/sidebar chrome (full width/height), and
a hero player at the top with the related-videos rail below it, dressed exactly like the
gallery grid. Everything else on the page (other-videos blocks, ads, comments, toolbars)
is eliminated.

Built as a second, parallel surface inside `runXnxxXvideos()`, reusing the gallery's
card-dressing, theme and topbar machinery unchanged wherever it was already
container-agnostic. New: `findPlayer()`, `watchSurface()` (a `gallery()`-shaped gate for
the watch page), `watchMarkHero()`. `applyAll()` tries `watchSurface()` as a second branch
when `gallery()` returns null; `standDown()` clears the new `data-nx-watch` root marker.

Two real bugs found and fixed via live injected-script measurement against a real watch
URL (not assumed):

- **Hero player overlapped the grid below it.** The site's own `<video>` is
  `position:absolute` inside a stale-height `position:relative` wrapper; putting
  `aspect-ratio` on the video grew the video without growing its non-participating
  parent. Fixed by moving `aspect-ratio` to the WRAPPER (`[data-nx-hero]`) and making the
  video `position:absolute; inset:0; object-fit:contain` — the same "outer box, absolute-
  fill inner content" pattern already used for gallery cards.
- **16 of 40 related cards stayed hidden.** They carry the site's own `after-15`/`after-16`
  pagination-hide classes and had zero `data-nx-*` attributes — the site populates their
  `<a href>` AFTER our paint pass, with no `childList` mutation to catch it (the file's
  gallery observer is deliberately `childList`-only, and stays that way there). Fixed with
  a scoped exception: `observeGrid()` now also watches `subtree:true,
  attributes:true, attributeFilter:['href']`, but ONLY on watch pages and bounded to the
  already-identified ~40-child grid host — plus a scoped `display:block !important`
  override that defeats the site's own `after-N` hide classes once a card is dressed.

Verified live (throwaway browser, real followed watch URL): `watch:true, heroBox:1512x851,
videoBox:1512x851, cards:40, visible:40`, footer/sidebars hidden, full-bleed dark body,
`overflowX:0`, topbar reveal-on-hover intact. Screenshot-confirmed. eporner, xhamster and
youporn are next, one host at a time — each has its own measured player and related-rail
selector, and (unlike xnxx's name-based gallery purge) already purges its own gallery by
elimination-marking, which may let the watch-page purge for those three reuse more of the
existing mechanism rather than needing a parallel `data-nx-watch` rule set.

### v3.0.0

Grounded in the fleet motto — "Off-the-shelf over hand-rolled. Proven patterns over
reinvented wheels. Community Legos over proprietary monoliths." — applied one level down,
to the scripts themselves: xnxx-thumbwall 2.2.0, eporner-thumbwall 2.3.0,
xhamster-thumbwall 1.1.1 and youporn-thumbwall 1.0.0 merge into one file, dispatched by
`location.hostname`, following the standard "universal userscript" pattern popular on
Greasy Fork (one shared runtime, a small per-host module, a dispatch table) rather than
inventing a new abstraction for the merge.

**What is actually shared, and why only that.** xhamster and youporn were, before this
merge, independent re-implementations of the identical algorithm — same lifecycle
object, same sheet-adoption dance, same topbar controller, same schedule/sweep pump, same
teardown contract. That is genuine, mechanically-verified duplication (diffed
line-for-line during the merge) and is the one place logic is actually shared, in an
"engine kit": `newLife`/`live`/`root`, `adoptSheet`/`dropSheet`, the pointer+keyboard
topbar controller, `schedule`/`sweep`, and `whenReady`. Their GATES stay deliberately
separate — xhamster measures the grid container's own box; youporn measures card boxes
and groups by nearest container, because its engine (Aylo/MindGeek) renders containers
`display:contents` with no box of their own. Forcing two differently-motivated,
field-tested algorithms through one abstraction would have been reinventing a wheel that
already turns, for a regression risk with no way to fully re-verify live in one pass.

xnxx (which also drives xvideos.com) and eporner are carried forward VERBATIM —
byte-for-byte the gate, theme engine and purge rules that shipped as 2.2.0 and 2.3.0,
each the product of real field reports fixed under time pressure the same session
(xnxx's masonry-offset and `/search-video` route fixes; eporner's `#rec-best-vid`
non-card-child fix). Wrapped as named functions, dispatched by hostname; nothing inside
either changed. Their theme mechanisms are NOT unified — xnxx is a ~400-line hand-authored
CSS palette overpaint, eporner a JS computed-style luminance repaint — two different,
independently-proven mechanisms for the same problem, left as a documented next step
rather than attempted sight-unseen.

Per-host teardown globals are unchanged (`window.__nixXnxxTeardown`,
`__nixEpornerTeardown`, `__nixXhamsterTeardown`, `__nixYoupornTeardown`): only one module
ever runs per page (hostname-gated), so there is no collision to solve, and renaming a
documented contract for uniformity alone would be cosmetic risk for zero behavioural
gain.

Verified: both repo gates (`eslint .`, the Greasy Fork meta-lint) pass on the merged
file; a live smoke test against a throwaway browser confirmed all five hosts arm with
zero exceptions and non-zero rendered cards (xhamster 47, youporn 30, xnxx 36, xvideos
27, eporner 77 — via `div.mb[data-id]`, its own marking scheme) and each host's own
teardown global registers correctly.

## eporner-thumbwall

Version history for [`eporner-thumbwall.user.js`](./eporner-thumbwall.user.js).

### v2.3.0

A block of marketing prose was sitting inside the grid on the index, and the reason four separate sweeps could not see it is the finding: **every leftover sweep written for this script asked "is this inside a keeper?", and treated a wall container as a keeper** — so anything sitting in the grid counted as kept, by construction. A grid container's children are not all cards.

`#rec-best-vid` is one of the five wall containers on the index. `p.catheadtext` is its direct child: 1512x40 of "Welcome to Eporner - the most comprehensive source of HD...". It is a grid ITEM, so it laid out alongside the cards and every sweep skipped it as part of the wall.

Enumerating direct children of a `[data-ep-wall]` container that are not `div.mb`, at 1512, showed the report was one instance of a class:

| Shape | Wall | Node | Box | What |
|---|---|---|---|---|
| index | `#rec-best-vid` | `p.catheadtext` | 1512x40 | marketing prose |
| sort | `#relateddiv` | `h5` | 1510x17 | "...but you can still check our other videos" |
| sort | `#relateddiv` | `div.clear` | 1510x0 | float clearer |
| profile | `#streameventsday` | `div.seheader` x5 | 1512x79 | a date/uploader header per group |
| profile | `#streameventsday` | `div.pclear` x5 | 1512x0 | float clearer |
| listing | — | none | — | |

395px of headers on a single profile page. The clearers are inert in a `display:grid` container, so they go with the rest rather than requiring a list of which zero-height nodes are safe.

THE GATE IS THE POINT. One rule covers the whole class, and it hides by ELIMINATION — which hides MORE as it matches LESS. If `div.mb` is ever renamed, "every child that is not a card" becomes "every child", and the wall goes blank. `:has(> div.mb[data-id])` on the container makes that rename fail the GATE instead: the rule stops matching and the page renders stock. Degrade to stock, never mangle.

After: every non-card child computes `display: none`, `0x0`, on all four shapes. The wall is untouched — 77 of 77 cards on a listing, 65 of 65 across five containers on the index, pagination present, top bar present, zero horizontal overflow.

Verified: 78/78 shapes, 21/21 copies, 31/31 teardown, 20/20 actions.


### v2.2.0

A fourth block survived the v2.1.0 purge, and the reason it did is the finding: every sweep up to here filtered candidates on the node's OWN rendered height, and `#mainBlogPosts` measures **height 0, width 1200** on the index. It is a collapsed float container - its children paint, its box does not measure - the same shape that makes the site's own `#vidresults` compute 0. A height filter could never see it, so re-running the same sweep a fourth time would have returned clean a fourth time while the block stayed on screen. The sweep now tests whether a subtree PAINTS, not whether the node is tall.

Fixing the test exposed three more, all of them lazily rendered below the fold and therefore absent from any enumeration taken a second and a half after load; the corrected sweep scrolls the document first:

| Block | Height | Shapes | What it is |
|---|---|---|---|
| `#mainBlogPosts` | 0 (collapsed) | index only | blog-post strip |
| `#toptopbel` | 36px | listing, index, tag | the sort/filter bar |
| `.bottomrelated` | 21px | listing, tag | related-tag strip |
| `#vidcontent` | 232px | `/best/` | a second content surface |

`#toptopbel` is the SORT BAR and it goes with the rest: the keep-list is the grid, the autohiding top bar and pagination, and a sort control is none of those. It is not the top bar - that is `#top2` - and v2.1.0 already carries a warning about how close `.toptopbel2` sits to this name.

After: the corrected sweep returns `[]` on all four shapes - listing, index, tag, sort. The wall is untouched: 77 of 77 cards on a listing, 65 of 65 across five containers on the index, pagination present, top bar present, zero horizontal overflow.

Verified: 78/78 shapes, 21/21 copies, 31/31 teardown, 20/20 actions (three consecutive runs - the first attempt reported 2/6, a cold-page flake on the trusted-click rig, not a regression).


### v2.2.0

xvideos shipped a **masonry homepage** and a **new search/tag card route** on the same day, and the two together broke the wall on three shapes. Both found from a real "the homepage is broken" report, then measured stock-vs-scripted.

**The black sea (index).** The new shell serves cards `position:absolute` with JS-written inline `left`/`top`, and pins the container's height inline for its own sparse masonry layout. v2.1.0 flipped the cards to `position:relative` (the /todays-selection fix) — which rejoins the grid, but a relative box still HONOURS `left`/`top` as offsets from its slot. So every card sat at its grid cell PLUS its stale masonry coordinate: track 2 at 504 landed at x=1008, alternate cells and whole rows empty, most of the page black. The stale inline container height then left a dead half-page below. Fix: `left/top/right/bottom: auto !important` on the card and `height/min-height: auto !important` on the container — the offsets and the height that only made sense under masonry, neutralised, `!important` because the engine keeps rewriting the inline style.

**Search and tag stopped arming.** The same redesign moved search/tag cards to `/search-video/<opaque base64 blob>` — no `/video.` or `/video-` in the href at all — so the two-route gate matched ZERO organic cards and those shapes stayed stock. This is `F-ONE-CARD-TYPE-TWO-ROUTES` a third time; the WHY block already noted xnxx's own `/search-video` route. Added it to `VIDEO_LINK_SEL` and `ORGANIC_SEL`, scoped to `:scope > div:has()` so a `/search-video` link in chrome cannot pull a non-gallery page into scope.

After: index renders a uniform full-bleed 503x283 grid (was a black sea), document height 4955→2414, search/tag arm at full 1512 width. Verified: **xvideos 168/170** (the two misses are the index pager under the site's infinite-append reflow — a trusted click DOES navigate; the pager's absolute y shifts between hit-test and click on this lazily-appending shape), **xnxx 88/88** — no regression on either xnxx shell.


### v2.1.0

Everything except the grid, the top bar and pagination is now actually gone. v2.0.0 narrowed the SCOPE; this finishes the PURGE inside it.

Enumerated at 1512 under the script: every rendered block taller than 6px that is not inside a wall container, not inside a card, not inside the top bar and not inside .numlist2. Three survived the v2.0.0 rules, all below the wall where they are easy to miss - #footadframe at 655px and #btasd at 545px on both shapes, and #mainphotos at 613px on the index, a photo gallery of ten-plus cards. The first two are advertising; the third is a second content surface, out of scope by the same decision that leaves /pics/ alone.

Removing those EXPOSED four more that the first enumeration could not reach, because they sat below roughly 1800px of ad frame and photo strip: .vidresultsbottom at 223px with seven channel cards, .footer-text at 124px, and .toptopbel2 twice at 36px, the headings labelling those strips. That layering is the finding rather than an afterthought - each removal changes what the next enumeration can see, so "enumerate once and purge" is not enough and the check has to be re-run after every change.

One near-miss worth recording: .toptopbel2 is NOT the sort bar. The sort control is #toptopbel, an id, and it sits above the wall; .toptopbel2 is a class on the headings for the strips below it. The names are one character apart and were checked rather than assumed.

The anchors are those four ids and three classes rather than a height test, and that is deliberate: everything else the enumeration returned was an ANCESTOR of the wall - #content, MAIN, .results-video-results-layout, #div-search-results - so "hide anything tall below the grid" would have taken the wall's own container with it.

After: both shapes return only the wall's own ancestors. The index drops from 8792px to 6736px of document. The wall itself is untouched - 77 of 77 cards visible on a listing, 65 of 65 across five containers on the index, pagination present, top bar present, zero horizontal overflow on both.

Verified: 78/78 shapes, 21/21 copies, 31/31 teardown, 20/20 actions.


### v2.1.0

**xvideos.com, and it cost three anchors rather than a second script.** The two sites are one operator and ship the same markup — `.mozaique`, `.thumb-block`, `.pagination` — so the question was never "write an xvideos userscript", it was "how much of this one is actually about xnxx?". The answer, measured: about five lines.

The experiment came first. Injected into xvideos unchanged, the v2.0.0 build measured an organic share of 0 on every shape and **correctly declined to arm**: stock page, no errors, no overflow, cards untouched. That is the degrade-to-stock contract doing its job, and it is also how a sibling site announces itself.

The single character behind it: xnxx serves a card as `/video-<id>/<slug>`, xvideos as `/video.<id>/<slug>`. The gate read only the first. So did `gridReadTitle`, in a second place — which is why on xvideos the cards dressed correctly and the hover title was **silently absent on every shape**. Both routes now live in one `VIDEO_LINK_SEL` constant so they cannot drift apart again.

| What | xnxx | xvideos |
|---|---|---|
| card route | `/video-` | `/video.` |
| top bar | `#header`, both shells | `#header` on `/best`; `div.head__top` elsewhere |
| second nav row | — | `div.head__menu-line` (purged: chrome) |
| sort/filter control | `div.infobar` (month chooser, 323 links) | `.listing_filters` + `.date-links` |
| body inline padding | 0 | **80px** |

That last row was the headline defect. The bleed walk widens every ancestor between the grid and `<body>` and stops there, because widening the body is not a thing — and xnxx's body has no inline padding, so it never mattered. xvideos' `body.body--home` computes `padding-left/right: 80px`, and the wall measured **1352 inside a 1512 viewport, 2400 inside 2560**: short by exactly twice the padding at every width. Physical longhands, not `padding-inline` — a logical/physical pair resolves by cascade ORDER, not specificity.

THE FOCUS REVEAL IS NO LONGER `:focus-within`, AND THAT IS MEASURED. xvideos' index focuses an `INPUT` inside the bar at load — `activeElement` INPUT, bar `:focus-within` true, no `[autofocus]` attribute, so it is JS-driven. A `:focus-within` rule is therefore true from load and **the bar never hides**: measured rest opacity 1 on the index while every other shape measured 0. The reveal is now gated on the reader having acted, exactly as the sibling eporner script does it. The keyboard route is not weakened — the first Tab IS the act that opens the gate, and the same keystroke lands focus in the bar.

Also new, and a class rather than an instance: **non-card children of the grid itself** are hidden — `div.clearfix` on the index, a bare `<script>` as the first child on `/best`. Every keeper-based sweep is blind to these, because it asks "is this inside a keeper?" and the grid IS a keeper. The rule hides by elimination, so it is gated on the container actually holding a card (`:has(> div.thumb-block)`): rename the card and the gate fails and the rule stops matching, rather than blanking the wall.

`xvideos.red` joins `xnxx.gold` and `zline0.com` in the bar-promo purge, and it arrived through the CONTRAST audit rather than a promo sweep — its "Premium" label is white on brand red `rgb(222, 38, 0)`, 4.36:1, the single failing text pair on three shapes. `a[href*="/account/create"]` is deliberately NOT taken: that is the site's own signup, a legitimate function of a bar we keep.

Verified with page-lab's redesign runner at document-start, trusted events, four xvideos shapes and two xnxx shapes: **xvideos 171/171, xnxx 88/88.** Full-bleed at 1280/1512/1920/2560, no overflow, out-of-scope shapes byte-identical to a stock load.


### v2.0.0

Two scope decisions from the operator, and between them they delete about a third of the script. The version is a major bump because the behaviour change is subtractive and deliberate: pages this script used to restyle are now left completely alone.

ONLY GALLERY PAGES. The script runs on pages carrying a gallery of cards that link directly to video pages, and on nothing else. Every other shape - the watch page, /cats/, /pics/, /pornstar-list/, /login/ - now gets no sheet, no root attribute, no markers and NO THEME. A page that is not the surface you came for should not be touched at all, and "while we are here, make it dark too" is exactly how a two-rule change became two thousand lines.

Deleted with it: the entire drawer, its scrim, its corner control, the focus trap and inert handling, all relocation of the site's own controls, the stranded-link harvesting and its Site section, the adopt/relocate mode split, and the watch-page island. Every one of those existed to solve a problem created by widening the scope. The drawer existed because chrome was removed; the harvesting existed because the drawer hid things; the modes existed because two shells hid them differently. None of it served the wall.

What replaces the drawer is a handful of rules: the top bar autohides. Hidden at rest, revealed when the pointer comes within a few pixels of the top edge and when keyboard focus lands inside it. Not scroll-driven - scroll position is never read. Side rails and the footer are purged outright on gallery pages, and nothing is stranded by that, because on every page we now leave alone every route is still exactly where the site put it.

DESKTOP ONLY. A userscript manager runs in a desktop browser; mobile Chrome has no extension support at all, so no reader ever meets this script at 320px. Both (hover: none) branches are gone - one pinning the title overlay open, one pinning the top bar open - along with the min(...,100%) wrapper on the card clamp.

That wrapper was measured before it was removed, because its stated job was subtler than a viewport width: it capped the track at the container so a narrow CONTAINER could not overflow its own grid. Measured 2026-09-13 across every shape: every wall container is full-viewport - one on a listing, five on the index, six on a profile, all 1280 at 1280 and 2560 at 2560 - because our own rules make them full-bleed. The narrowest is 1280 against a 510px clamp maximum, so it had no case left to defend.

Three things that look responsive were deliberately KEPT. The intrinsic repeat(auto-fill, minmax(...)) rule is not a concession to phones: it is what lets one rule serve 1280 through 2560 without a breakpoint stack. :focus-within is the keyboard path, not the touch path, and a desktop keyboard user needs it. prefers-reduced-motion is an accessibility preference rather than a viewport.

Verified against the new scope: 78/78 shapes, 21/21 copies, 31/31 teardown, 20/20 primary actions. The actions suite reads 16/20 on about one run in three and 20/20 otherwise - the site serves a smartpop that navigates the tab away, which presents as a dead input rig, and the same four checks cascade from it.

2098 lines to 1470.

### v1.2.0

Autoplay-on-hover works again. It was ours, it was reported twice, and both times I measured it wrong before measuring it right.

The site injects its preview as `video < a < div.previdthumb`, and `.previdthumb` sits AFTER the still image in normal flow - so it begins one full card-height down. The wall fills `.mbcontent` absolutely, which left the preview arriving below the frame it belonged to. Measured with the script applied: the video reached readyState 4 and paused false at opacity 1, visibility visible, at box [0, 225, 399, 225] inside a card whose frame ends at 225. It had been playing correctly the whole time, just off the bottom of its own card.

The first attempt at a fix made the VIDEO an absolute fill, which was the right idea against the wrong containing block: `inset: 0` resolves against the nearest positioned ancestor, and that is the wrapper, not the frame. So the video moved to the wrapper's origin, which is still y=225. Filling the WRAPPER fixes the position, and the video then only has to fill the wrapper. Stacking sits at z-index 1 - above the still, below the title overlay's 2 - so a hover shows the preview and the title rather than trading one for the other. Measured after: box [0, 0, 399, 225], and elementFromPoint at the video's own centre returns VIDEO rather than IMG.

The still is left exactly where it is, so when the site removes the preview on mouseout there is nothing to restore and no state of ours to get wrong.

Two earlier measurements of this reported "works identically stock and scripted" and are worth recording as the reason it shipped broken twice. Both were taken through a raw `Page.addScriptToEvaluateOnNewDocument` with no harness wrap, so `document.documentElement` was still null, the script's own guard returned, and BOTH arms were stock. Stock-versus-stock is not a comparison, and it produced a confident report that the feature was fine. page-lab's harness wraps the body for exactly this case, and the wrap is skipped by passing the body as an `openLab` option instead of through `addDocStart`.

Verified: 121/121 shapes, 15/15 copies, 20/20 teardown. The actions suite reads 11/15 on roughly one run in four and 15/15 otherwise, identically before and after this change - the site serves a smartpop that navigates the tab away, which presents as a dead input rig.

### v1.1.1

The hover overlay showed the video LENGTH instead of the title — bottom-left, "12:34" where a name belongs. Cards hydrate in stages, and the title reader ran in whatever stage a pass caught: in one window the duration badge is hydrated inside the image link while the title anchor is still empty, so the duration won the longest-candidate contest, and the dress-once early-return froze it as the title forever. In the lab, passes landed after hydration and read correct titles every time — which is why v1.1.0 shipped clean and the defect only appeared in real use.

Two changes. First, what counts as a title is now stated: a title has letters; markup is never a title; a bare duration (`^[\d:.\s]+$`) is never a title; and the anchor's `title` ATTRIBUTE — the semantic field — beats textContent when present. Second, the early-return became an UPGRADE path: a card dressed before hydration carries a slug-derived title marked `data-xh-tsrc="slug"`, and when the real attribute arrives a later pass replaces it, once.

Measured across 148 overlays on three shapes: zero duration-shaped, zero markup, zero letterless; sources attr/text/slug all present, every slug entry upgrade-eligible. Preview, template and furniture checks unchanged from v1.1.0; acceptance suite 154/156 with the two misses reproducing as the known cold-page pager flake (pagination group alone: 16/16, twice).


### v1.1.0

One card width for every site, and a watch page that is a player and a gallery.

The card clamp is now identical to the sibling script's: a per-site value meant the same reader met a 319px card on one site and a 503px card on the next, which reads as two unrelated redesigns rather than one. Measured at 1512 this yields 503x283 here, matching exactly. The min(...,100%) wrap stays, and is what keeps a 300px floor plus the gap from overflowing a 320px viewport.

The watch page loses its furniture. Measured at 1512 under the script: #movieplayer-box-adv at 760px starting at the player's own y, three NTV boxes of 250px stacked inside it, #adPlayerIfr at 250px, #commentdiv at 616px, and #morerelated as a bare 30px label above the grid. All gone, gated on the same shell-ready attribute as every other removal so a page where the shell never mounted renders stock rather than stripped. The player then takes the width the stock box was already reserving for the ad column beside it: 1208 to 1280 wide, 680 to 738 tall, capped in dvh so a mobile URL bar cannot clip it.

Reported alongside these and NOT reproduced: hover autoplay. Measured on a listing, stock versus scripted, the preview behaves identically - readyState 4, paused false, 319x180 at opacity 1, and the video is the topmost element at the card centre with nothing of ours covering it. The mechanism is the site's own and our CSS does not touch it. The difference is more likely to be an ad blocker, which on the sibling site was measured changing an entire listing into ad units.

Six measurement errors of my own this round are worth recording, because five were the same family and the sixth had its answer already written down. A CDP document-start probe injects EARLIER than a userscript manager's document-start, so document.documentElement is still null and the script's own guard returns - the page then reports stock and reads as a total failure. page-lab's harness wraps the body for exactly this, and the wrap is skipped by passing the body as an openLab option rather than through addDocStart. Every reading taken before that was corrected - including a footer that looked un-removed - was against a script that had never run.


Version history for [`eporner-thumbwall.user.js`](./eporner-thumbwall.user.js).

### v1.1.0

Two defects from first real use — no hover preview, and the thumbnail template visibly broken — and they were **one bug**. v1.0.0 absolutely-filled EVERY direct child of a card; a card's children are not one image link. Measured on `/newest`: the date block and the title/info block were both stretched to the full 503x283 tile and stacked OVER the image — the visible template violation — and the stretched info block sat on top of the image link, **eating the pointer**. The site injects its hover preview INSIDE that link (measured stock: `card > a.video-thumb__image-container > video`, playing at t=2.5s under a trusted hover), so a pointer that never reached the link never spawned a preview. One stretched sibling broke the template AND the autoplay at once.

The fix is precision, not more machinery: only the image link (`> a`) fills the tile; the sibling `div`s — date, title/info row, and on unhydrated cards a raw SSR fragment — are hidden as the furniture they are, which is the cross-site standard anyway. Nothing hidden can carry the preview, because the preview arrives inside the link.

A third defect surfaced by the same measurement: on unhydrated cards, an anchor's textContent is RAW MARKUP as literal text, and v1.0.0's title reader happily displayed an img tag as prose in the hover overlay. Markup is never a title; such anchors are skipped and the href slug (present from the first byte) takes over.

Honest accounting: v1.0.0's 155/155 verification **never exercised the hover preview under the script** — the suite checks the overlay, the bar and the geometry, not the site's own preview behaviour. That check exists now (trusted hover, preview playing INSIDE the card's link, per shape) and is part of this release's evidence.

Verified: preview playing at 503x283 on all four shapes under trusted hover, ratio 1.78, zero visible furniture, zero markup titles — and the acceptance suite again at **155/155**.


### v1.0.0

A full-bleed thumbnail wall for eporner, with every site control folded into one overlay drawer. Built as three parallel lanes against a shared, measured contract and then merged, so the interesting part of this entry is what the merge DELETED rather than what it added: six duplicated mechanisms, collapsed to one of each.

The arithmetic is worth stating plainly rather than dressing up, because the headline number goes the wrong way. The stylesheet shrank — 796 fragment lines to 741 — but the JavaScript GREW, 962 to 1114. That is not the merge failing to delete; it is the merge supplying something the fragments never had. Three fragments of plain functions ship no coordinator at all: no lifecycle object, no bootstrap, no sheet adoption, no teardown, no chaining of the previous copy's teardown, no gate that decides whether to run. That is about 200 lines which did not exist before and have no duplicate to remove. Net of it, the shared machinery is smaller than the two copies it replaced — and the count that actually matters is that there is now exactly one of each mechanism instead of two.

The theme lane was deleted before it was written, and that is the headline finding. eporner already ships dark, and dark is the DEFAULT: measured on a cookie-less profile, body background is rgb(0,0,0) as loaded. Light is the opt-in layer — `html.epwhite`, 476 rules — with the site's own `EP.page.switchColor` API and an `epcolor` cookie that survives reload, and `prefers-color-scheme` gets zero hits anywhere. There are no theme custom properties; the colours are literal. So there is no palette here, no token remap, and no CSSOM rewrite. The single stylesheet is same-origin and readable, which makes a remap POSSIBLE and entirely UNNECESSARY — not the same thing. `.epwhite` is dropped once at init to deliver the brief and never enforced after, so a reader who deliberately clicks white gets white, and teardown does not re-add it because the cookie is untouched and a reload restores their own choice. What remains is ink, not ground: about a dozen rules still read light, repaired by measured contrast ratio rather than by a selector list. Keying on a "background is light" branch would have missed the case that actually occurs — the recurring #666 ink measures 2.22:1, and solving that for its ground gives luminance 0.0324, about #323232, not the body's black.

There is no single grid container, which is the biggest structural difference from anything else in this repo. A listing has one, the index five, a profile six, a watch page one — and a profile's count is a property of that profile, since the containers are its day groups: `/profile/degetica/` has six and `/profile/Ironoreeater/` three. The wall collects the parent of every organic card instead of matching `div:has(> div.mb[data-id])`, which yields the same set, cannot be fooled by an ancestor match the way `:has()` can, and needs no `:has()` at all. The layout underneath is a legacy FLOAT grid — display block, `grid-template-columns: none`, cards `float: left` — and `#vidresults` computing height 0 is correct stock behaviour, not a bug, because every child floats and nothing clears. Grid items ignore float per spec, so blockifying the container is the float reset; no per-card `float: none` is needed.

The gate is an organic SHARE, not a count. Four of twelve shapes carry zero organic cards — `/cats/`, `/pics/`, `/pornstar-list/`, `/login/` — and every rule that hides by elimination is gated behind organic content being present in share, floor 0.5, plus a count of at least four. Content shapes measure 0.983 to 1.00 and the four empty shapes measure 0. The reason it is a share and not a count is the previous site, where a gate satisfied by a single organic card let a complement rule hide 38 of 39 units.

Promo removal needs slot anchors as well as card anchors, and the Grid lane proved that rather than assuming it. The card test is settled — `div.mb:has([class*=adnative])`, zero false positives and zero missed on 8/8 shapes, against six false positives for the obvious `div.mb:not([data-id])` on the watch page, where those are organic playlist cards. But a census of every non-card direct child of every container across eight shapes found six ad SLOTS beside the cards, and `:has(iframe)` catches only two of them: `div.ad300px` renders a native ad as plain links and images with no iframe, no `ins` and no `adnative` at all. Untreated, the listing slot rendered as a 1310x542 full-row band that pushed the first card to y=809, below the fold; treated, y=261. The same census confirmed twelve organic non-card children carry zero iframes and are untouched.

Two pieces of received wisdom were measured and rejected. The sleazyfork shelf — eleven scripts for this site — insists on preferring `data-src` over `src` because `src` is "a placeholder"; measured, `decodedZero` is 0 on every shape and `data-src` is present on 0 of 202 profile cards, so following that advice blanks the entire profile page. And `inline-size: auto` did not beat the site's `ul.listcatsmall{width:543px}`: a logical/physical pair is resolved by cascade ORDER, not specificity, so the drawer overflowed its own box by 157px at 1280 and 2560 until every repair switched to the physical longhand.

What the merge deleted. Two sweeps became one (24 ticks at 250ms, covering both lanes' windows). Two listener-bookkeeping schemes — a hand-matched `addEventListener`/`removeEventListener` pair set and a `bound[]` array with its removal loop — became one `AbortController` whose `abort()` is the whole of that half of teardown. Two container lookups became one. Two module-scope state bags became one lifecycle object. Three timing values and two easing curves became two duration tokens and one curve, zeroed under reduced motion by redefining the tokens rather than re-listing the animated selectors. The two named ad-slot anchors, which both lanes had arrived with — one scoped inside the wall containers, one page-wide, the narrow set a strict subset of the wide one — became a single page-wide rule under either gate, taking about 45 lines of duplicated census comment with it. Neither lane declared the own-UI exclusion list, correctly: a second `const EP_OWN` in one shared scope is a SyntaxError, not an override. It is declared once here and expanded into the ownership test, the inert walk and the link harvest, replacing three ad-hoc ownership checks.

The bootstrap trap was designed for rather than discovered, because it cost a full round on the previous site. A teardown that begins by reading the lifecycle and returning when it is null cannot cancel work belonging to a copy that has not started yet: that copy's bootstrap listener is still waiting on DOMContentLoaded, so it starts anyway, and the symptom is LINEAR in copy count. A module-scope `boot` AbortController's `abort()` is therefore the first statement of teardown, ahead of that return, and the DOMContentLoaded mount is registered against its signal. The ordering that makes this work is subtle enough to be worth recording: `startEarly()` must NOT call teardown, because teardown aborts `boot` and would kill the listener before it was added. The previous copy's teardown is called once, at entry, instead. Verified with THREE copies rather than two — two can read as "one extra" and be blamed on a mount running twice — all registered as separate document-start scripts: exactly one panel, one corner control, one scrim and one adopted sheet at one, two and three copies, and a re-run into an already-loaded document still applying rather than silently no-opping, which is what an "already init" early return would have broken while every count stayed at one.

Verified by real navigation, not by injection. The shipped script runs at document-start, before the site's JS; an eval into a loaded page tests a world it never sees, and on the previous site 88 such checks reported zero failures with five defects live. Everything went through `Page.addScriptToEvaluateOnNewDocument` and real navigations on a throwaway browser. Results: 121/121 on the shape suite at each of 320, 1280 and 2560 across eight URL shapes, 15/15 on copies, 20/20 on teardown, 15/15 on primary actions. Teardown restores every relocated node to its original parent AND its original next sibling — a node re-appended to the right parent at the wrong index is a silent reorder that a parent-only check calls a pass — with every `data-ep-*` marker back to zero, the adopted sheet dropped, and the float layout, chrome and pagination stock again on three shapes. A trusted click on a card still navigates to a watch route, and search still submits from inside the drawer.

Five of the failures found along the way were in the SPEC, not the code, and each is recorded in the specs themselves so the next pass does not re-learn them: the watch route canonicalises its slug server-side, so asserting the requested path reads as a dead page; `#header` computes height 0 on stock because its `#top2` child is `position: fixed`, making it a vacuous "chrome removed" probe; the listing serves 76 and 77 cards on consecutive loads, so stock's own count is never the yardstick — the sound invariant is that the redesign hides no card stock renders, which is exactly what the 38-of-39 complement failure would violate; at 320 the profile's `.plexcontainer` holds cards that measure 0x0 ON STOCK, so demanding zero hidden there fails the site rather than the script; and the site serves a smartpop that navigates the tab to a cam route seconds after load, which made a perfectly good card link report "the rig is dead". `process.exit()` also does not flush a redirected stdout, which silently swallowed a 121-check report twice.

Known and not fixed: on the watch page above roughly 1600px, full bleed widens `#content` and the site's percentage-ratio player box inflates while the `<video>` stays capped at 1280px wide, so the player gains letterbox bands — measured at 2560 as a 1280x1269 box against 1280x723 on stock, pushing the related grid from y=988 to y=1454. Horizontal overflow is 0 at every width and the player still plays; the cost is vertical, and only on the one shape where the grid is secondary. Capping the player would mean a new rule on a surface neither lane measured, so it is recorded rather than traded.

Also recorded: `.ep-thumbwall-meta` is carried in the own-UI list from the reconciled contract, but nothing in the shipped code mints it — the wall creates zero own DOM, since its title overlay is the site's own `div.mbunder` re-anchored in place. It is kept rather than silently dropped, because the whole point of one list is that a future overlay node cannot be added to some call sites and not others.

## xhamster-thumbwall

Version history for [`xhamster-thumbwall.user.js`](./xhamster-thumbwall.user.js).

### v1.0.0

A full-bleed wall for xhamster gallery pages. **701 lines against the sibling scripts' 2576 and 1500**, and the difference is one measurement.

**IT DOES NO THEMING.** xhamster already ships a dark theme: `documentElement` background `rgb(0, 0, 0)`, body colour `rgb(245, 245, 245)`, 2 `prefers-color-scheme` blocks. Driving a site's own theme beats overpainting it on every axis — no palette, no computed-style repaint, no contrast repair, and it survives the site's own redesigns. The entire theming half of this script does not exist because the survey said it was not needed.

THE GATE IS FOUR SIGNALS, AND THE FOURTH IS PAGINATION.

| shape | units | rows | share | pager | qualifies |
|---|---|---|---|---|---|
| `/` | 51 | 15 | 0.944 | yes | YES |
| `/categories/*` | 50 | 15 | 0.926 | yes | YES |
| `/search/*` | 50 | 15 | 0.926 | yes | YES |
| `/newest` | 47 | 16 | 0.922 | yes | YES |
| **watch** | 14 | 2 | **1.00** | **no** | no |
| `/photos` | 4 | 1 | — | yes | no (a RAIL) |
| `/pornstars`, `/channels` | 0 | — | — | — | no |

The watch page is why the pager is a gate. Its related strip is a multi-row grid of video cards that preview on hover and link to video pages — an organic share of **1.00, higher than any real gallery** — so a three-signal gate admits it. It has no pagination.

THE CHROME CANNOT BE PURGED BY NAME, and the site forces that. Of the blocks left outside the wall, four carry hand-authored names and **five carry a build hash** — `root-e93c1`, `root-0f71b`, `compactEntitiesList-7d3c8`, `relatedContainerList-3d73a`, `bottomDescription-7d3c8` — and two have **no class at all**. One such class, `scrollable-7fed9`, stopped matching between two loads of the same page **minutes apart**. So this script names nothing: it marks the wall, the pager, the bar and the wall's ancestors with its own attributes and hides everything else by elimination — which makes the gate load-bearing twice over, since a failed gate marks nothing and no rule matches.

Four defects found during the build, each by measurement rather than by looking:

- **The bar was never hidden.** `header` computes `display: contents` stock, so it generates no box and `position`, `opacity` and `pointer-events` on it all do nothing. A probe reading the *declared* opacity reported the bar hidden while it was fully visible. It needs `display: block` before anything else applies.
- **The bar was then purged.** It hangs off a wrapper that is a *sibling* of the path to the wall, so the elimination rule hid it and the autohide toggled opacity on a `display: none` box. Its whole chain is marked as a keeper — without marking it an ancestor, so its own children are left alone.
- **The wall measured 569px inside a 1512 viewport** on the category shape: an ancestor is `display: inline-block`, where `width: auto` means shrink-to-fit. `width: 100%` resolves against the containing block on both box types.
- **39 of 50 cards had no title.** The card's link carries neither a `title` attribute nor text — the markup is framework placeholder comments plus an image container, and the readable title hydrates later. The **href slug** carries it from the first byte, so the title is derived from there.

Verified with page-lab's redesign runner at document-start, trusted events, four shapes: **155/155**. Full-bleed at 1280/1512/1920/2560, zero strays, zero non-card children in the wall, overlays on every card, the bar hidden at rest and revealed by pointer and by keyboard, and the watch page and `/photos` byte-identical to a stock load.


## youporn-thumbwall

Version history for [`youporn-thumbwall.user.js`](./youporn-thumbwall.user.js).

### v1.0.0

A full-bleed wall for youporn gallery pages, and the first script in this repo to face the **Aylo/MindGeek engine** (pornhub's family). It is a different rendering model from the other four sites, and getting the gate to fire took a long measured diagnosis rather than a config.

**IT DOES NO THEMING.** youporn ships an unconditional dark theme — `documentElement` and body `rgb(0,0,0)` under both `prefers-color-scheme` values, zero scheme blocks — so like the xhamster sibling this carries no palette.

**THE GATE IS BOX-AGNOSTIC, and that is the central finding.** The Aylo grid container computes `display:contents` through nested wrappers: it has NO box of its own while its cards lay out via a distant ancestor's grid. Every box-based container test read a fully populated wall as empty. The CARDS are real boxes (~316×278), so the gate finds rendering cards, groups them by their nearest `div.full-row-thumbs`, and never measures the container. Four signals still apply — card count, rows (from card positions), organic share, and pagination — and the pager (`nav#pagination`) is what rejects the watch page.

**AND THE CARDS ARE `visibility:hidden` UNTIL THEIR IMAGE LAZY-LOADS.** The engine ships each card, and the pager, `visibility:hidden` with the layout box already allocated, revealing them one at a time as thumbnails load. A gate that excluded `visibility:hidden` saw the whole wall as absent; the whole page rendered as an invisible-but-laid-out black rectangle. So the gate counts a card by its box and its link, never its visibility, and the wall forces `visibility:visible` on cards and images to show them all at once. The bar is kept `visibility:visible` at rest too (hidden by opacity), or a `visibility:hidden` bar would be out of the keyboard tab order and its focus-reveal could never fire.

**THE ENGINE CHURNS.** It re-renders the listing continuously, so `qualify()` returns null on some passes of a page that IS a gallery. Tearing down on every transient null makes the wall flicker and land stock; the wall now stays armed while the URL path is unchanged and only a real navigation to a non-qualifying page disarms.

The homepage stacks FOUR grids (recommended + three most-recent); this script marks every qualifying `full-row-thumbs` and seeds the elimination purge from all of them, rather than picking one winner. Chrome is purged by elimination (footer is class-less, one content block hashed), scoped to marked ancestors so a failed gate renders stock.

Verified: armed on index (3–4 grids), category and search; the watch page left stock; full-bleed 1512 with no overflow; the wall rendered and screenshot-confirmed as a clean 3-column grid on the native dark ground; the top bar hidden at rest and revealed by both pointer and keyboard. Acceptance suite **111/116** — the five misses are all one root cause, youporn's `visibility:hidden` lazy loading interacting with a lab that does not fetch thumbnail images: stock and broken-anchor states read blank because stock youporn is itself blank without image loads, and the pager check clicks a `javascript:void(0)` control button because the engine ships its real numbered links below the fold and `visibility:hidden`. The real numbered `?page=N` links navigate for a user, and the wall renders — both confirmed by direct measurement and screenshot.


## xnxx-thumbwall

Version history for [`xnxx-thumbwall.user.js`](./xnxx-thumbwall.user.js).

### Unreleased

A hard narrowing, and it is almost entirely a deletion. `@version` is deliberately still 1.7.0 - the bump is the operator's, and a same-version re-install is a silent no-op, so nothing here is installable until that happens.

THE SCOPE IS NOW ONE QUESTION: does this page carry a gallery of cards that link directly to video pages? If yes, the wall applies, the theme applies, the rails and footer go, and the topbar autohides. If no, NOTHING happens - no stylesheet is adopted, no attribute is written, no node is marked, no listener is armed, no colour changes. That second half is the headline, and it is measured rather than asserted: `/`, `/pornstars` and `/video-*` were fingerprinted stock and again with the script running at document-start, and the two fingerprints are identical - same `<html>` attributes, `adoptedStyleSheets.length` 0, zero `data-nx-*` nodes, zero nodes of ours, zero inline-painted nodes, same body ground, same link colours.

The watch page needed its own test and could never have been caught by a count. Its related-videos rail is 40 of 40 organic - a cleaner listing than any real listing - so `body.video-page` and `DIV#html5video` are both checked, measured 8/8 over eight consecutive loads of one URL. The single class is the anchor, never the class list: three of those eight loads also carried `.exo-ad-ins-container`.

The tile tier is gone with the pages it existed for. `/` serves 160 category tiles and `/pornstars` 80 profile tiles, each with zero `/video-` links; they used to be rescued by a second "a child with a picture and a link" selector so the theme could reach them. They now fail the gate like anything else. A profile page fails it too, and for a reason worth recording: its RENDERED gallery (`#psvideos`, 1501x3514, 50 cards) links `/<x>/pornstar/<...>`, not `/video-`, while the 50-card `.mozaique` that does carry video links sits inside `#gold-videos` under a `display:none` parent at 0x0.

DELETED: the entire drawer, and with it the adopt/relocate MODE SPLIT that existed only to decide between adopting the site's own mobile panel and building one. No mode means no structural mode detection, no mode branches and no rule keyed on a mode. Also gone - the corner control and its exit-mode swap and `window.__nixXnxxCorner`, the scrim, the focus trap and `inert` handling, every relocation and its M7 ancestor-chain repairs, the stranded-link harvest and its Site section, the `.mobile-show` / `.mobile-hide` un-gating and the whole mobile-shell inheritance, the column-density control that drove the site's own `nb-thumbs-cols-*` feature, the video-page keep-only island (`vidIsland`/`vidRevert`) and its bigger-player rules, the category-rail and mobile-drawer theme sections, and the `NX_OWN` / `NOT_OURS` own-UI guard - the only node this script still creates is the card's title overlay, which contains no link, button or input, so every tag-anchored rule misses it on its own and a guard there would be cover that is not there.

3,763 lines and 172,920 bytes became 2,576 lines and 123,766 bytes - 1,187 lines and 49,154 bytes deleted, 32% of the file. Split by part, and the split is the point: the stylesheet went 1,811 -> 1,291 lines (-520), the JavaScript 1,649 -> 928 (-721), and the WHY block GREW 288 -> 341 (+53), because the gate, the topbar and the two contrast defects each had to be written down with their measurements. Net of the comment growth, 1,241 lines of machinery left.

ADDED: the topbar autohides. It is the site's own `#header`, taken out of flow with `position: fixed !important` - `!important` because the site's header JS rewrites it to `position: relative` the moment `input#k` takes focus - and left at `opacity: 0; pointer-events: none` until the pointer comes within 4px of the top of the viewport. It is hidden by PAINT, never by a transform or a translate: a transformed ancestor becomes the containing block for every fixed descendant, and these pages carry fixed nodes. `display: none` was rejected for a different reason - a display:none bar cannot be focused, and `#header:focus-within` is the second, independent reveal that gives a keyboard user a route to the search box with no JS and no attribute involved. Reveal is pointer-driven rather than scroll-driven, with 8px of hysteresis below the bar's own MEASURED bottom edge, and the transition lives inside `prefers-reduced-motion: no-preference` so under `reduce` the bar simply appears.

The `<header>` trap this repo has hit before is resolved rather than dodged: on shell A `#header` is a DIV whose only child is the `<header>` TAG, on shell B `#header` IS that tag. Every rule is written on the ID and no rule in this file selects the bare tag, so the nesting is moot. Measured zero `position: fixed` descendants inside `#header` on either shell, so taking it out of flow re-anchors nothing.

The rails and the footer are purged. Shell A's `#side-categories` is 200x3141 IN FLOW on `/` and `/todays-selection` - it is what pushes the grid to x=220 - and 200x20 absolute at x=-210 elsewhere; shell B's `#side-menu` is already `display: none` and is hidden anyway. There is NO right rail on any qualifying shape, so none is named: a selector for a node that does not exist is cover that is not there.

DESKTOP ONLY, at the operator's direction, and the reasoning is simply true - a userscript manager runs in a desktop browser and mobile Chrome ships no extensions, so no reader ever meets this file at 320 or 768. Removed with that: the `@media (hover: none)` pin that held the title overlay open for a touch pointer, and the 320/768 arms of every width matrix. Nothing else was aimed at a small viewport - the `env(safe-area-inset-*)` padding and the `min(380px, 92vw)` drawer width had already gone with the drawer. KEPT deliberately: `dvh`, `prefers-reduced-motion`, `:focus-within` on the overlay (that is the keyboard path, not the touch path), and the intrinsic `repeat(auto-fill, minmax(clamp(300px, 28.5vw, 510px), 1fr))` rule, which is not a responsive concession but the thing that serves 1280 through 2560 without a breakpoint stack - measured laying out 3 / 3 / 3 / 5 tracks at 1280 / 1512 / 1920 / 2560 with the grid width equal to the viewport at all four.

TWO CONTRAST DEFECTS were found and fixed, and the cause will happen again so it is named in the header: THE STATIC SHEET AND THE MATHEMATICAL REPAINT CAN FIGHT. The sheet painted the search button and the current-page pagination chip with a light ACCENT fill and a dark ink; the repaint then darkened the fill - correctly, by its own rule, since it darkens every light surface it finds - and left the ink. Measured 1.21:1 on shell A and 2.29:1 on shell B. Both were invisible before this change only because both nodes lived inside a closed drawer or a deleted header. Both now use a dark chrome fill and mark themselves with ink and border instead. Re-measured at 1280 / 1512 / 2560: stock worst pair 5.31 on both shells, ours 9.13 (shell A) and 7.06 at 1280 / 9.41 above it (shell B), with ZERO sub-AA nodes and ZERO light surfaces left.

Horizontal overflow, desktop range: the STOCK shell B `/hits` page overflows 90px at 1280 and zero above it, the offender being `#header .header-bottom .header-settings`, a flex row of icon buttons that will not shrink. Scripted is ZERO at 1280 / 1512 / 1920 / 2560 on both shells, with the topbar hidden AND with it revealed - a fixed box contributes nothing to the scroll width. The old rule that DELETED the header outright is gone with the relocation it depended on.

Verified, all at document-start through the harness wrap rather than a raw injection: 59/59 on the new scope suite, 39/39 on the shape sweep, 40/40 on the wall detail suite, 12/12 on lifecycle - THREE document-start copies producing exactly one adopted sheet, one marked grid host and one overlay per card, and a teardown whose fingerprint is identical to the stock page - and the colour audit clean on both shells with the watch page measured NOT repainted at all.

### v2.0.0

The same two scope decisions as the sibling script, and here they delete a third of the file. Major bump because it is subtractive by intent: pages this script used to restyle are now left completely alone.

ONLY GALLERY PAGES. It runs where a gallery of cards links directly to video pages, and nowhere else. /video-*, / and /pornstars now get no sheet, no root attribute, no markers and no theme - proven rather than asserted: stock and document-start-scripted fingerprints are identical, with adoptedStyleSheets length 0, zero data-nx-* nodes, zero nodes of ours, zero inline-painted nodes, and the same body ground and link colours.

Deleted: the whole drawer; the adopt/relocate MODE SPLIT and every rule keyed on it; the corner control and its exit swap; the scrim; the focus trap and inert handling; all relocation and the repair rules it needed; the stranded-link harvest and Site section; the .mobile-show/.mobile-hide un-gating and the whole mobile-shell inheritance; the density control; the video-page keep-only island; the tile tier; and the own-UI guard list, which became vacuous once the overlay is the only thing we build. Every comment describing that machinery went with it.

Added: the gate, and a top bar that autohides - hidden at rest, revealed by the pointer within a few pixels of the top edge and by keyboard focus landing inside it, never scroll-driven.

TWO CONTRAST DEFECTS were found and fixed, and the cause is worth recording because it will recur: the static sheet and the mathematical repaint can fight each other. The sheet filled the search button and the current-page pagination chip with a light accent and dark ink; the repaint then darkened the fill, correctly by its own rule, and left the ink where it was - 1.21:1 on the v3 shell and 2.29:1 on v4. Both were invisible in 1.7.0 only because they sat inside a closed drawer or a deleted header. Keeping the bar exposed them. Both now take a dark chrome fill and carry their own ink and border. Re-measured across every rendered text node at 1280, 1512 and 2560: stock worst 5.31 on both shells, ours 9.13 and 9.41, zero sub-AA nodes and zero light surfaces left.

DESKTOP ONLY. The (hover: none) overlay pin is gone - it is touch-only and can never fire in a browser that runs a userscript manager - and the 320 and 768 arms are gone from every width matrix, with 1280 as the floor. env(safe-area-inset-*) and the drawer's min(380px, 92vw) needed no action: they left with the drawer. Kept deliberately, because they only look responsive: the intrinsic repeat(auto-fill, minmax(clamp(300px, 28.5vw, 510px), 1fr)) rule, which measures 3/3/3/5 tracks at 1280/1512/1920/2560 with full bleed at all four; :focus-within, which is the keyboard path rather than the touch path; and prefers-reduced-motion, which is a preference rather than a viewport.

Verified: 165 checks, 0 failures - wall and full bleed on the four gallery shapes, stock identity on the three that no longer qualify, the top bar's three states, rails and footer gone on both shells, THREE document-start copies leaving exactly one sheet and one overlay per card, and a teardown whose fingerprint matches the stock baseline.

Known: profile and channel pages now render stock. Their rendered gallery links /pornstar/... rather than /video-, and the cards that do carry video links sit under a display:none parent, so they fail the gate - which is the intended behaviour for a page that is not the surface in scope. The revealed top bar overlays the first card row rather than pushing it down; that is what frees the band for the wall.

3763 lines to 2576.


### v1.7.0

The stranded links get a home. Hiding the footer, and the header in relocate mode, removed the only route to terms of service, the privacy policy and privacy notice, content removal, cookie preferences, the /hits time filter, and the tags / history / best / pornstars nav. The accessibility audit in v1.6.0 counted that as its one outstanding failure and left it open deliberately, because where those links belong is a design decision rather than a bug fix. They now live in a Site section at the foot of the drawer, on every shape and in both modes.

They are matched by an ALLOWLIST OF HREFS, never by class and never by link text. Text is localised, so a selector built on it finds nothing on a non-English UI; the classes here are the site's own and rot. Promo links are excluded by simply not being on the list, which is the difference between a list that stays correct and a denylist that has to keep up.

They are MOVED, not cloned, and for one of them that is the whole point. Cookie preferences is href="#cookie-preferences" - a fragment, not a URL, so it is a JS control and a copy of its href is a dead link. Only the node itself carries the behaviour. Moving also means the existing move bookkeeping restores every one of them to its original parent and next sibling, so this needed no teardown code of its own.

Two defects were found in the first implementation and fixed before shipping, both worth recording because both were invisible to a check that only counted links. The section is hosted by whichever node is acting as the drawer, and in adopt mode that is the site's own #header - so our own "is this ours" test returned false for it, the teardown left it behind inside the site's header, and a re-run would have treated it as site content. It now carries our own class, which is the only thing that can identify it there. And the three /hits time-filter links arrived carrying .x-dropdown-element, which the site's own CSS hides until its dropdown opens: a class-keyed rule travels with the node, so they moved correctly and rendered at 0x0. Both now verified rather than assumed - every harvested link is asserted visible, not merely present.

Measured: 5 links harvested in adopt mode, 13 in relocate, zero duplicate hrefs, every one visible when the drawer is open, the cookie-preferences node itself present rather than a copy, and teardown returning the footer to its stock link count on both shapes with no markers and no section left behind.

Verified after the change: 18/18 on the new harvest suite, and the existing suites back to 30/30 and 36/36 - the three failures recorded in v1.6.0 were the intermittent all-ad listing on a blocker-free profile, not a regression, and this run served real videos on the same shape. Colour audit unchanged: zero light backgrounds and zero sub-AA text on the listing shapes, two light surfaces still on the video page, teardown restoring the stock navy everywhere.

### v1.6.0

A hardening pass, run as three parallel lanes - structure, runtime, and a harness lane that touched no script code. It found six runtime defects on a script that had already shipped five versions and passed 66 acceptance checks, which is the argument for running such a pass at all rather than calling a working redesign finished.

The worst of them scaled with the number of copies. Teardown began by reading the lifecycle object and returning if it was null, so the contract of "call the previous copy's teardown at entry" silently failed against a copy that had not started yet: start() is deferred to DOMContentLoaded, the earlier copy was still waiting for that event, its teardown returned on the first line without cancelling its own pending listener, and it then started anyway. Measured at document-start: one copy gave one control, two gave two, three gave three, of every corner control, scrim and adopted sheet. The fix is a module-scope bootstrap AbortController whose abort() is now the first statement of teardown, ahead of that return, with the bootstrap listener registered against its signal. All three counts are now one, and a re-run into an already-loaded document stays at one while still applying - a teardown contract traded for an init flag would be no fix at all.

The video page drawer was dead, and it failed in the worst possible direction. The island runs before the shell mounts, so the drawer node was not yet known to belong to us and the adopted container was hidden along with the rest of the page. Opening it set aria-expanded true, painted the scrim and made the background inert around a drawer measuring zero by zero with no controls in it - a focus trap around nothing. Ordering fixed, verified open at every width.

The video-page close control was buried. A z-index of 2147483000 on the drawer beat the corner control's own stacking, and elementFromPoint on the close button returned the drawer at 320, 1280 and 2560. The scrim and Escape both still dismissed, which is exactly why geometry never caught it: the control was present, sized and correct, and simply could not be hit.

Partial selector rot could hide a gallery. The count gate passed on a single organic card and the promo complement then hid everything else, measured at 38 of 39 cards hidden. The real organic share was measured before a threshold was chosen rather than guessed at - /todays-selection is the floor at 83 per cent, the tile pages are 100, the rest 95 to 97, and the broken case was 3 - so the floor sits at 50 per cent, 33 points below the worst real shape, and falling through it renders stock.

Two more: promo marks only ever accumulated, so a card misclassified on an early pass stayed hidden for good, and the video island declined to act when a keeper was missing rather than undoing what an earlier pass had applied. Declining leaves a half-applied page; degrading to stock means reverting.

The structure lane removed about 76 lines of unreachable code: a reader returning seven fields of which six had no consumer, and which paid for a regex pass over every card's text to build them; a hand-rolled camel-to-kebab converter for an API that takes dashed names verbatim; a rule for a relocation slot that no longer exists; a duplicate selector block whose declarations were dead under an earlier rule. It also rewrote three comments that asserted behaviour the code does not perform - including a block describing a two-tier overlay with badges and an uploader chip, none of which had shipped since v1.3.0. A comment that describes a removed feature is a defect in this repo, not a stale note.

Its refusals are worth as much as its edits. Collapsing a five-way selector group with :is() would have raised specificity on two of the three members, and swapping a timer for AbortSignal.timeout would have aborted the very callback the timeout exists to fire.

Accessibility measured 35 pass, 1 fail. Escape closes the topmost thing asserted from the DOM, verified against a synthetic foreign dialog: ours correctly stayed open while the foreign one was present, and closed once it was gone. Focus is trapped across 14 Tabs and 8 Shift+Tabs and restored to a real control. The failure is honest and recorded rather than closed: some links have no route once their container is hidden - the footer's terms, privacy and cookie-preferences links, the time filter on /hits, and the tag and history pages. Which of those belong in the drawer is a design decision, not a bug fix, and it is deliberately left open.

Responsive: zero horizontal overflow at 320, 768, 1280 and 2560 on four shapes, with the drawer opened by a trusted click each time and asserted inside the viewport rather than merely not display:none. Under (hover: none) the title overlay is pinned open.

Known and not fixed: on a browser with no ad blocker, a search listing can serve 74 children and zero video links - all ad units - and the tile tier then accepts 37 of them as gallery tiles, producing a wall with one title. Tightening that tier risks the tile pages it exists for, which render 80 of 80 and 161 of 161, so it is recorded rather than traded. Two light surfaces remain on the video page against zero everywhere else.

Verified after the pass: 30/30 and 33/36 on the two original suites - the three failures being exactly the all-ad listing above, on the blocker-free test profile - plus 47/47 lifecycle, 29/29 failure modes, 27/27 video page, 18/18 navigation, 193/193 responsive, and a clean colour audit showing zero light backgrounds and zero sub-AA text on the listing shapes, with teardown restoring the stock navy and leaving no painted nodes on any of them.

### v1.5.0

The video page showed a picture instead of a player, and the channel page showed nothing at all. Both were mine, and both were one-line reasoning errors rather than anything subtle.

The player had no controls because the island descended into it. A keeper was added to the "on the path" set so the walk could reach it, and then the walk treated it as merely on the path to itself, descended, and hid its children - fifteen of them, which are the media controls. The video element was always healthy: readyState 4, a live blob source, correctly sized and visible. Only its controls were gone, so the frame painted and the page read as a thumbnail. A keeper now keeps its whole subtree and the walk stops there. The gallery had survived the same bug only because the grid rules carry !important and out-shouted the hide, which is the kind of accident that hides a defect rather than preventing it.

Media chrome is also exempt from the mathematical repaint now. It had recoloured 146 nodes inside the player. A player's controls are already dark and are tuned against the moving picture behind them, so recolouring a seekbar or a scrim from the outside can only make it worse.

The channel page was gridding an invisible container. Measured on /porn-maker/...: the page ships TWO .mozaique. The first sits inside #gold-videos, whose parent computes display:none - 51 children, none rendered - and the real gallery is the second, inside #psvideos at 1501x5192 with all 50 children rendered. gridHost took the first match, so the redesign decorated a hidden node and left the actual listing stock. It now picks the first .mozaique that actually renders, falling back to the first match so a grid that is still empty at document-start is not written off - the sweep re-asks on every tick. The channel gallery now renders 50 of 50 at full bleed, and its light backgrounds drop from 62 to the handful that are our own accent chips.

The player is bigger by default on the video page. The site ships no size mode that could be driven - checked for a cookie, a storage key, an html or body class and an xv.player API, and found none - so this is our own sizing rather than the site's own feature, which is worth stating rather than implying. It costs nothing because the island has already removed everything except the player and the gallery. Height is capped in dvh rather than vh so a mobile URL bar cannot clip it, and the cap leaves the first row of the gallery peeking so it is visible that there is more below.

Verified: 66 checks across six listing shapes, the video page and the channel page, 0 failures. Zero light backgrounds and zero low-contrast text on the listing shapes; the one remaining light surface on the video page and the five on the channel page are our own accent used as a chip background, which the audit counts by luminance alone.

Four of the failures during this round were the SPEC's fault, not the script's, and they are worth recording as a pattern: a probe that read attribute NAMES instead of values reported a working drawer as broken; a probe that measured the drawer CLOSED reported its contents as missing; a probe that read the first .mozaique measured the hidden one and reported a fix as ineffective; and a visibility test of "display is not none and height above 2" called an off-canvas fixed drawer VISIBLE. Suspect the spec as readily as the code.

### v1.4.0

Dark mode stops being a list of selectors and becomes a function of the colour. The video page joins the redesign. Header and footer leave by default, and a lot of junk leaves with them.

The theme was uniform only where someone had named a surface. A static palette sheet can only darken what it has a selector for, which is why one page came out black and the next one navy - and why the video page, skipped outright, sat in stock light navy behind every other page being dark. Every stylesheet on this origin is cross-origin and .cssRules throws SecurityError, so a CSSOM remap is not available at runtime; getComputedStyle is, for every element, and it already folds in inline styles and anything the site JS set. So the theme now reads the computed value of every painted element and derives a dark equivalent mathematically.

Neutrality is decided by chroma, (max-min)/255, never by HSL saturation - saturation is normalised by lightness and so calls near-white an accent, which is how a cream page comes back olive. A neutral inverts through a gamma, so what was near-white lands deeper than a linear flip would put it, which is the difference between dark and deep dark. An accent keeps its hue exactly, because the mapping scales the three channels by one factor, and is lifted only as far as it must be to read on the ground behind it. Ink is repaired on measured contrast ratio alone, never on a lightness branch.

The pass is idempotent by construction, which is what makes it safe to run after the static sheet: the test is "is this still too light", so a surface the sheet already blackened measures as dark and is left alone. Running it twice changes nothing.

One arithmetic bug is worth recording because it shipped into the first measurement. The mapping preserves hue by multiplying the channels, and zero times anything is zero, so pure-black text could not be lifted at all - it was left on a black ground at a measured contrast ratio of 1.22 on two pages. A colour that dark carries no hue to preserve, so near-black now maps to a neutral at the target lightness. Measured after the fix: light backgrounds 9, 7 and 10 down to zero on the three shapes tested, and low-contrast text nodes zero on all three. The video page ships seven failing pairs of its own in stock and now measures zero.

The video page is no longer skipped. It was, on the reasoning that its .mozaique is a related-videos rail rather than a listing surface, and the cost of that reasoning was the one page you spend the most time on keeping a full site header, a full footer and no theme. Measured: DIV#header, DIV#content, DIV#footer, with the player at 964x516 and a 1280x689 gallery inside #content > .wrapper. Only the player and the gallery are kept. Everything that is not an ancestor of one of those and not inside one is hidden level by level from each keeper up to body, and the whole pass is gated on finding at least one keeper - hiding by elimination is how a redesign blanks a page, so if neither the player nor the gallery resolves, nothing happens at all. The player now spans the full width and the gallery renders as the wall: 40 cards where there were none.

Footer is gone unconditionally: every shape ships DIV#footer and zero <footer> tags, so the id is the anchor. The header could not be treated the same way, and the reason is worth writing down: the <header> tag sits INSIDE DIV#header and CONTAINS the adopted drawer, so a blanket rule on either would have deleted the overlay along with the chrome. In adopt mode that container IS the drawer and is already parked off-canvas; in relocate mode it is removed once its contents have moved.

Verified: 66 checks across six listing shapes and the video page, 0 failures. Inject to return 96ms with 1445 nodes repainted. Teardown leaves zero painted nodes and restores the stock navy on every page.

### v1.3.0

Tuning pass. Bigger pictures, less furniture, one pager.

Thumbnails are 1.5x on every stop of the intrinsic rule - clamp(200px, 19vw, 340px) becomes clamp(300px, 28.5vw, 510px) - and the gap drops from 4px to 1px. Cards measure 503x283 at 1512 on every shape, aspect ratio unchanged at 1.778. Still one rule rather than a breakpoint stack.

Every badge is gone: duration, quality, uploader and views. On a 1.5x wall the picture is the content and the rest is furniture. The title survives because it is the one thing you cannot recover by looking at the frame. One real loss, recorded rather than hidden: the uploader chip was a live link built from the card's own plain link, and our CSS hides the stock .uploader, so uploader navigation is no longer reachable from the wall - the card still opens the video, where the uploader is one click away.

The title overlay is not new work. An earlier sibling userscript in this repo, since removed, already shipped this exact affordance, and its approach is reused rather than re-derived: a to-top gradient so white text holds over a bright frame, pointer-events none on the overlay with the link keeping every pixel, -webkit-line-clamp at 2, and overflow-wrap:anywhere rather than word-break:break-all, which splits words mid-syllable. Two rows rather than one is measured, from that script: one truncated line cut 70 of 120 titles, two clamped lines cut 15.

It grows upward from the bottom edge, and the absence of a min-height is the whole mechanism. Anchored at bottom:0 with auto height, a one-line title is one line tall and a two-line title pushes its own top edge up; a reserved two-line box would instead hang a short title off a fixed top. The clamp is a ceiling, not a floor. Measured: a 65px overlay inside a 283px card, pinned to the bottom. Hover and focus-within both reveal it, and under (hover: none) it is pinned open - a hover-only affordance strands every touch user.

Tile cards had no title at all. Title extraction keyed entirely on /video- links, so the 80 profile tiles on /pornstars read empty and rendered no overlay. Those tiles link /pornstar/... and their name is the entire content of the card, so the reader now falls back to the card's own link and then to img.alt, read before we overwrite it. 0 titles becomes 80.

Pagination is at the bottom and nowhere else. Both shells ship two .pagination blocks inside the grid wrapper, one before the listing and one after; shell A rendered the leading copy at the top of the wall, while shell B had its trailing copy relocated into the drawer - two different answers to the same question, and one of them put the only way forward behind a toggle. Pagination is no longer relocated at all, and the leading copy is marked in JS by document order against the grid host. Never :first-of-type: the pagers are DIVs among DIVs, so a type test picks the wrong element. A page that ships no pagination at all, like /todays-selection, correctly shows none.

Verified on four shapes: 36 checks, 0 failures. Two of the first-run failures were the spec's fault, not the script's - getComputedStyle().top returns the USED value and is never 'auto', so testing for 'auto' can never pass; and a page with no pagination is correct rather than a miss. Both assertions were rewritten to measure the property that actually carries the claim.

### v1.2.0

Five defects, reported from real use. All five were invisible to the acceptance suite that shipped v1.1.0, because that suite evaluated the IIFE into a page at readyState "complete" and the installed script runs at document-start with the site's own JS still to come. Injecting is not installing, and 88 injected checks found none of what six document-start probes found in minutes. The suite now drives the script the way the browser does.

Dark mode applied to only four of six listing shapes. The theme is scoped entirely on html[data-nx-thumbwall], and that attribute was written only when the grid found organic cards, so / and /pornstars - which carry no video cards at all - rendered in the stock light navy while every other page was black. A dark theme that switches off on some pages of the same site is worse than none. The attribute is now written for any page the script runs on; the layout rules were already gated separately on .mozaique[data-nx-grid="on"], so un-gating the theme cannot leak the wall onto a page with no gallery. The retry sweep used the same attribute as its "did it land" signal and would have seen success on its first tick, so it now asks the grid directly.

Two galleries were not galleries by the old test. Measured 2026-09-13: / serves 161 category tiles linking /search/..., /pornstars serves 80 profile tiles linking /pornstar/..., each with its own image, and zero /video- links between them. A gallery is not always a video gallery. The organic test gains a second tier - a child carrying both a picture and a link - consulted only when the video test finds nothing, so no page that has video cards can change class. Both pages now render the full-bleed wall: 80 of 80 tiles on /pornstars, aspect ratio 1.778, no horizontal overflow.

/todays-selection rendered blank, and the cause was two layers deep. That page lays its listing out as a masonry: the site writes explicit zero-height grid rows and positions each card absolutely on top of them. Overriding only grid-template-columns left grid-template-rows computing to 0px, so every card landed in a zero-height row and the card's own overflow:hidden clipped a correctly laid out 299x168 thumb-inside down to nothing - 0 of 98 children rendered. Resetting the rows moved the track from 0px to 35px, which exposed the real mechanism: sizing a content-sized row means asking the item for its intrinsic height, which resolves the CHILD's aspect-ratio against an indefinite width and yields a near-empty box. The item's own width is definite - it is the track - so the ratio now sits on the item and the row follows. 48 of 98 children render. Separately, the site sets position:absolute inline on those cards and our reset was the one property in that rule without !important, so the site won and the card left grid flow entirely; that is fixed too, though it was only a contributing cause.

The overlay opened but was unreadable. Un-gating .mobile-show reveals the drawer's content without laying it out, and the site's #xnxx-search-bar is .form-inline - flex, row, wrap, no width of its own - because it was built to sit across the top of a 1512px page. Dropped into a 380px vertical drawer its flex children shrink to min-content. Measured with the drawer open: the form rendered 55px wide and 5132px tall, #mobile-cat-list stacked 174 links one glyph wide, and #site-nav was pushed to y=5249, thousands of pixels below the fold. The adopted drawer now gets block flow at full width, with the search row keeping its own shape. Specificity is deliberate: the closed-state rule scores (1,3,1) against these at (1,2,1), so re-opening cannot defeat .mobile-hide.

Verified on all six listing shapes with a single clean copy: 30 checks, 0 failures - themed and black, gallery renders, full bleed at 1512, zero horizontal overflow, exactly one corner control. Card aspect ratio measures 1.778 on every shape including the two tile pages, so pinning 16/9 on the item recorded what was already true rather than imposing it.

Two things are known and not fixed. /todays-selection reports a container height of 0 while its 48 cards render correctly - the site's masonry JS still owns that metric, which is cosmetic but not understood. And single-copy behaviour at true document-start is unproven: the sweep above tears the installed copy down and runs ours, which is clean but is not the browser's own ordering. Only a real install proves that.

### v1.1.0

First release. xnxx.com becomes a full-bleed wall of thumbnails with everything else behind one corner control.

The site serves two different page shells on one origin, and this is the fact the whole script is shaped around. Measured 2026-09-13: `/`, `/search/*`, `/todays-selection`, `/pornstars` and `/video-*` render a v3 shell with a single 1.1MB stylesheet and cards keyed `[data-eid]`; `/best/*` and `/hits` render a v4 shell with six stylesheets and cards keyed `[data-video]`. Every id on one is dead on the other, and the same URL can serve either across loads. `.mozaique` is the one anchor that verifies UNIQUE on both, so it is the gate, and the mode is re-decided from the DOM on every run rather than from the URL.

Two pages carry a `.mozaique` with zero video cards — `/` holds 161 children and `/pornstars` 80, none of them listings. Hiding by elimination there would blank the page, so every elimination rule is gated behind an organic-card count and those two pages render stock. The organic test is `a[href*="/video-"]`, never `href^=`: the prefix form misses 29 cards on `/todays-selection`, which serves absolute hrefs.

The grid is one intrinsic rule rather than a breakpoint stack: 1 column at 320px, 3 at 768, 5 at 1280, 7 at 2560, with zero horizontal overflow at every width on both shells and the card's aspect ratio equal to the image's 1.778 throughout — the under-bar moves into an overlay, so the card is the picture. The site's own `nb-thumbs-cols-*` density system was measured first and rejected on evidence: two host elements, two vocabularies, two mechanisms, and 110-290px of dead space at 2560 against a measured 0. It also outscores an unqualified grid rule at (0,2,1), so it is neutralised rather than merely ignored.

Chrome is inherited, not rebuilt, wherever the site already ships it. On the v3 shell the mobile drawer is adopted in place: nothing moves, so no ancestor chain changes and the whole class of relocation breakage cannot occur. The lever is not the class it appears to be — `mobile-hide` carries its `display:none` inside `@media (max-width:991px)` and is inert at desktop, so the rule is re-emitted un-gated and `.mobile-show` un-gated with it, taking the drawer from 1 visible link to 179. The v4 shell has no such mechanism at all, so there the search form, category list and pagination are relocated and every repair is scoped to a marker that renders stock if the move fails.

Dark theme is a desaturation, not an inversion: the site is already dark navy. The bar was set by the stock page, which passes 14 of 14 AA pairs at worst ratio 5.31 — better than most redesigns of it. This ships 16 of 16 pairs on the v3 shell at worst 7.81, and 12 of 12 on v4 at worst 8.28, with no stock colour left on either. A CSSOM remap is impossible here because every stylesheet is cross-origin and `.cssRules` throws, so the theme is a static palette of 18 colour tokens and 3 motion tokens declared once.

Verified with trusted events on both shells: cards navigate, search submits, a category link navigates, density changes card width, Escape and click-outside both close the drawer, focus is trapped and restored, and the background is `inert` while open. Injecting twice leaves exactly one of each control. Teardown returns every moved node to its original parent and next sibling, restores the site's own density classes and cookie, and leaves zero of our attributes behind.

<!--
When you publish a script, follow this shape:

## script-name

### [1.1.0] - YYYY-MM-DD

#### Fixed

- What broke, and the measurement that proved it. Link the issue.

### [1.0.0] - YYYY-MM-DD

#### Added

- Initial release.
-->
