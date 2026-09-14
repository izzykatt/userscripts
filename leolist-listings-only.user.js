// ==UserScript==
// @name         LeoList — listings only: no sponsored, no chrome, photo filmstrip
// @namespace    izzykatt.ca
// @version      1.65.0
// @description  Listings-only LeoList: keep #view-cont > div.col-left, drop sponsored chrome, filmstrip every detail-page photo from the lightbox a.href (w:1024) beside the copy panel. All stock filtering moves into an overlay sidebar on a fixed action button. Parsed photos persist in localStorage with no hit TTL.
// @author       Izzy Katt
// @license      MIT
// @homepageURL  https://github.com/izzykatt/userscripts
// @supportURL   https://github.com/izzykatt/userscripts/issues
// @match        https://www.leolist.cc/*
// @match        https://leolist.cc/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

// LeoList does not ship a listings-only view. Measured 2026-08-31 on
// https://www.leolist.cc/personals/* and re-checked 2026-09-04 on
// /community/activities/* (live DOM): every listing index shares one shell —
// organic cards live in #main_list inside #view-cont > div.col-left, only the
// URL section differs. So @match is the whole origin and arm() gates on the
// DOM, in two parts: #main_list must exist, and it must hold at least one card
// listingCard() accepts. The first gate keeps ad detail pages and the homepage
// untouched. The second keeps an EMPTY category untouched — measured
// 2026-09-14 on /jobs/software-qa-dba/central-ontario, the container ships with
// zero cards, and arming on it hid the list's eight non-rendering children by
// elimination and left a black viewport. An index with no listings now renders
// stock, down to the site's own "produced no results" panel. See arm().
//
// The stock card is not restyled, it is replaced. #main_list is an allowlist
// (every child hidden, only wraps holding a .nix-leolist-row shown) and each
// row is built from scratch: a horizontal photo strip closed by a copy panel.
//
// Enrichment: a.lst-item__link.mainlist-item[href] → same-origin fetch of the
// ad page, parsed out of band with DOMParser. #preview-description textContent
// is whitespace-collapsed and kept WHOLE — nothing truncates or summarises it
// in JS; the copy panel is a fixed-height box that scrolls the overflow.
// .account-photos__item a[href] gives every photo (w:1024/h:0 lightbox, not
// the 304px img.src thumb). Phone stays locked.
// IntersectionObserver + concurrency 8;
// visibilitychange reconnects IO so a hidden tab fills on focus.
// Filtering: the stock controls are RELOCATED, not rebuilt. A fixed action
// button top-right toggles an overlay sidebar holding the site's own filter
// bar and city rail; its three .ll-modal dialogs stay where they are, exempt
// from the island, and open over the panel on their own z-index. Measured
// 2026-09-13: every filter handler is bound directly to its control, and no
// rule that styles them is ancestor-keyed, so moving the nodes keeps both the
// wiring and the looks. Verified by ticking a city under a trusted click —
// 10 cards became 4, all of that city.
// The site header and footer are dropped everywhere, not just on the pages this
// script rebuilds — measured on an ad detail page, that is 92px of nav on top
// and 1073px of link farm underneath, plus the sponsors row, the notice band
// that used to sit under the footer, and the floating side rail.
// Dark mode is site-wide and independent of the redesign: [data-nix-leolist-dark]
// goes on <html> at document-start, so an ad detail page, the homepage and the
// stock filter dialogs are dark too, on pages where arm() builds nothing at all.
// It COMPUTES the palette: every colour the site declares is read back out of
// the CSSOM, its lightness inverted with hue and saturation preserved, and
// re-emitted under the same selector. Flattening (drop the paint, keep every
// background-image, force one light ink) is the FALLBACK beneath it, for
// cross-origin sheets the CSSOM cannot read, for the ground selectors the remap
// deliberately skips, and for colours the site never declared.
// Keys: Up/Down and PageUp/PageDown step one listing; Left/Right step one
// photo within the listing you are on; Escape closes the filter panel, and
// otherwise leaves the fullscreen overlay. An open dialog owns Escape. The
// fullscreen view also carries a fixed close icon top-right, because Escape is
// no affordance for a pointer.
// Lifecycle: one AbortController owns every listener and every fetch, so
// teardown is abort() plus the observer disconnects — not a set of hand-matched
// removals that have to repeat their own capture flags. Work scheduled before
// teardown (a queued enrichment job, a coalescing animation frame) checks
// bag.torn and stands down, because a frame that fires one tick late used to
// rebuild the panel on a page that had just been returned to stock.
//
// Colour lives in one token block on the root (--nl-*), not in 57 literals.
// Sizing is intrinsic: min()/clamp() and dvh, no fixed 420px box, so the feed
// reflows from 320px to 2560px with no sideways scroll.
//
// Semantics: each row is an <article> named by its own <h2>, each description is
// a focusable labelled region (it scrolls, and nothing else could reach it),
// each strip is a labelled group. The document-level key handler stands down for
// any editable or composite widget target.
//
// Changelog (v1.4.0 -> current): ./CHANGELOG.md
//
// Selectors (listing + detail dumps, 2026-08-31; re-checked 2026-09-04):
//   #view-cont > div.col-left             KEEP island
//   #main_list                            arm() gate 1 + allowlist root
//   .lst-item                             arm() gate 2 — a real card, via
//                                         listingCard(); none means empty
//                                         category, and arm() stands down
//   a.lst-item__link.mainlist-item        ad href, per card
//   .lst-item__title                      row heading text
//   .lst-item__label--sponsored           sponsored card — skip it
//   #filter-msgs / #no_results            site's own empty state — a SIBLING of
//                                         #main_list, so it is what shows on an
//                                         index arm() refuses
//   .lst-item img.huge                    stock hover popup — hide
//   .main-list-sponsors                   paid links row — dropped site-wide
//   body > .human-rights                  notice band — dropped site-wide
//   body > .sticky-side                   floating side rail — dropped site-wide
//   aside.main-list__safety-tips
//   .main-list-pagination
//   a.main-list-pagination__control[href*="page="]
//   #preview-description                  detail: description text
//   .account-photos__item a[href]         detail: lightbox URL (w:1024/h:0)
//   .main-list-filter > .filters.js-filters  filter bar — moved into the panel
//   .col-right > fieldset.cities-container   city rail — moved into the panel
//   .main-list-filter / #modal-filters    dialog hosts — shown, never moved
//   .ll-modal--open                       a dialog is up, and owns Escape
//
// Invented (constructed UI):
//   .nix-leolist-row / -photos / -photo / -copy / -title / -desc / -tail / -snap
//   .nix-leolist-list--full               fullscreen overlay on #main_list
//   [data-nix-leolist-listings-only]      on <html>, gates every rule above
//   [data-nix-leolist-dark]               on <html>, site-wide dark layer
//   [data-nix-leolist-bare]               on <html>, drops site header + footer
//   wrap[data-nix-leolist-enrich]         pending | done | fail | retry
//   img[data-nix-src] / [data-nix-obj]    network URL / live blob URL
//   .nix-leolist-filters / -__head / -__title / -__close / -__body
//   .nix-leolist-filters--open            panel is on screen
//   .nix-leolist-fab                      top-right toggle, normal view
//   .nix-leolist-exit                     top-right close, fullscreen only
//   [data-nix-leolist-show]               island exemption, on a dialog host
//   [data-nix-leolist-moved]              a stock island now living in the panel
//   [data-nix-leolist-slot]               hidden marker at its original home
//   [data-nix-leolist-ink]                text this script re-inked for contrast
//   .nix-leolist-heading                  the H2 that names each row
(() => {
  'use strict';

  const TEARDOWN = '__nixLeolistTeardown';
  if (typeof window[TEARDOWN] === 'function') {
    try {
      window[TEARDOWN]();
    } catch {
      /* previous run leftover */
    }
  }

  // The sweep runs ALWAYS, not only when the global is missing. Only one
  // teardown global can exist, so a third injection undoes the second copy and
  // the FIRST one's panel stays on the page forever — measured: teardown then
  // re-inject left two panels and two buttons, and the stale panel still held
  // the site's own filter bar inside it. Slots make that recoverable by a copy
  // that never saw the move.
  {
    const moved = document.querySelectorAll('[data-nix-leolist-moved]');
    for (let i = 0; i < moved.length; i += 1) {
      const node = moved[i];
      // CSS.escape, and it is not defensive: this runs in the unguarded sweep at
      // document-start, and the value is read back OFF the page. One quote in
      // it throws SyntaxError and takes the whole IIFE down — no dark layer, no
      // island, no rows. That is dead, not degraded.
      const slot = document.querySelector(
        '[data-nix-leolist-slot="' + CSS.escape(node.dataset.nixLeolistMoved) + '"]',
      );
      try {
        if (slot && slot.parentElement) slot.parentElement.insertBefore(node, slot);
        delete node.dataset.nixLeolistMoved;
      } catch {
        /* ignore */
      }
    }
    const slots = document.querySelectorAll('[data-nix-leolist-slot]');
    for (let i = 0; i < slots.length; i += 1) slots[i].remove();
    // Inline colours a stranded copy wrote: its bag.inked is unreachable, so
    // the marker on the element is the only way back to stock.
    const inked = document.querySelectorAll('[data-nix-leolist-ink]');
    for (let i = 0; i < inked.length; i += 1) {
      try {
        inked[i].style.removeProperty('color');
        delete inked[i].dataset.nixLeolistInk;
      } catch {
        /* ignore */
      }
    }
    const junk = document.querySelectorAll(
      '.nix-leolist-filters, .nix-leolist-fab, .nix-leolist-exit, .nix-leolist-tail',
    );
    for (let i = 0; i < junk.length; i += 1) {
      // A panel from a build that predates slots can still be holding the
      // site's own filter bar. Park anything that is not ours on the body,
      // hidden, rather than deleting the page's furniture with the panel — a
      // reload puts it properly back, a delete cannot.
      const strays = junk[i].querySelectorAll(':scope > *:not([class^="nix-leolist"])');
      for (let k = 0; k < strays.length; k += 1) {
        try {
          strays[k].hidden = true;
          document.body.appendChild(strays[k]);
        } catch {
          /* ignore */
        }
      }
      junk[i].remove();
    }
    const leftover = document.querySelectorAll('.nix-leolist-row');
    for (let i = 0; i < leftover.length; i += 1) {
      const row = leftover[i];
      const wrap = row.parentElement;
      row.remove();
      if (!wrap) continue;
      delete wrap.dataset.nixLeolistEnrich;
      const kids = wrap.children;
      for (let k = 0; k < kids.length; k += 1) kids[k].hidden = false;
    }
    if (typeof window[TEARDOWN] !== 'function') {
      delete document.documentElement.dataset.nixLeolistListingsOnly;
    }
  }

  const bag = {
    observers: [],
    io: null,
    tailIo: null,
    sheet: null,
    onVis: null,
    onHide: null,
    onShow: null,
    onClick: null,
    onKey: null,
    islandHidden: [],
    retryTimer: 0,
    panel: null,
    fab: null,
    darkSheet: null,
    darkObs: null,
    inked: [],
    // One controller owns every listener this script adds and every fetch it
    // starts. teardown() aborts it, which is the platform's own "undo" — the
    // hand-matched removeEventListener pairs it replaces had to repeat the
    // capture flag by hand, which is the classic way a listener outlives its
    // owner. Observers still need their explicit disconnect(): neither
    // MutationObserver nor IntersectionObserver takes a signal.
    ctrl: new AbortController(),
    torn: false,
    fullReturn: null,
    mqlBound: false,
    docBound: false,
    listNode: null,
    listMo: null,
    lightWas: false,
    modalWas: false,
    exit: null,
    relocated: [],
    exempt: [],
  };

  // Five identical try/disconnect blocks were the same six lines each.
  const off = (obs) => {
    try {
      if (obs) obs.disconnect();
    } catch {
      /* already gone */
    }
  };

  const teardown = () => {
    for (let i = 0; i < bag.observers.length; i += 1) off(bag.observers[i]);
    bag.observers.length = 0;
    off(bag.io);
    bag.io = null;
    off(bag.tailIo);
    bag.tailIo = null;
    // Ordered deliberately: stop new work BEFORE undoing the DOM, or an
    // in-flight job rebuilds what is being removed.
    bag.torn = true;
    try {
      bag.ctrl.abort();
    } catch {
      /* ignore */
    }
    queue.length = 0;
    io = null;
    const tails = document.querySelectorAll('.nix-leolist-tail');
    for (let i = 0; i < tails.length; i += 1) tails[i].remove();
    const snapped = document.querySelectorAll('.nix-leolist-snap');
    for (let i = 0; i < snapped.length; i += 1) snapped[i].classList.remove('nix-leolist-snap');
    // The site's own body classes are restored, not merely left dropped: a
    // teardown that leaves the page themeless is not "degrade to stock".
    if (document.body) {
      if (bag.lightWas) document.body.classList.add('light');
      if (bag.modalWas) document.body.classList.add('modal-open');
    }
    restoreFilters();
    if (bag.panel) {
      bag.panel.remove();
      bag.panel = null;
    }
    if (bag.fab) {
      bag.fab.remove();
      bag.fab = null;
    }
    if (bag.exit) {
      bag.exit.remove();
      bag.exit = null;
    }
    const list = document.getElementById('main_list');
    if (list) list.classList.remove('nix-leolist-list--full');
    bag.onVis = null;
    bag.onHide = null;
    bag.onShow = null;
    bag.onClick = null;
    bag.onKey = null;
    if (bag.retryTimer) {
      clearTimeout(bag.retryTimer);
      bag.retryTimer = 0;
    }
    for (const obj of objUrls.keys()) {
      try {
        URL.revokeObjectURL(obj);
      } catch {
        /* ignore */
      }
    }
    objUrls.clear();
    if (bag.sheet) {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== bag.sheet);
      bag.sheet = null;
    }
    if (bag.darkSheet) {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== bag.darkSheet);
      bag.darkSheet = null;
    }
    bag.darkObs = null;
    for (let i = 0; i < bag.inked.length; i += 1) {
      try {
        bag.inked[i].style.removeProperty('color');
        delete bag.inked[i].dataset.nixLeolistInk;
      } catch {
        /* ignore */
      }
    }
    bag.inked.length = 0;
    delete document.documentElement.dataset.nixLeolistDarkRules;
    delete document.documentElement.dataset.nixLeolistDarkMs;
    delete document.documentElement.dataset.nixLeolistDarkInk;
    for (let i = 0; i < bag.islandHidden.length; i += 1) {
      try {
        bag.islandHidden[i].hidden = false;
      } catch {
        /* ignore */
      }
    }
    bag.islandHidden.length = 0;
    const rows = document.querySelectorAll('.nix-leolist-row');
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const wrap = row.parentElement;
      row.remove();
      if (!wrap) continue;
      delete wrap.dataset.nixLeolistEnrich;
      const kids = wrap.children;
      for (let k = 0; k < kids.length; k += 1) kids[k].hidden = false;
    }
    delete document.documentElement.dataset.nixLeolistListingsOnly;
    delete document.documentElement.dataset.nixLeolistDark;
    delete document.documentElement.dataset.nixLeolistBare;
    try {
      delete window[TEARDOWN];
    } catch {
      window[TEARDOWN] = undefined;
    }
  };
  window[TEARDOWN] = teardown;

  const KEEP = '#view-cont > div.col-left';
  // The ad link, named once. This selector appeared at five call sites and the
  // href was re-derived at four of them — one of which dropped the `|| ''` the
  // others had, so it could hand back null. A rename upstream is one edit now.
  const CARD_LINK = 'a.lst-item__link.mainlist-item';
  const cardHref = (wrap) => {
    const link = wrap ? wrap.querySelector(CARD_LINK) : null;
    return link ? link.getAttribute('href') || '' : '';
  };
  // The same breakpoint the stylesheet uses. It decides which element scrolls,
  // which decides the tail observer's root, so the two must not drift.
  const DESKTOP_MQ = '(min-width: 900px)';

  // Stock filtering, measured 2026-09-13 on a live listing index. It is five
  // islands, not one: the bar, three .ll-modal dialogs and the city rail.
  //
  // Relocating it is safe, and that is measured rather than assumed.
  // DOMDebugger.getEventListeners says every handler is bound DIRECTLY to its
  // control (#search-q change+paste, #form-search submit, #city_barrie change,
  // #available-now change) with nothing delegated through a container, so the
  // nodes keep their wiring when they move. CSS.getMatchedStylesForNode on all
  // ten nodes returned ZERO ancestor-keyed rules — every rule that styles them
  // is self-keyed BEM — so they keep their layout outside their old parents.
  //
  // MOVE takes the two in-flow islands into the panel. SHOW leaves the dialog
  // hosts where they are: .ll-modal is position:fixed z-index 10000 and the
  // site's own JS opens it, so it only has to survive applyIsland.
  const FILTER_MOVE = [
    '.main-list-filter > .filters.js-filters',
    '#view-cont > div.col-right > fieldset.cities-container',
  ];
  const FILTER_SHOW = ['.main-list-filter', '#modal-filters'];
  // Ours, plus the two stock dialog hosts: a click or a key inside any of them
  // belongs to the filter UI, never to the list underneath.
  const FILTER_SAFE = '.nix-leolist-filters, .nix-leolist-fab, .main-list-filter, #modal-filters';
  const FILTER_PANEL_ID = 'nix-leolist-filters';
  const IMX = 'https://imx.leolist.cc/';
  const CONCURRENCY = 8;
  const STORE_PREFIX = 'nix-leolist.v4:';
  const STORE_LEGACY = ['nix-leolist.v1:', 'nix-leolist.v2:', 'nix-leolist.v3:'];
  const NEG_TTL_MS = 15 * 60 * 1000;
  const MAX_STORE = 400;
  // A hung request holds one of CONCURRENCY slots forever, because the
  // finally() that frees it never runs — eight of them deadlock enrichment for
  // the life of the page with no retry path. The timeout rejects into the catch
  // that already exists, which returns RETRY and hands the backoff ladder the
  // job. AbortSignal.any also folds in teardown's controller, so tearing down
  // cancels the network rather than letting it land on a page we no longer own.
  const FETCH_TIMEOUT_MS = 15000;
  const netSignal = () => AbortSignal.any([bag.ctrl.signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]);
  const HTML_GAP_MS = 0;
  const IMG_GAP_MS = 0;
  const ORIGIN_PAUSE_MS = 60 * 60 * 1000;
  const PAUSE_KEY = 'nix-leolist.originPauseUntil';
  const IMG_CACHE = 'nix-leolist-img-v4';
  const IMG_CACHE_RE = /^nix-leolist-img-v\d+$/;
  const IMG_MAX = 600;
  const IMG_TRIM_EVERY = 50;
  const RETRY_BACKOFF_MS = 30 * 1000;
  const PRUNE_EVERY = 100;
  const RETRY = { retry: true };

  // Everything this script CONSTRUCTS. The site-wide layers must not repaint it
  // — measured: the flatten rule scores an ID through its own :not(), so it beat
  // .nix-leolist-title:hover outright (the hover colour could never render) and
  // the dark layer's a:visited rule recoloured listing titles behind its back.
  // One list, interpolated everywhere it is needed, so the four sites cannot
  // drift apart again.
  const OWN_UI_LIST = [
    '.nix-leolist-filters',
    '.nix-leolist-filters *',
    '.nix-leolist-fab',
    '.nix-leolist-exit',
    '.nix-leolist-row',
    '.nix-leolist-photos',
    '.nix-leolist-copy',
    '.nix-leolist-title',
    '.nix-leolist-desc',
    '.nix-leolist-tail',
  ];
  // Two renderings of one list: indented for the stylesheet, compact for the
  // rules the remap emits at runtime. The remap was recolouring the constructed
  // title — measured rgb(173, 199, 209) where the sheet asks for the accent —
  // because a site `a { color }` rule, re-emitted with ID weight, lands on it.
  const OWN_UI = OWN_UI_LIST.join(',\n    ');
  const OWN_UI_SEL = OWN_UI_LIST.join(', ');

  const SHEET_CSS = `/* One palette, declared once. These were 51 hard-coded literals across the
   sheet; a token that is wrong is now wrong in one place. Declared under BOTH
   root flags because the two layers gate independently — the dark layer runs on
   every page, the redesign only where it arms — and var() carries no
   specificity, so none of the cascade measured elsewhere in this file moves. */
html[data-nix-leolist-dark],
html[data-nix-leolist-listings-only] {
  --nl-bg: #000;
  --nl-surface: #14141c;
  --nl-raised: #181825;
  --nl-raised-hi: #232338;
  --nl-dialog: #0b0b10;
  --nl-edge: #313244;
  --nl-edge-strong: #45475a;
  --nl-text: #cdd6f4;
  --nl-text-dim: #a6adc8;
  --nl-placeholder: #6c7086;
  --nl-accent: #89b4fa;
  --nl-accent-hi: #89dceb;
  --nl-visited: #b4befe;
  --nl-danger: #f38ba8;
  --nl-scrim: rgb(0 0 0 / 72%);
  --nl-fab-fill: rgb(0 0 0 / 78%);
  --nl-shadow: rgb(0 0 0 / 60%);
}
/* Site-wide dark layer. Gated by its OWN root attribute, not the
   listings-only one, because it applies on every LeoList page — an ad detail
   page, the homepage, a login form — where arm() builds nothing and the island
   never runs. Anchored on ELEMENTS, never a framework class: the site ships one
   light theme and no dark rules (body.light removal was already measured to be
   the only class that mattered), so the only reliable handle is the element
   itself.
   Painted backgrounds are dropped rather than repainted, which keeps every
   background-IMAGE — logos, sprites, icons — exactly where it was while the
   black root shows through. Text is forced to one light colour on purpose: a
   site-set dark colour on a now-dark surface is invisible text, and legibility
   beats preserving a semantic red that nobody can read anyway. */
html[data-nix-leolist-dark] {
  color-scheme: dark;
  background: var(--nl-bg) !important;
}
html[data-nix-leolist-dark] body {
  background: var(--nl-bg) !important;
  color: var(--nl-text) !important;
}
/* !important, and that is measured: without it eleven elements on an ad detail
   page kept painting themselves white (DIV.wrap #fff, three DIV.container in
   #f5f5f0/#fff/#f0f0f0 and so on), because a plain element selector under one
   root attribute scores (0,1,2) and the site's own single-class rules outrank
   it. The :not() keeps this layer off the UI this script builds, which has its
   own skin and must not lose it to a blanket override — the constructed rows
   and strips included, because :not() takes its most specific argument and this
   one therefore scores an ID, outranking their own paint. */
html[data-nix-leolist-dark] :is(a, div, section, article, aside, header, footer, nav, main, ul, ol, li, dl, dt, dd, form, fieldset, legend, label, table, thead, tbody, tfoot, tr, td, th, p, span, strong, em, small, h1, h2, h3, h4, h5, h6, figure, figcaption, blockquote, pre, code, details, summary):not(
    #nix-leolist-filters,
    ${OWN_UI}) {
  background-color: transparent !important;
  border-color: var(--nl-edge);
  color: inherit !important;
}
/* Fields are LIFTED off the page, and they get a real border. Measured in the
   More Filters dialog: the site's checkbox is a 32px appearance:none box and
   its text inputs are 44px tall, and BOTH ship border-width:0 — they relied on
   a pale fill to be seen at all. Painting them var(--nl-bg) on a var(--nl-dialog) panel left
   invisible squares, and colouring a zero-width border changed nothing. */
html[data-nix-leolist-dark] :is(input, textarea, select, option):not(
    ${OWN_UI}) {
  background-color: var(--nl-surface) !important;
  color: var(--nl-text) !important;
  border: 1px solid var(--nl-edge-strong) !important;
  box-sizing: border-box;
}
/* The checked state is the site's own background-image, which survives because
   nothing here touches background-image. */
html[data-nix-leolist-dark] :is(input[type="checkbox"], input[type="radio"]):checked:not(#nix-leolist-filters *) {
  border-color: var(--nl-accent) !important;
}
html[data-nix-leolist-dark] :is(button, [role="button"], input[type="submit"], input[type="button"]):not(#nix-leolist-filters, #nix-leolist-filters *, .nix-leolist-fab, .nix-leolist-exit) {
  background-color: var(--nl-raised) !important;
  color: var(--nl-text) !important;
  border: 1px solid var(--nl-edge-strong) !important;
  box-sizing: border-box;
}
html[data-nix-leolist-dark] :is(button, [role="button"]):not(#nix-leolist-filters *, .nix-leolist-fab, .nix-leolist-exit):hover {
  background-color: var(--nl-raised-hi) !important;
}
html[data-nix-leolist-dark] :is(a, button, input, select, textarea, [role="button"]):focus-visible {
  outline: 2px solid var(--nl-accent);
  outline-offset: 2px;
}
html[data-nix-leolist-dark] a:not(
    ${OWN_UI}) {
  color: var(--nl-accent) !important;
}
html[data-nix-leolist-dark] a:visited:not(
    ${OWN_UI}) {
  color: var(--nl-visited) !important;
}
/* Dialogs need their surface back. The blanket rule above drops every painted
   background, which is right for page chrome and wrong for a popup: the sign-in
   and sign-up sheet, the filter dialogs and the language picker all floated
   transparent over the page behind them. They get an opaque panel and an edge;
   their children stay transparent, so the panel reads as one surface. Anchored
   on the site's own hand-written dialog classes plus the standard role and
   element, never a generated one. */
html[data-nix-leolist-dark] :is(.ll-modal, .ll-dialog, [role="dialog"], dialog):not(#nix-leolist-filters) {
  background-color: var(--nl-dialog) !important;
  border: 1px solid var(--nl-edge);
  color: var(--nl-text) !important;
}
/* And the scrim behind them: transparent means the page reads straight through
   a modal that is meant to take the screen. The :not() is carrying weight, not
   decoration — the blanket rule above scores an ID through its own :not(), so
   a plain class rule loses to it even with !important, and the backdrops stayed
   fully transparent until this matched that. */
html[data-nix-leolist-dark] :is(.ll-modal__backdrop, .js-modal-backdrop):not(#nix-leolist-filters) {
  background-color: var(--nl-scrim) !important;
}
/* THE WAY OUT. Dismissing one of these dialogs with a pointer is the site's own
   backdrop click — and opened from the relocated trigger, the backdrop never
   got shown, so the dialog could only be closed with Escape. Measured: the
   dialog opens at 480x664 with body.modal-open set and all three backdrops at
   display:none; force one visible and a click on it closes the dialog and
   clears the class, which is the site's handler doing the work.
   Each backdrop immediately FOLLOWS its own modal (.main-list: #modal-filters
   then backdrop; .main-list-filter: catloc then backdrop, ethnicities then
   backdrop), so the adjacent sibling shows exactly one scrim — the right one —
   and never stacks two. */
html[data-nix-leolist-dark] .ll-modal--open + :is(.ll-modal__backdrop, .js-modal-backdrop) {
  display: block !important;
}
html[data-nix-leolist-dark] ::placeholder {
  color: var(--nl-placeholder);
}
html[data-nix-leolist-dark] :is(img, video, picture, canvas, iframe) {
  background-color: transparent;
}
/* Site chrome, gone. On the pages this script does not rebuild, the header and
   footer are navigation for a site being read as a photo feed — measured on an
   ad detail page, HEADER.main-header is 1512x92 and FOOTER.footer is 1512x1073,
   more than a full viewport of links under every ad.
   Anchored on the SEMANTIC elements at page level: body > header / body >
   footer, plus the one header inside the page's first wrapper, which is where
   this site puts its own. Nothing nested can match — a dialog's <header>, the
   sign-in sheet's included, is never a direct child of the first wrapper. */
html[data-nix-leolist-bare] body > header,
html[data-nix-leolist-bare] body > footer,
html[data-nix-leolist-bare] body > div:first-of-type > header:first-of-type {
  display: none !important;
}
/* The sponsors strip goes with them, everywhere rather than only on a listing
   index: the rule below already drops it under the redesign's own flag, but an
   ad detail page kept its row of paid links because arm() never runs there.
   The site's notice band under the footer goes too — 1512x130 of copy on every
   page, and with the footer gone it was left standing alone at the bottom. */
html[data-nix-leolist-bare] .main-list-sponsors,
html[data-nix-leolist-bare] body > .human-rights,
html[data-nix-leolist-bare] body > .sticky-side {
  display: none !important;
}
/* Allowlist, not blocklist. #main_list is hidden wholesale and only the wraps
   we actually built a row into are shown. LeoList injects chrome straight into
   this list — SECTION.fa-section, DIV.js-listing-results-count, ad slots — and
   naming each kind meant every new one rendered raw until a rule caught up.
   A wrap with no row (sponsored, or not a listing at all) stays hidden because
   listingCard() refused it, so the two agree by construction.
   !important is measured, not defensive: without it the plain rule hid
   DIV.js-listing-results-count but NOT DIV.group or SECTION.fa-section, which
   carry a site declaration that outranks ours. */
html[data-nix-leolist-listings-only] #main_list > * {
  display: none !important;
}
html[data-nix-leolist-listings-only] #main_list > div:has(> .nix-leolist-row),
html[data-nix-leolist-listings-only] #main_list > .nix-leolist-tail {
  display: block !important;
}
/* These can also appear OUTSIDE #main_list, where applyIsland does not reach
   them (it hides ancestor siblings, not descendants). The sponsors row used to
   be listed here too and was dropped: the bare layer hides it site-wide with
   !important, which is a superset of this flag, so this copy never won. */
html[data-nix-leolist-listings-only] aside.main-list__safety-tips,
html[data-nix-leolist-listings-only] .main-list-pagination,
html[data-nix-leolist-listings-only] .lst-item img.huge {
  display: none;
}
html[data-nix-leolist-listings-only] body.modal-open {
  overflow: auto;
}
/* applyIsland() and ensureRow() hide by setting the hidden attribute. This site
   ships !important display rules (see the allowlist note above), so assert it at
   the same weight or those elements stay on screen. */
html[data-nix-leolist-listings-only] [hidden] {
  display: none !important;
}
html[data-nix-leolist-listings-only] .wrap,
html[data-nix-leolist-listings-only] .main-list,
html[data-nix-leolist-listings-only] .main-list-container.container,
html[data-nix-leolist-listings-only] #view-cont {
  width: 100%;
  max-width: none;
  margin-left: 0;
  margin-right: 0;
  box-sizing: border-box;
  padding-left: 0;
  padding-right: 0;
}
html[data-nix-leolist-listings-only] #view-cont > div.col-left {
  float: none;
  width: 100%;
  padding-right: 0;
}
/* The site lays out at a fixed 990px, so below that the document scrolled
   sideways under our island — measured at 768px: scrollWidth 990 against a 768
   viewport. Only the containers we already own are relaxed. */
html[data-nix-leolist-listings-only] body,
html[data-nix-leolist-listings-only] :is(.wrap, .main-list, .main-list-container, #view-cont, .col-left, #main_list) {
  min-width: 0;
  max-width: 100%;
}
html[data-nix-leolist-listings-only] .col-left .group {
  float: none;
  width: 100%;
  margin: 0 0 2px;
}
html[data-nix-leolist-listings-only] #main_list > div > .lst-item {
  display: none;
}
html[data-nix-leolist-listings-only] .nix-leolist-row {
  padding: 0;
  /* Black, not Mocha's base/surface pair: photos are the content and any lift
     behind them reads as a frame around the picture. The 2px strip gaps and the
     row margins go black with it, so nothing draws a box the photos sit inside. */
  background: var(--nl-bg);
  color: var(--nl-text);
  border: 0;
}
html[data-nix-leolist-listings-only] .nix-leolist-photos {
  display: flex;
  flex-wrap: nowrap;
  gap: 2px;
  overflow-x: auto;
  overflow-y: hidden;
  background: var(--nl-bg);
}
html[data-nix-leolist-listings-only] .nix-leolist-row img {
  width: auto;
  height: 384px;
  object-fit: contain;
  object-position: top center;
  flex: 0 0 auto;
  cursor: zoom-in;
}
html[data-nix-leolist-listings-only] .nix-leolist-copy {
  /* Intrinsic, not fixed. A non-shrinkable 420px item is wider than a 390px
     phone and wider than any desktop at 400% zoom, which is WCAG 1.4.10 reflow
     failing by construction — the listing text could only be read by scrolling
     sideways. */
  flex: 0 0 min(420px, 100% - 2rem);
  width: auto;
  height: clamp(240px, 46svh, 384px);
  margin: 0;
  padding: 16px 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
  font-family: ui-sans-serif, system-ui, sans-serif;
  text-align: left;
}
html[data-nix-leolist-listings-only] #main_list.nix-leolist-list--full {
  position: fixed;
  /* inset:0 already sizes this. The width/height that used to follow re-stated
     it in LARGE-viewport units, so with a mobile URL bar on screen every row
     was taller than the visible area — and scroll-snap-stop parked the row
     under the browser chrome. 100vw additionally counted the scrollbar gutter. */
  inset: 0;
  z-index: 2147483646;
  background: var(--nl-bg);
  overflow-x: hidden;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
}
html[data-nix-leolist-listings-only] #main_list.nix-leolist-list--full > div:has(.nix-leolist-row) {
  height: 100dvh;
  margin: 0;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}
html[data-nix-leolist-listings-only] #main_list.nix-leolist-list--full .nix-leolist-row {
  height: 100dvh;
}
html[data-nix-leolist-listings-only] #main_list.nix-leolist-list--full .nix-leolist-photos {
  height: 100%;
  scroll-snap-type: none;
}
html[data-nix-leolist-listings-only] #main_list.nix-leolist-list--full img {
  height: 100%;
  max-height: 100dvh;
  scroll-snap-align: none;
  cursor: default;
}
html[data-nix-leolist-listings-only] #main_list.nix-leolist-list--full .nix-leolist-copy {
  height: 100%;
  max-height: 100dvh;
  flex: 0 0 min(52vw, 640px);
  width: min(52vw, 640px);
  padding: 32px 40px;
  gap: 20px;
  scroll-snap-align: none;
}
/* Must outrank the allowlist's display:block !important on the tail. */
html[data-nix-leolist-listings-only] #main_list.nix-leolist-list--full .nix-leolist-tail {
  display: none !important;
}
html[data-nix-leolist-listings-only] .nix-leolist-tail {
  height: 1px;
  pointer-events: none;
}
html[data-nix-leolist-listings-only] .nix-leolist-heading {
  flex: 0 0 auto;
  margin: 0;
  font: inherit;
}
html[data-nix-leolist-listings-only] .nix-leolist-title {
  flex: 0 0 auto;
  color: var(--nl-accent);
  font-size: 20px;
  font-weight: 700;
  text-decoration: none;
  max-width: 28ch;
}
html[data-nix-leolist-listings-only] .nix-leolist-title:hover {
  color: var(--nl-accent-hi);
}
html[data-nix-leolist-listings-only] .nix-leolist-desc:focus-visible {
  outline: 2px solid var(--nl-accent);
  outline-offset: 2px;
}
html[data-nix-leolist-listings-only] .nix-leolist-copy .nix-leolist-desc {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  color: var(--nl-text);
  /* px, not rem: LeoList sets html{font-size:10px}, so every rem here rendered
     at 5/8 of its intended size — this was 10.5px, and the 36ch measure shrank
     with it, opening 142px of dead space inside the fixed 420px panel. */
  font-size: 17px;
  overflow-x: hidden;
  overflow-y: auto;
  max-width: 36ch;
}
html[data-nix-leolist-listings-only] #main_list.nix-leolist-list--full .nix-leolist-title {
  font-size: clamp(28px, 3.5vw, 42px);
  max-width: 22ch;
}
html[data-nix-leolist-listings-only] #main_list.nix-leolist-list--full .nix-leolist-desc {
  font-size: clamp(20px, 2.4vw, 27px);
  max-width: 32ch;
}
/* The ground used to be painted again here, under the listings-only flag. It
   was dead: every one of those containers loses to the flattening rule's
   ID-weighted transparent, and html/body are already black above. The page
   looks identical without it. */
/* Filtering is an overlay panel on the right, opened by a fixed action button.
   Slid with the 'right' offset, NOT transform/translate: the site's own dialogs
   are position:fixed, and a transformed ancestor becomes the containing block
   of a fixed descendant — a fullscreen dialog would end up trapped inside a
   420px panel. Only the bar and the city rail move in here; the dialogs stay
   where they are, so they keep the viewport and their z-index 10000. */
html[data-nix-leolist-listings-only] .nix-leolist-filters {
  position: fixed;
  top: 0;
  bottom: 0;
  /* Leave a constant gutter rather than a percentage: at 320px, 88vw minus the
     body padding left 246px of content and the stock age slider's 261px track
     was clipped by overflow-x, putting its max handle out of reach. */
  right: calc(-1 * min(420px, 100vw - 48px));
  width: min(420px, 100vw - 48px);
  z-index: 9000;
  display: flex;
  flex-direction: column;
  background: var(--nl-bg);
  border-left: 1px solid var(--nl-edge);
  color: var(--nl-text);
  box-shadow: -24px 0 48px var(--nl-shadow);
  font-family: ui-sans-serif, system-ui, sans-serif;
  transition: right 240ms cubic-bezier(0.22, 1, 0.36, 1);
}
html[data-nix-leolist-listings-only] .nix-leolist-filters--open {
  right: 0;
}
html[data-nix-leolist-listings-only] .nix-leolist-filters__head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--nl-edge);
}
html[data-nix-leolist-listings-only] .nix-leolist-filters__title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--nl-text-dim);
}
html[data-nix-leolist-listings-only] .nix-leolist-filters__close {
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 8px;
  color: var(--nl-text);
  font-size: 24px;
  line-height: 1;
  padding: 2px 10px 6px;
  cursor: pointer;
}
html[data-nix-leolist-listings-only] .nix-leolist-filters__close:hover {
  background: var(--nl-surface);
  color: var(--nl-danger);
}
html[data-nix-leolist-listings-only] .nix-leolist-filters__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 16px 18px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  scrollbar-width: thin;
}
/* The relocated controls are the site's own, so they are skinned by ELEMENT and
   attribute, never by a framework class name. Class+element outranks the stock
   single-class rules, which is why none of this needs !important — read off the
   live panel rather than assumed. Scoped to __body so the panel's own header and
   close button keep their own rules instead of losing to a generic button one. */
html[data-nix-leolist-listings-only] .nix-leolist-filters__body :is(div, section, span, p, ul, ol, li, form, fieldset, legend, label, h1, h2, h3, h4, h5, dl, dt, dd, table, tbody, tr, td, th) {
  background-color: transparent;
  color: inherit;
  border-color: var(--nl-edge);
  box-shadow: none;
}
/* Stock display type is sized for a full-width bar: the 42px category heading
   ran straight off a 420px panel and clipped. */
html[data-nix-leolist-listings-only] .nix-leolist-filters__body :is(h1, h2, h3, h4, h5) {
  margin: 0;
  font-size: 18px;
  line-height: 1.35;
}
html[data-nix-leolist-listings-only] .nix-leolist-filters__body * {
  max-width: 100%;
  overflow-wrap: break-word;
}
/* The bar is a grid sized for a full-width page. Measured in the panel on a
   /personals index: a 959px track inside a 383px column, overflowing by 558px,
   which clipped the heading and pushed the centred More Filters label clean off
   screen — the button read as an empty box. One track that cannot exceed the
   column fixes all of it, and min-width:0 is the other half: an unset
   min-width:auto pins a flex or grid item to its content width, so max-width
   alone never shrinks it. */
html[data-nix-leolist-listings-only] .nix-leolist-filters__body [data-nix-leolist-moved] {
  width: 100%;
}
/* Every grid inside a moved island, not just its root: the bar's own track was
   383px once fixed, but .filters__row underneath it still asked for
   410px + 409px + 108px, and three fixed tracks in a 383px rail put the search
   box and the Verified toggle off screen. One column stacks them, which is the
   right shape for a sidebar anyway. */
html[data-nix-leolist-listings-only] .nix-leolist-filters__body [data-nix-leolist-moved],
html[data-nix-leolist-listings-only] .nix-leolist-filters__body [data-nix-leolist-moved] * {
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  row-gap: 12px;
}
/* Stock centres the category heading across the page width; in a 420px column
   that reads as a stray indent. It is also a nowrap flex row of
   category / "in" / location, each with its own ellipsis: squeezed into the
   rail it truncated BOTH halves and broke the word "in" down two lines. Let the
   row wrap and the parts keep their own line. */
html[data-nix-leolist-listings-only] .nix-leolist-filters__body :is(h1, h2, h3) {
  /* display:flex is pinned, not assumed: this heading is a flex row on the
     sections measured, but an inline-flex one would shrink-wrap and take its
     width from its content instead of the column. Block-level flex + wrap is
     what lets the parts drop to the next line when they do not fit, rather
     than ellipsing or pushing the chevron off on its own. */
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
  text-align: start;
  column-gap: 6px;
  row-gap: 2px;
  font-size: 17px;
}
html[data-nix-leolist-listings-only] .nix-leolist-filters__body :is(h1, h2, h3) * {
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
  /* Stock spaces these parts with margins sized for a 960px bar — 9px either
     side of "in" and 17px before the chevron. Measured in the rail that was
     400px of content in a 383px column, which is exactly what bumped the
     chevron onto a line of its own. The column-gap does the spacing now. */
  margin-inline: 0;
}
html[data-nix-leolist-listings-only] .nix-leolist-filters__body :is(input[type="text"], input[type="search"], input[type="number"], input[type="tel"], input[type="email"], textarea, select) {
  background: var(--nl-surface);
  color: var(--nl-text);
  border: 1px solid var(--nl-edge-strong);
  border-radius: 8px;
}
html[data-nix-leolist-listings-only] .nix-leolist-filters__body input[type="range"] {
  width: 100%;
}
html[data-nix-leolist-listings-only] .nix-leolist-filters__body :is(button, summary, [role="button"]) {
  background: var(--nl-raised);
  color: var(--nl-text);
  border: 1px solid var(--nl-edge-strong);
  border-radius: 10px;
}
html[data-nix-leolist-listings-only] .nix-leolist-filters__body :is(button, summary, [role="button"]):hover {
  background: var(--nl-surface);
  color: var(--nl-accent);
}
html[data-nix-leolist-listings-only] .nix-leolist-filters__body a {
  color: var(--nl-accent);
}
/* One corner, two functions. Top-right holds the filter button in the normal
   view and the close button in fullscreen — never both, so the control under
   the pointer keeps its place and only its job changes. Shared geometry is
   what makes that read as one control rather than two that happen to overlap.
   Both sit above the fullscreen list (z 2147483646). */
html[data-nix-leolist-listings-only] :is(.nix-leolist-fab, .nix-leolist-exit) {
  position: fixed;
  /* max() with the safe-area inset: in landscape on a notched phone a 48px
     control at a flat 24px sits under the notch. */
  top: max(24px, env(safe-area-inset-top, 0px));
  right: max(24px, env(safe-area-inset-right, 0px));
  z-index: 2147483647;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--nl-edge);
  background: var(--nl-fab-fill);
  color: var(--nl-text);
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 8px 24px var(--nl-shadow);
  transition: right 240ms cubic-bezier(0.22, 1, 0.36, 1), background 160ms ease, color 160ms ease, transform 120ms ease;
}
html[data-nix-leolist-listings-only] .nix-leolist-fab:hover {
  background: var(--nl-surface);
  color: var(--nl-accent);
}
html[data-nix-leolist-listings-only] .nix-leolist-exit:hover {
  background: var(--nl-surface);
  color: var(--nl-danger);
}
html[data-nix-leolist-listings-only] :is(.nix-leolist-fab, .nix-leolist-exit):focus-visible {
  outline: 2px solid var(--nl-accent);
  outline-offset: 3px;
}
/* The swap, both halves of it. :has() on the ROOT, not a sibling combinator off
   #main_list: measured on the live page, #main_list sits in DIV.main-items-list
   inside .col-left, so it is the buttons' UNCLE and a sibling combinator
   matched nothing. The subject is <html>, so the match count is exactly one by
   construction, and :has() carries its argument's specificity — which is how
   these two rules outrank the shared block above. */
html[data-nix-leolist-listings-only] .nix-leolist-exit {
  display: none;
}
html[data-nix-leolist-listings-only]:has(#main_list.nix-leolist-list--full) .nix-leolist-exit {
  display: grid;
}
html[data-nix-leolist-listings-only]:has(#main_list.nix-leolist-list--full) .nix-leolist-fab {
  display: none;
}
/* The filter button rides the panel edge instead of hiding under it. The close
   button never needs this: opening the panel leaves fullscreen, so the two are
   never on screen together. */
/* The ride-along only where there is room for it. Below ~700px the panel is
   most of the screen, so a right offset of panel-plus-24 puts it past the left
   edge — off screen, with the panel's own close the only way back. */
@media (min-width: 700px) {
html[data-nix-leolist-listings-only] .nix-leolist-filters--open ~ .nix-leolist-fab {
  right: calc(min(420px, 100vw - 48px) + 24px);
}
}
/* Motion, kept small and consistent: one duration scale and one easing curve,
   so the panel, the corner controls and the dialogs all move the same way.
   Every one of these is inside a no-preference query — under reduce, nothing
   below this point animates at all. */
@media (prefers-reduced-motion: no-preference) {
/* Dialogs and their scrim fade in rather than appearing. display:none is not an
   animatable state, so this needs allow-discrete plus a @starting-style for the
   entry value — without both, the transition is skipped silently. */
html[data-nix-leolist-dark] :is(.ll-modal, .ll-dialog, [role="dialog"], dialog):not(#nix-leolist-filters) {
  transition: opacity 160ms cubic-bezier(0.22, 1, 0.36, 1), display 160ms allow-discrete;
}
html[data-nix-leolist-dark] .ll-modal--open + :is(.ll-modal__backdrop, .js-modal-backdrop) {
  transition: opacity 160ms cubic-bezier(0.22, 1, 0.36, 1), display 160ms allow-discrete;
}
@starting-style {
html[data-nix-leolist-dark] .ll-modal--open,
html[data-nix-leolist-dark] .ll-modal--open + :is(.ll-modal__backdrop, .js-modal-backdrop) {
  opacity: 0;
}
}
/* Photos arrive over the network, so they fade in as they land instead of
   snapping in one by one. Keyed on a marker the loader sets, not on [src]:
   src is assigned before a single byte has decoded, so a src-keyed fade plays
   against an empty box and the picture still pops in at the end. */
html[data-nix-leolist-listings-only] .nix-leolist-photo {
  opacity: 0;
  transition: opacity 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
html[data-nix-leolist-listings-only] .nix-leolist-photo[data-nix-loaded] {
  opacity: 1;
}
/* A press should feel like one. Transform is safe on these two: neither has a
   fixed-position descendant to become the containing block of. */
html[data-nix-leolist-listings-only] :is(.nix-leolist-fab, .nix-leolist-exit):active {
  transform: scale(0.94);
}
html[data-nix-leolist-listings-only] .nix-leolist-filters__close:active {
  transform: scale(0.9);
}
}
@media (prefers-reduced-motion: reduce) {
html[data-nix-leolist-listings-only] .nix-leolist-filters,
html[data-nix-leolist-listings-only] .nix-leolist-fab,
html[data-nix-leolist-listings-only] .nix-leolist-exit {
  transition: none;
}
html[data-nix-leolist-listings-only] .nix-leolist-photo {
  opacity: 1;
}
}
@media (min-width: 900px) {
html[data-nix-leolist-listings-only],
html[data-nix-leolist-listings-only] body {
  height: 100%;
  overflow: hidden;
}
html[data-nix-leolist-listings-only] #view-cont,
html[data-nix-leolist-listings-only] .col-left {
  height: 100dvh;
  overflow: hidden;
}
html[data-nix-leolist-listings-only] #main_list {
  height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scrollbar-width: thin;
}
html[data-nix-leolist-listings-only] .nix-leolist-row img,
html[data-nix-leolist-listings-only] .nix-leolist-copy {
  height: calc((100dvh - 4px) / 3);
}
html[data-nix-leolist-listings-only] .nix-leolist-snap {
  scroll-snap-align: start;
  scroll-snap-stop: always;
}
html[data-nix-leolist-listings-only] #main_list.nix-leolist-list--full .nix-leolist-row img,
html[data-nix-leolist-listings-only] #main_list.nix-leolist-list--full .nix-leolist-copy {
  height: 100dvh;
}
}
`;

  const sheet = new CSSStyleSheet();
  sheet.replaceSync(SHEET_CSS);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  bag.sheet = sheet;

  // Independent of arm(): the dark layer is for the WHOLE site, including every
  // page this script builds nothing on. documentElement exists at document-start,
  // body does not, so the flag goes on the root and the rules reach body through
  // it once the parser gets there.
  const armDark = () => {
    const root = document.documentElement;
    if (!root) return;
    if (root.dataset.nixLeolistDark === undefined) root.dataset.nixLeolistDark = '';
    if (root.dataset.nixLeolistBare === undefined) root.dataset.nixLeolistBare = '';
  };
  armDark();

  // ---- dark variants computed from the site's own CSS -------------------
  //
  // The rules above FLATTEN: they drop painted backgrounds so the black root
  // shows through. That is right for page chrome and wrong wherever the light
  // fill WAS the widget — the age slider proved it, its 261x16 track and its
  // selected-range bar both went rgba(0,0,0,0) and disappeared while the
  // handles survived only because they are drawn with a background-image.
  //
  // So the colours are computed instead of discarded. Every declaration the
  // site ships is read back out of the CSSOM, its lightness inverted with hue
  // and saturation preserved, and the result re-emitted under the same
  // selector: a #e5e5e5 track becomes a dark grey track, a blue badge stays
  // blue. HSL throughout — one space for both the decision and the output, so
  // the two never disagree.
  const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

  const readRgb = (value) => {
    const m = /^rgba?\(([^)]+)\)$/.exec(value.trim());
    if (!m) return null;
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
    const a = parts.length > 3 ? parts[3] : 1;
    return [parts[0], parts[1], parts[2], a];
  };

  const rgbToHsl = (r, g, b) => {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    return [h / 6, sat, l];
  };

  const hueToRgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const hslToRgb = (h, sat, l) => {
    if (sat === 0) {
      const v = Math.round(l * 255);
      return [v, v, v];
    }
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
    const p = 2 * l - q;
    return [
      Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
      Math.round(hueToRgb(p, q, h) * 255),
      Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
    ];
  };

  // Only LIGHT surfaces are inverted, and only DARK text: a colour that already
  // works on black is left exactly as it is. That asymmetry is the whole trick —
  // a blanket invert would flip the site's own dark accents into pale ones.
  //
  // Saturation decides how far a colour may move, and that is measured too. The
  // age slider's selected range is rgb(72, 107, 224) — lightness 0.58, which a
  // plain lightness threshold inverted to rgb(17, 36, 100), turning the one
  // element that marks the chosen range into a bar you cannot see. A saturated
  // colour is an ACCENT: it already reads on black and keeps its value unless
  // it is so pale it would glare, and only near-neutral surfaces — the whites
  // and the paper greys — get inverted outright.
  // CHROMA decides neutrality, not HSL saturation. Measured the difference: the
  // homepage ground is rgb(252, 252, 248), four points of yellow in a near
  // white — and HSL calls that saturation 0.40, because the formula divides by
  // (2 - max - min) and that denominator collapses at the light end. Treated as
  // an accent it was pushed to lightness 0.26 WITH that saturation, which is
  // how a cream page became rgb(93, 93, 40): olive, behind every photo. Chroma
  // (max - min) says 0.02 and gets it right.
  const NEUTRAL_C = 0.12;
  const darkVariant = (value, kind) => {
    const rgb = readRgb(value);
    if (!rgb) return null;
    const a = rgb[3];
    if (a === 0) return null;
    const chroma = (Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2])) / 255;
    const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    const sat = hsl[1];
    const l = hsl[2];
    const neutral = chroma < NEUTRAL_C;
    let next = null;
    if (kind === 'bg') {
      if (neutral && l > 0.55) next = 0.04 + (1 - l) * 0.45;
      else if (!neutral && l > 0.82) next = 0.26;
    } else if (kind === 'text') {
      // One threshold, no neutral split: what matters for text is whether it
      // can be read on black, and a mid-slate like rgb(75, 103, 117) is an
      // accent by chroma yet invisible on a dark ground. Hue and saturation
      // ride along, so a blue link stays blue.
      if (l < 0.55) next = 0.72 + (0.55 - l) * 0.3;
    } else if (kind === 'edge') {
      if (neutral && l > 0.55) next = 0.26 + (1 - l) * 0.3;
      else if (!neutral && l > 0.85) next = 0.34;
    }
    if (next === null) return null;
    const out = hslToRgb(hsl[0], sat, clamp01(next));
    return 'rgba(' + out[0] + ', ' + out[1] + ', ' + out[2] + ', ' + a + ')';
  };

  const COLOR_PROPS = [
    ['background-color', 'bg'],
    ['color', 'text'],
    ['border-top-color', 'edge'],
    ['border-right-color', 'edge'],
    ['border-bottom-color', 'edge'],
    ['border-left-color', 'edge'],
    ['outline-color', 'edge'],
    ['text-decoration-color', 'text'],
  ];

  // Emitted selectors carry :not(#nix-leolist-filters *) for two reasons: it
  // keeps the panel's own skin, and :not() takes its argument's specificity, so
  // the override outranks the ID-weighted flattening rule above it. A selector
  // with a pseudo-ELEMENT cannot take a trailing :not(), and does not need to —
  // nothing above targets ::before or ::after.
  // The page ground is this script's, not the site's. A remapped rule carries an
  // ID through its :not() and so outranks the base black — measured: LeoList
  // paints body a pale cream, which the mapping turned into rgb(93, 93, 40), a
  // olive page behind every photo. Ground selectors are skipped outright.
  // Ground, plus the containers this script paints itself. Everything here is
  // already named by a rule in the stylesheet above, so the remap would be
  // second-guessing a decision that has an author.
  const GROUND = /(^|[\s>+~])(html|body|:root)([\s>+~.:[]|$)/;
  // Measured on the live page: #main_list carries class `main-list-items` and
  // its PARENT is `main-items-list`. Near-transposed names, both real, and
  // listing only one of them let the other be repainted over the base black.
  const OURS = /#main_list|main-list-items|main-items-list|col-left|view-cont|main-list-container|(^|[\s>+~.])(wrap|main-list)([\s>+~.:[]|$)/;
  const scopeSelector = (selectorText) => {
    const parts = selectorText.split(',');
    const out = [];
    for (let i = 0; i < parts.length; i += 1) {
      const one = parts[i].trim();
      if (!one || one.indexOf('nix-leolist') !== -1) continue;
      if (GROUND.test(one) || OURS.test(one)) continue;
      out.push(
        one.indexOf('::') === -1
          ? 'html[data-nix-leolist-dark] ' + one + ':not(' + OWN_UI_SEL + ')'
          : 'html[data-nix-leolist-dark] ' + one,
      );
    }
    return out.join(', ');
  };

  const MAX_RULES = 20000;
  let darkSeen = 0;
  const collectDark = (list, out) => {
    for (let i = 0; i < list.length; i += 1) {
      const rule = list[i];
      if (darkSeen > MAX_RULES) return;
      if (rule.cssRules && !rule.selectorText) {
        collectDark(rule.cssRules, out);
        continue;
      }
      if (!rule.selectorText || !rule.style) continue;
      darkSeen += 1;
      // Every declared colour is re-emitted, mapped OR kept. Keeping matters as
      // much as mapping: the flattening rule above scores an ID, so a colour
      // this layer decides to preserve would be wiped by it unless the override
      // says so out loud. Measured the hard way — the slider's accent survived
      // while it was being darkened, then vanished the moment the mapping
      // started leaving accents alone.
      const decls = [];
      for (let p = 0; p < COLOR_PROPS.length; p += 1) {
        const prop = COLOR_PROPS[p][0];
        const value = rule.style.getPropertyValue(prop);
        if (!value || !readRgb(value)) continue;
        const mapped = darkVariant(value, COLOR_PROPS[p][1]);
        decls.push(prop + ': ' + (mapped || value) + ' !important');
      }
      if (!decls.length) continue;
      const sel = scopeSelector(rule.selectorText);
      if (!sel) continue;
      out.push(sel + ' { ' + decls.join('; ') + ' }');
    }
  };

  const remapDark = () => {
    if (bag.torn) return 0;
    const started = Date.now();
    const out = [];
    darkSeen = 0;
    const sheets = document.styleSheets;
    for (let i = 0; i < sheets.length; i += 1) {
      try {
        if (sheets[i] === bag.sheet || sheets[i] === bag.darkSheet) continue;
        collectDark(sheets[i].cssRules, out);
      } catch {
        /* cross-origin sheet: unreadable by design */
      }
    }
    if (!out.length) return 0;
    if (!bag.darkSheet) {
      bag.darkSheet = new CSSStyleSheet();
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, bag.darkSheet];
    }
    bag.darkSheet.replaceSync(out.join('\n'));
    const root = document.documentElement;
    // Measurable from the outside, which is how the acceptance spec checks that
    // the remap actually ran rather than assuming it did.
    root.dataset.nixLeolistDarkRules = String(out.length);
    root.dataset.nixLeolistDarkMs = String(Date.now() - started);
    return out.length;
  };

  // One repair pass the stylesheet cannot do. A rule maps colours without
  // knowing what the element will sit ON, and accents are deliberately kept:
  // measured on a detail page, rgb(17, 102, 130) text on a kept rgb(77, 170,
  // 218) strip read 2.49 in stock and 1.80 after the lift, because the text was
  // raised toward the same light as its own background. This walks the rendered
  // page once, finds text whose EFFECTIVE background is light, and puts it back
  // to a dark ink. Bounded, and every element it touches is remembered so
  // teardown can undo it.
  const MAX_FIX = 500;
  // WCAG's large-text floor. Below this the text is not readable at any size.
  const MIN_RATIO = 3;
  const INK_DARK = '#11111b';
  const INK_LIGHT = '#e6e9f5';
  // Derived, not typed. These were hand-computed constants and one had gone
  // stale against its ink: 0.7833 is the luminance of roughly #e0e3ef, while
  // #e6e9f5 is 0.8169 — a 4% understatement that could pick the darker ink for
  // a mid-tone the light one reads better on. A pair free to drift did drift.
  const lumOf = (color) => {
    const rgb = readRgb(color);
    if (!rgb || rgb[3] < 0.15) return null;
    const f = (v) => {
      const n = v / 255;
      return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  };

  const hexLum = (hex) =>
    lumOf(
      'rgb(' +
        parseInt(hex.slice(1, 3), 16) +
        ',' +
        parseInt(hex.slice(3, 5), 16) +
        ',' +
        parseInt(hex.slice(5, 7), 16) +
        ')',
    );
  const LUM_INK_DARK = hexLum(INK_DARK);
  const LUM_INK_LIGHT = hexLum(INK_LIGHT);

  const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

  const repairInk = () => {
    if (bag.torn) return 0;
    const body = document.body;
    if (!body) return 0;
    const all = body.querySelectorAll('*');
    // READ pass first, WRITE pass second. Interleaved, every setProperty
    // invalidated style and the next getComputedStyle forced a fresh recalc —
    // up to MAX_FIX forced layouts in one loop.
    const plan = [];
    for (let i = 0; i < all.length && plan.length < MAX_FIX; i += 1) {
      const el = all[i];
      if (el.closest('.nix-leolist-filters, .nix-leolist-fab, .nix-leolist-exit')) continue;
      // Hidden elements still answer getComputedStyle, so without this they ate
      // the budget and collected inline styles teardown then had to unwind.
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue;
      let hasText = false;
      const kids = el.childNodes;
      for (let k = 0; k < kids.length; k += 1) {
        if (kids[k].nodeType === 3 && kids[k].textContent.trim().length > 1) {
          hasText = true;
          break;
        }
      }
      if (!hasText) continue;
      // A background IMAGE is the one thing this maths cannot see: the whole
      // dark strategy keeps images intact, so an element whose declared colour
      // is pale can be painted dark by a picture. Forcing dark ink there turns
      // readable text invisible — the exact harm this pass exists to prevent.
      let node = el;
      let bg = null;
      let painted = false;
      while (node) {
        const cs = getComputedStyle(node);
        if (cs.backgroundImage !== 'none') {
          painted = true;
          break;
        }
        bg = lumOf(cs.backgroundColor);
        if (bg !== null) break;
        node = node.parentElement;
      }
      if (painted || bg === null) continue;
      const ink = lumOf(getComputedStyle(el).color);
      if (ink === null) continue;
      // Mid-tones are the trap, not light grounds: the strip that broke reads
      // luminance 0.35, so a "background is light" gate skipped it entirely.
      // The only question worth asking is whether the text reads at all.
      const ratio = contrast(ink, bg);
      if (ratio >= MIN_RATIO) continue;
      const dark = contrast(bg, LUM_INK_DARK);
      const light = contrast(LUM_INK_LIGHT, bg);
      if (Math.max(dark, light) <= ratio) continue;
      plan.push([el, dark >= light ? INK_DARK : INK_LIGHT]);
    }
    for (let i = 0; i < plan.length; i += 1) {
      plan[i][0].style.setProperty('color', plan[i][1], 'important');
      plan[i][0].dataset.nixLeolistInk = '';
      bag.inked.push(plan[i][0]);
    }
    // Accumulated, not overwritten: this runs twice (DOMContentLoaded, then
    // load), and the second pass finds the first pass's elements already at
    // ratio, so reporting its own count reported roughly zero.
    document.documentElement.dataset.nixLeolistDarkInk = String(bag.inked.length);
    return plan.length;
  };

  // Sheets arrive late, and a SPA route can add more. childList on head only —
  // never subtree, and never on a large DOM.
  const watchDark = () => {
    if (bag.torn) return;
    remapDark();
    repairInk();
    const head = document.head || document.documentElement;
    if (!head || bag.darkObs) return;
    let queued = false;
    bag.darkObs = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (bag.torn) return;
        remapDark();
      });
    });
    bag.darkObs.observe(head, { childList: true });
    bag.observers.push(bag.darkObs);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchDark, {
      once: true,
      signal: bag.ctrl.signal,
    });
  } else {
    watchDark();
  }
  window.addEventListener(
    'load',
    () => {
      remapDark();
      repairInk();
    },
    { once: true, signal: bag.ctrl.signal },
  );

  const unlockScroll = () => {
    const body = document.body;
    if (body && body.classList.contains('modal-open')) {
      bag.modalWas = true;
      body.classList.remove('modal-open');
    }
  };

  // The site ships a body.light theme and no .dark rules; adding .dark styled
  // nothing. Only dropping .light matters, so that is all this does.
  const dropLightTheme = () => {
    const body = document.body;
    if (!body) return;
    if (body.classList.contains('light')) bag.lightWas = true;
    body.classList.remove('light');
  };

  const exemptFilterHosts = () => {
    for (let i = 0; i < FILTER_SHOW.length; i += 1) {
      const host = document.querySelector(FILTER_SHOW[i]);
      if (!host) continue;
      if (host.dataset.nixLeolistShow === undefined) {
        host.dataset.nixLeolistShow = '';
        bag.exempt.push(host);
      }
      if (host.hidden) host.hidden = false;
    }
  };

  // Re-runs on every island pass, so it must be idempotent AND self-healing:
  // a node we already hold is left alone, and one the site has taken back is
  // forgotten so the fresh copy can be re-homed. Asserted from the DOM each
  // pass (body.contains), never latched on a flag.
  const relocateFilters = (body) => {
    if (!body) return;
    for (let i = 0; i < FILTER_MOVE.length; i += 1) {
      const sel = FILTER_MOVE[i];
      const held = bag.relocated.findIndex((r) => r.sel === sel);
      if (held !== -1) {
        if (body.contains(bag.relocated[held].node)) continue;
        bag.relocated.splice(held, 1);
      }
      const node = document.querySelector(sel);
      if (!node || body.contains(node)) continue;
      bag.relocated.push({
        sel,
        node,
        parent: node.parentElement,
        next: node.nextSibling,
        hidden: node.hidden,
      });
      node.hidden = false;
      // Our own mark, so the panel can size what it took in without naming a
      // single one of the site's classes. The value is a key, and a hidden slot
      // left behind at the original position carries the same one: that is what
      // lets a LATER copy of this script put the node back, which a closure
      // cannot do once its teardown global has been overwritten.
      const key = 'm' + i;
      const slot = document.createElement('div');
      slot.dataset.nixLeolistSlot = key;
      slot.hidden = true;
      if (node.parentElement) node.parentElement.insertBefore(slot, node);
      node.dataset.nixLeolistMoved = key;
      bag.relocated[bag.relocated.length - 1].slot = slot;
      body.appendChild(node);
    }
  };

  // Teardown contract: every relocated node goes back to its original parent at
  // its original next-sibling, hidden exactly as it was found.
  const restoreFilters = () => {
    for (let i = bag.relocated.length - 1; i >= 0; i -= 1) {
      const r = bag.relocated[i];
      try {
        // The slot is the authority — it moved with the DOM if the site
        // re-rendered around it. Parent + next-sibling is the fallback.
        if (r.slot && r.slot.parentElement) {
          r.slot.parentElement.insertBefore(r.node, r.slot);
          r.slot.remove();
        } else if (r.parent && r.parent.isConnected) {
          const next = r.next && r.next.parentElement === r.parent ? r.next : null;
          r.parent.insertBefore(r.node, next);
        }
        r.node.hidden = r.hidden;
        delete r.node.dataset.nixLeolistMoved;
      } catch {
        /* ignore */
      }
    }
    bag.relocated.length = 0;
    for (let i = 0; i < bag.exempt.length; i += 1) {
      try {
        delete bag.exempt[i].dataset.nixLeolistShow;
      } catch {
        /* ignore */
      }
    }
    bag.exempt.length = 0;
  };

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const svgEl = (name, attrs) => {
    const el = document.createElementNS(SVG_NS, name);
    const keys = Object.keys(attrs);
    for (let i = 0; i < keys.length; i += 1) el.setAttribute(keys[i], attrs[keys[i]]);
    return el;
  };

  // Built node by node rather than innerHTML: a site is free to ship
  // require-trusted-types-for, and an assignment that throws there would take
  // the whole button with it.
  const slidersIcon = () => {
    const svg = svgEl('svg', {
      viewBox: '0 0 24 24',
      width: '22',
      height: '22',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    });
    const rows = [
      [7, 15],
      [12, 9],
      [17, 18],
    ];
    for (let i = 0; i < rows.length; i += 1) {
      const y = rows[i][0];
      svg.appendChild(svgEl('line', { x1: 3, y1: y, x2: 21, y2: y }));
      svg.appendChild(
        svgEl('circle', { cx: rows[i][1], cy: y, r: 2.6, fill: 'currentColor', stroke: 'none' }),
      );
    }
    return svg;
  };

  const crossIcon = () => {
    const svg = svgEl('svg', {
      viewBox: '0 0 24 24',
      width: '20',
      height: '20',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    });
    svg.appendChild(svgEl('line', { x1: 5, y1: 5, x2: 19, y2: 19 }));
    svg.appendChild(svgEl('line', { x1: 19, y1: 5, x2: 5, y2: 19 }));
    return svg;
  };

  const exitListFull = () => {
    const list = document.getElementById('main_list');
    if (!list) return;
    const wasFull = list.classList.contains('nix-leolist-list--full');
    list.classList.remove('nix-leolist-list--full');
    if (!wasFull) return;
    // The close button is display:none the instant fullscreen ends, so focus
    // would fall to <body> and the next Tab would restart at the top of the
    // document. Hand it back to whatever had it, or to the list.
    const back = bag.fullReturn && bag.fullReturn.isConnected ? bag.fullReturn : list;
    bag.fullReturn = null;
    try {
      back.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  };

  const isFiltersOpen = () =>
    !!(bag.panel && bag.panel.classList.contains('nix-leolist-filters--open'));

  // Asserted from the DOM, not from focus: clicking a trigger leaves focus on
  // the trigger inside the panel, so a focus test said "no dialog" while a
  // dialog was plainly open and Escape closed the wrong thing. Measured stock
  // behaviour 2026-09-13: opening a dialog adds .ll-modal--open to it (and
  // body.modal-open, which this script strips, and which does NOT gate the
  // dialog's display). A rename upstream degrades to the old behaviour.
  const dialogOpen = () => !!document.querySelector('.ll-modal--open');

  const setFilters = (open) => {
    const panel = bag.panel;
    if (!panel) return;
    panel.classList.toggle('nix-leolist-filters--open', open);
    if (bag.fab) bag.fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) {
      if (panel.contains(document.activeElement)) {
        try {
          document.activeElement.blur();
        } catch {
          /* ignore */
        }
      }
      // inert, not just off-canvas: a panel parked at right:-420px is still in
      // the tab order, so Tab would walk into filters nobody can see.
      panel.setAttribute('inert', '');
      if (bag.fab) {
        try {
          bag.fab.focus({ preventScroll: true });
        } catch {
          /* ignore */
        }
      }
      return;
    }
    // The fullscreen list sits at z 2147483646 and the stock dialogs at 10000,
    // so a panel above the list would also cover the dialogs it opens. Leaving
    // fullscreen keeps one honest stack: page < panel < dialog.
    exitListFull();
    panel.removeAttribute('inert');
    const first = panel.querySelector(
      'input:not([type="hidden"]), select, textarea, a[href], button',
    );
    if (first) {
      try {
        first.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }
  };

  const buildFilterPanel = () => {
    if (bag.torn) return;
    const keep = document.querySelector(KEEP);
    if (!keep) return;
    if (bag.panel && keep.contains(bag.panel)) {
      relocateFilters(bag.panel.querySelector('.nix-leolist-filters__body'));
      return;
    }
    const panel = document.createElement('aside');
    panel.id = FILTER_PANEL_ID;
    panel.className = 'nix-leolist-filters';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Filters');
    panel.setAttribute('inert', '');
    const head = document.createElement('header');
    head.className = 'nix-leolist-filters__head';
    const title = document.createElement('h2');
    title.className = 'nix-leolist-filters__title';
    title.id = 'nix-leolist-filters-title';
    title.textContent = 'Filters';
    panel.setAttribute('aria-labelledby', title.id);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'nix-leolist-filters__close';
    close.setAttribute('aria-label', 'Close filters');
    close.textContent = '\u00d7';
    close.addEventListener('click', () => setFilters(false));
    head.appendChild(title);
    head.appendChild(close);
    const body = document.createElement('div');
    body.className = 'nix-leolist-filters__body';
    panel.appendChild(head);
    panel.appendChild(body);
    keep.appendChild(panel);
    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'nix-leolist-fab';
    fab.setAttribute('aria-label', 'Filters');
    fab.setAttribute('aria-controls', FILTER_PANEL_ID);
    fab.setAttribute('aria-expanded', 'false');
    fab.appendChild(slidersIcon());
    fab.addEventListener('click', () => setFilters(!isFiltersOpen()));
    // After the panel in the DOM, because the sibling rules that move the button
    // with the panel edge need it to FOLLOW the panel. Tab order therefore runs
    // panel-then-button; the panel is inert while closed, so in practice Tab
    // reaches the button first and the panel's contents only once it is open.
    keep.appendChild(fab);
    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'nix-leolist-exit';
    exit.setAttribute('aria-label', 'Exit fullscreen');
    exit.appendChild(crossIcon());
    exit.addEventListener('click', exitListFull);
    keep.appendChild(exit);
    bag.panel = panel;
    bag.fab = fab;
    bag.exit = exit;
    relocateFilters(body);
  };

  const applyIsland = () => {
    const keep = document.querySelector(KEEP);
    if (!keep) return false;
    let node = keep;
    while (node.parentElement && node !== document.body) {
      const parent = node.parentElement;
      for (let i = 0; i < parent.children.length; i += 1) {
        const sib = parent.children[i];
        // The dialog hosts are exempt: they carry the stock filter modals, which
        // the panel's own controls open, and hiding them kills a dialog the
        // site is about to show.
        if (sib !== node && !sib.hidden && sib.dataset.nixLeolistShow === undefined) {
          sib.hidden = true;
          bag.islandHidden.push(sib);
        }
      }
      node = parent;
    }
    return true;
  };

  let islandWatching = false;
  const watchIsland = () => {
    if (islandWatching) return;
    const keep = document.querySelector(KEEP);
    if (!keep) return;
    islandWatching = true;
    let queued = false;
    const coalesce = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        // A frame scheduled before teardown still fires after it. Unchecked,
        // this rebuilt the panel and the buttons on a page that had just been
        // returned to stock — the two-panel state, arriving one frame late.
        if (bag.torn) return;
        exemptFilterHosts();
        applyIsland();
        unlockScroll();
        dropLightTheme();
        buildFilterPanel();
        relistIfReplaced();
      });
    };
    let node = keep;
    while (node.parentElement && node !== document.body) {
      const mo = new MutationObserver(coalesce);
      mo.observe(node.parentElement, { childList: true });
      bag.observers.push(mo);
      node = node.parentElement;
    }
  };

  const cache = new Map();
  let active = 0;
  const queue = [];
  const pump = () => {
    while (active < CONCURRENCY && queue.length) {
      const job = queue.shift();
      active += 1;
      job().finally(() => {
        active -= 1;
        pump();
      });
    }
  };
  const enqueue = (job) => {
    queue.push(job);
    pump();
  };

  const storeKey = (href) => STORE_PREFIX + href;

  const pruneStore = (aggressive) => {
    const now = Date.now();
    const keys = [];
    const legacy = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k) continue;
      let isLegacy = false;
      for (let j = 0; j < STORE_LEGACY.length; j += 1) {
        if (k.indexOf(STORE_LEGACY[j]) === 0) {
          isLegacy = true;
          break;
        }
      }
      if (isLegacy) legacy.push(k);
      else if (k.indexOf(STORE_PREFIX) === 0) keys.push(k);
    }
    for (const k of legacy) localStorage.removeItem(k);
    const kept = [];
    for (const k of keys) {
      let row = null;
      try {
        row = JSON.parse(localStorage.getItem(k) || '');
      } catch {
        row = null;
      }
      if (!row || typeof row.t !== 'number') {
        localStorage.removeItem(k);
        continue;
      }
      if (row.miss && now - row.t > NEG_TTL_MS) {
        localStorage.removeItem(k);
        continue;
      }
      kept.push({ k, t: row.t });
    }
    const limit = aggressive ? Math.floor(MAX_STORE / 2) : MAX_STORE;
    if (kept.length <= limit) return;
    kept.sort((a, b) => a.t - b.t);
    const drop = kept.length - limit;
    for (let i = 0; i < drop; i += 1) localStorage.removeItem(kept[i].k);
  };

  const readStore = (href) => {
    try {
      const raw = localStorage.getItem(storeKey(href));
      if (!raw) return null;
      const row = JSON.parse(raw);
      if (!row || typeof row.t !== 'number') return null;
      if (row.miss) {
        if (Date.now() - row.t > NEG_TTL_MS) {
          localStorage.removeItem(storeKey(href));
          return null;
        }
        return { miss: true };
      }
      if (typeof row.d !== 'string' || !Array.isArray(row.p)) return null;
      return { desc: row.d, photos: row.p };
    } catch {
      return null;
    }
  };

  let storeWrites = 0;
  const writeStore = (href, payload) => {
    storeWrites += 1;
    if (storeWrites % PRUNE_EVERY === 0) pruneStore(false);
    try {
      localStorage.setItem(storeKey(href), JSON.stringify(payload));
    } catch {
      try {
        pruneStore(true);
        localStorage.setItem(storeKey(href), JSON.stringify(payload));
      } catch {
        /* quota — in-memory still works this document */
      }
    }
  };

  // Once per document. pruneStore walks every key and JSON.parses up to
  // MAX_STORE rows — doing that on every write was the hot spot.
  try {
    pruneStore(false);
  } catch {
    /* localStorage blocked */
  }

  const imxPayload = (url) => {
    const i = url.indexOf('/czM6Ly9');
    if (i === -1) return url;
    return url.slice(i + 1).split('.')[0];
  };

  const parseDetail = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const descEl = doc.getElementById('preview-description');
    const desc = descEl ? descEl.textContent.replace(/\s+/g, ' ').trim() : '';
    const photos = [];
    const seen = new Set();
    for (const a of doc.querySelectorAll('.account-photos__item a[href]')) {
      const hi = a.getAttribute('href') || '';
      if (hi.indexOf(IMX) !== 0) continue;
      const key = imxPayload(hi);
      if (seen.has(key)) continue;
      seen.add(key);
      photos.push(hi);
    }
    return { desc, photos };
  };

  const originPaused = () => {
    try {
      const until = parseInt(sessionStorage.getItem(PAUSE_KEY) || '0', 10);
      return until > Date.now();
    } catch {
      return false;
    }
  };

  const pauseOrigin = () => {
    try {
      sessionStorage.setItem(PAUSE_KEY, String(Date.now() + ORIGIN_PAUSE_MS));
    } catch {
      /* sessionStorage blocked */
    }
  };

  // Pause -> wait it out. Bare network error -> back off 30s, 1m, 2m, 4m, 8m
  // so an offline tab does not re-storm the origin every 30s forever.
  let retryRounds = 0;
  const retryDelay = () => {
    try {
      const until = parseInt(sessionStorage.getItem(PAUSE_KEY) || '0', 10);
      const left = until - Date.now();
      if (left > 0) return Math.min(left + 1000, ORIGIN_PAUSE_MS);
    } catch {
      /* sessionStorage blocked */
    }
    return RETRY_BACKOFF_MS * Math.pow(2, Math.min(retryRounds, 4));
  };

  // A pause is not a permanent miss. Cards parked as 'retry' are re-armed
  // once the pause expires instead of staying blank for the whole session.
  const scheduleRetry = () => {
    if (bag.retryTimer) return;
    bag.retryTimer = setTimeout(() => {
      bag.retryTimer = 0;
      if (originPaused()) {
        scheduleRetry();
        return;
      }
      retryRounds += 1;
      eachListing((wrap) => {
        if (wrap.dataset.nixLeolistEnrich !== 'retry') return;
        delete wrap.dataset.nixLeolistEnrich;
        observeCard(wrap);
      });
      if (indexNext && !indexDone && !indexBusy) enqueue(growIndex);
    }, retryDelay());
  };

  const loadDetail = async (href) => {
    if (cache.has(href)) {
      const mem = cache.get(href);
      return mem && mem.miss ? null : mem;
    }
    const stored = readStore(href);
    if (stored && stored.miss) {
      cache.set(href, stored);
      return null;
    }
    if (stored) {
      cache.set(href, stored);
      return stored;
    }
    if (originPaused()) return RETRY;
    let res;
    try {
      res = await fetch(href, { credentials: 'same-origin', cache: 'default', signal: netSignal() });
    } catch {
      return RETRY;
    }
    if (res.status === 403 || res.status === 429 || res.status === 503) {
      pauseOrigin();
      return RETRY;
    }
    if (!res.ok) {
      const miss = { miss: true };
      cache.set(href, miss);
      writeStore(href, { t: Date.now(), miss: true });
      return null;
    }
    const parsed = parseDetail(await res.text());
    cache.set(href, parsed);
    writeStore(href, { t: Date.now(), d: parsed.desc, p: parsed.photos });
    await wait(HTML_GAP_MS);
    return parsed;
  };

  // The gap constants are the fair-use knob and are 0 today. setTimeout(0) is
  // still a macrotask, so short-circuit instead of paying for four of them per
  // listing.
  const wait = (ms) =>
    ms > 0
      ? new Promise((resolve) => {
          setTimeout(resolve, ms);
        })
      : Promise.resolve();

  let imgCacheP = null;
  let imgPuts = 0;

  // Cache Storage evicts nothing on its own: without this the 1024px blob of
  // every listing ever scrolled stays on disk forever (hundreds of MB).
  // keys() is insertion-ordered, so dropping the head is a FIFO approximation.
  const trimImgCache = async (store) => {
    try {
      const keys = await store.keys();
      const over = keys.length - IMG_MAX;
      for (let i = 0; i < over; i += 1) await store.delete(keys[i]);
    } catch {
      /* ignore */
    }
  };

  const notePut = (store) => {
    imgPuts += 1;
    if (imgPuts % IMG_TRIM_EVERY === 0) trimImgCache(store);
  };

  const imgCache = () => {
    if (!imgCacheP) {
      imgCacheP = caches.open(IMG_CACHE).then(async (store) => {
        try {
          const names = await caches.keys();
          for (const name of names) {
            if (name !== IMG_CACHE && IMG_CACHE_RE.test(name)) await caches.delete(name);
          }
        } catch {
          /* ignore */
        }
        await trimImgCache(store);
        return store;
      });
    }
    return imgCacheP;
  };

  const OBJ_MAX = 150;
  // objectURL -> img. Map iteration is insertion-ordered, so the head is the
  // oldest still-live blob URL.
  const objUrls = new Map();

  const releaseObj = (obj) => {
    const img = objUrls.get(obj);
    objUrls.delete(obj);
    if (img && img.dataset.nixObj === obj) delete img.dataset.nixObj;
    URL.revokeObjectURL(obj);
  };

  const trimObjUrls = () => {
    while (objUrls.size > OBJ_MAX) {
      const oldest = objUrls.keys().next();
      if (oldest.done) return;
      releaseObj(oldest.value);
    }
  };

  const paintImg = (img, src) =>
    new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      img.addEventListener(
        'load',
        () => {
          img.dataset.nixLoaded = '';
          done();
        },
        { once: true },
      );
      img.addEventListener('error', done, { once: true });
      img.src = src;
      if (img.complete) done();
    });

  // Revoking straight after the first paint is a trap: Chrome may drop a
  // decoded offscreen image and re-request src, which then fails on the dead
  // blob URL and the photo goes blank when you scroll back. Hold the URL, cap
  // how many are live, and fall back to the network URL if one does die.
  const paintBlob = async (img, blob, url) => {
    const obj = URL.createObjectURL(blob);
    img.dataset.nixSrc = url;
    img.dataset.nixObj = obj;
    objUrls.set(obj, img);
    trimObjUrls();
    img.addEventListener(
      'error',
      () => {
        const back = img.dataset.nixSrc;
        if (back && img.src !== back) img.src = back;
      },
      { once: true },
    );
    await paintImg(img, obj);
  };

  const loadOne = async (img, url) => {
    if (!img || !url) return;
    const store = await imgCache();
    const hit = await store.match(url);
    if (hit) {
      if (hit.type === 'opaque') {
        // Body is unreadable, but the HTTP cache holds the bytes. Paint from
        // the URL and do not re-put — re-putting every load defeated the trim.
        await paintImg(img, url);
        await wait(IMG_GAP_MS);
        return;
      }
      try {
        const blob = await hit.blob();
        if (blob && blob.size) {
          await paintBlob(img, blob, url);
          return;
        }
      } catch {
        /* fall through */
      }
    }
    let stored = false;
    try {
      const res = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'force-cache',
        signal: netSignal(),
      });
      if (res.ok) {
        const blob = await res.blob();
        await store.put(
          url,
          new Response(blob, { headers: { 'Content-Type': blob.type || 'image/webp' } }),
        );
        notePut(store);
        stored = true;
        await paintBlob(img, blob, url);
        await wait(IMG_GAP_MS);
        return;
      }
    } catch {
      /* imx likely no CORS */
    }
    await paintImg(img, url);
    if (!stored) {
      try {
        const opaque = await fetch(url, {
          mode: 'no-cors',
          credentials: 'omit',
          cache: 'force-cache',
          signal: netSignal(),
        });
        await store.put(url, opaque);
        notePut(store);
      } catch {
        /* ignore */
      }
    }
    await wait(IMG_GAP_MS);
  };

  let rowSeq = 0;
  const ensureRow = (wrap) => {
    const existing = wrap.querySelector(':scope > .nix-leolist-row');
    if (existing) return existing;
    const href = cardHref(wrap);
    const titleEl = wrap.querySelector('.lst-item__title');
    const title = titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim() : '';
    const row = document.createElement('article');
    row.className = 'nix-leolist-row';
    const photos = document.createElement('div');
    photos.className = 'nix-leolist-photos';
    // Every photo is alt="" (there is no alt text for a user upload), so the
    // strip itself carries the fact that there IS content here.
    photos.setAttribute('role', 'group');
    photos.setAttribute('aria-label', title ? title + ' — photos' : 'Listing photos');
    // A heading, not a bare link. #main_list hides every stock card, which takes
    // the site's own heading markup out of the accessibility tree — and heading
    // navigation is the one mechanism that makes an endless listing feed usable
    // with a screen reader. Without this the feed announced "article, article,
    // article", each with no name.
    const headingId = 'nix-leolist-h' + (rowSeq += 1);
    const hd = document.createElement('h2');
    hd.className = 'nix-leolist-heading';
    hd.id = headingId;
    const heading = document.createElement('a');
    heading.className = 'nix-leolist-title';
    heading.href = href;
    heading.textContent = title;
    hd.appendChild(heading);
    row.setAttribute('aria-labelledby', headingId);
    const desc = document.createElement('p');
    desc.className = 'nix-leolist-desc';
    // The description is a fixed-height scroll box holding text kept WHOLE, so
    // it overflows on nearly every listing. Unfocusable, a keyboard or switch
    // user could read the visible lines and no more — of the primary content.
    desc.tabIndex = 0;
    desc.setAttribute('role', 'region');
    desc.setAttribute('aria-label', title ? title + ' — description' : 'Listing description');
    const copy = document.createElement('div');
    copy.className = 'nix-leolist-copy';
    copy.appendChild(hd);
    copy.appendChild(desc);
    // Text closes the strip: the photos are the reason to stop on a listing, so
    // they own the resting frame and the title/description are the end card you
    // arrive at after the last photo.
    photos.appendChild(copy);
    row.appendChild(photos);
    wrap.appendChild(row);
    const kids = wrap.children;
    for (let i = 0; i < kids.length; i += 1) {
      if (kids[i] !== row) kids[i].hidden = true;
    }
    return row;
  };

  // Idempotent: photos are inserted ahead of it, so one call up front is enough.
  const trailWithCopy = (photos, copyEl) => {
    if (!photos || !copyEl) return;
    if (photos.lastChild === copyEl) return;
    photos.appendChild(copyEl);
  };

  const renderPhotos = async (wrap, data) => {
    if (bag.torn) return;
    const row = ensureRow(wrap);
    const photos = row.querySelector('.nix-leolist-photos');
    const descEl = row.querySelector('.nix-leolist-desc');
    const copyEl = row.querySelector('.nix-leolist-copy');
    if (descEl && data.desc && !descEl.textContent) descEl.textContent = data.desc;
    trailWithCopy(photos, copyEl);
    if (!photos || photos.querySelector('.nix-leolist-photo')) return;

    // Every photo comes from the detail page lightbox (w:1024). The list card's
    // [data-testid="listing-pic"] thumb is a 304px square crop of one of these,
    // so painting it first just meant one image at the wrong size and aspect.
    const urls = [];
    for (const src of data.photos) {
      const hi = typeof src === 'string' ? src : src.hi;
      if (hi) urls.push(hi);
    }
    // insertBefore, not appendChild: the copy panel is the strip's last child
    // and must stay there. Anchor is nulled unless it really is a child of this
    // strip, because insertBefore throws on a reference node it does not own.
    const anchor = copyEl && copyEl.parentNode === photos ? copyEl : null;
    const pending = [];
    for (const url of urls) {
      const img = document.createElement('img');
      img.className = 'nix-leolist-photo';
      img.alt = '';
      photos.insertBefore(img, anchor);
      pending.push({ el: img, url });
    }
    for (let i = 0; i < pending.length; i += 1) await loadOne(pending[i].el, pending[i].url);
  };

  // Any section's ad detail URL: /<section>/../<slug>-<id>. Was hardcoded to
  // '/personals/', which silently skipped every other index.
  const AD_HREF = /^\/[^/]+\/.+-\d+$/;

  const enrichCard = async (wrap) => {
    // A job queued before teardown must not rebuild the row after it: ensureRow
    // would re-create .nix-leolist-row and re-hide the stock card on a page
    // that is supposed to be back to stock.
    if (bag.torn) return;
    if (wrap.dataset.nixLeolistEnrich !== undefined) return;
    const href = cardHref(wrap);
    if (!href || !AD_HREF.test(href)) return;
    ensureRow(wrap);
    wrap.dataset.nixLeolistEnrich = 'pending';
    try {
      const data = await loadDetail(href);
      if (data === RETRY) {
        wrap.dataset.nixLeolistEnrich = 'retry';
        scheduleRetry();
        return;
      }
      if (!data) {
        wrap.dataset.nixLeolistEnrich = 'fail';
        return;
      }
      await renderPhotos(wrap, data);
      wrap.dataset.nixLeolistEnrich = 'done';
      retryRounds = 0;
    } catch {
      wrap.dataset.nixLeolistEnrich = 'fail';
    }
  };

  let io = null;
  const observeCard = (card) => {
    if (card.dataset.nixLeolistEnrich !== undefined) return;
    if (!io) {
      enqueue(() => enrichCard(card));
      return;
    }
    io.observe(card);
  };

  // Force enrichment instead of waiting for intersection. In the fullscreen
  // overlay every row is a whole viewport tall, so a 600px observer margin does
  // not reach the row you are about to arrow onto: you land on a strip with no
  // images, and Left/Right silently does nothing because there is nothing to
  // scroll. Arrow navigation primes where it lands plus the next two.
  const primeRow = (wrap) => {
    if (!wrap || wrap.dataset.nixLeolistEnrich !== undefined) return;
    if (io) {
      try {
        io.unobserve(wrap);
      } catch {
        /* ignore */
      }
    }
    enqueue(() => enrichCard(wrap));
  };

  const primeFrom = (wraps, idx) => {
    for (let i = idx; i < Math.min(wraps.length, idx + 3); i += 1) primeRow(wraps[i]);
  };

  const listingCard = (wrap) => {
    if (!wrap || wrap.tagName !== 'DIV') return null;
    const cls = ' ' + (wrap.className || '') + ' ';
    if (cls.indexOf(' main-list-sponsors ') !== -1) return null;
    if (cls.indexOf(' main-list-pagination ') !== -1) return null;
    const card = wrap.classList.contains('lst-item')
      ? wrap
      : wrap.querySelector('.lst-item');
    if (!card) return null;
    if (card.querySelector('.lst-item__label--sponsored')) return null;
    if (!card.querySelector(CARD_LINK)) return null;
    return wrap;
  };

  // Collecting them was written out twice, identically, at the two arrow-key
  // call sites.
  const listingWraps = () => {
    const out = [];
    eachListing((wrap) => out.push(wrap));
    return out;
  };

  const eachListing = (fn) => {
    const list = document.getElementById('main_list');
    if (!list) return;
    const kids = list.querySelectorAll(':scope > div');
    for (let i = 0; i < kids.length; i += 1) {
      const wrap = listingCard(kids[i]);
      if (wrap) fn(wrap);
    }
  };

  // Tolerant on separator: ?page=2, &page=2, /page=2, #page=2 all read as 2.
  const pageNum = (href) => {
    const m = /(?:^|[^a-z0-9_])page=(\d+)/i.exec(href || '');
    return m ? parseInt(m[1], 10) : 0;
  };

  // Smallest page number strictly greater than the one we are on. The first
  // non-disabled control can be "previous" — following it paged backwards.
  const nextIndexHref = (root, fromHref) => {
    const doc = root || document;
    const pager = doc.querySelector('.main-list-pagination');
    if (!pager) return '';
    const cur = pageNum(fromHref || location.href) || 1;
    const controls = pager.querySelectorAll(
      'a.main-list-pagination__control[href*="page="]',
    );
    let bestN = Infinity;
    let best = '';
    for (let i = 0; i < controls.length; i += 1) {
      const a = controls[i];
      if ((a.className || '').indexOf('main-list-pagination__control--disabled') !== -1) continue;
      const href = a.getAttribute('href') || '';
      const n = pageNum(href);
      if (!href || n <= cur || n >= bestN) continue;
      bestN = n;
      best = href;
    }
    return best;
  };

  let indexNext = '';
  let indexBusy = false;
  let indexDone = false;
  const indexSeen = new Set();

  // Membership set instead of re-querying every link in #main_list per
  // candidate. scan() tops it up on each list mutation and growIndex adds as it
  // appends, so a lookup is O(1) rather than O(rows) — it was O(rows x cards)
  // for every page appended.
  const seenHrefs = new Set();
  const hrefSeen = (href) => !href || seenHrefs.has(href);

  const growIndex = async () => {
    const href = indexNext;
    if (!href || indexBusy || indexDone || originPaused()) return;
    // A pager that hands back a page we already appended would otherwise
    // refetch it forever: re-inserting the tail re-fires its observer.
    if (indexSeen.has(href)) {
      indexNext = '';
      indexDone = true;
      armTail();
      return;
    }
    indexBusy = true;
    // Only re-arm the tail after real progress: re-appending it re-fires its
    // observer, which on a failed fetch would spin retry -> fail -> retry.
    let progressed = false;
    try {
      let res;
      try {
        res = await fetch(href, { credentials: 'same-origin', cache: 'default', signal: netSignal() });
      } catch {
        scheduleRetry();
        return;
      }
      if (res.status === 403 || res.status === 429 || res.status === 503) {
        pauseOrigin();
        scheduleRetry();
        return;
      }
      if (!res.ok) {
        indexNext = '';
        indexDone = true;
        return;
      }
      indexSeen.add(href);
      const html = await res.text();
      await wait(HTML_GAP_MS);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const src = doc.getElementById('main_list');
      const dest = document.getElementById('main_list');
      if (!src || !dest) return;
      const kids = src.querySelectorAll(':scope > div');
      let added = 0;
      for (let i = 0; i < kids.length; i += 1) {
        const wrap = listingCard(kids[i]);
        if (!wrap) continue;
        const link = wrap.querySelector(CARD_LINK);
        const cardHref = link ? link.getAttribute('href') || '' : '';
        if (hrefSeen(cardHref)) continue;
        seenHrefs.add(cardHref);
        dest.appendChild(document.importNode(wrap, true));
        added += 1;
      }
      const next = nextIndexHref(doc, href);
      if (!added || !next || indexSeen.has(next)) {
        indexNext = '';
        indexDone = true;
      } else {
        indexNext = next;
      }
      progressed = true;
      scan();
    } finally {
      indexBusy = false;
      if (progressed || indexDone) armTail();
    }
  };

  const armTail = () => {
    const list = document.getElementById('main_list');
    if (!list) return;
    if (!indexNext && !indexDone) indexNext = nextIndexHref(document);
    let tail = list.querySelector(':scope > .nix-leolist-tail');
    if (indexDone || !indexNext) {
      off(bag.tailIo);
      bag.tailIo = null;
      if (tail) tail.remove();
      return;
    }
    if (!tail) {
      tail = document.createElement('div');
      tail.className = 'nix-leolist-tail';
    }
    list.appendChild(tail);
    if (bag.tailIo) return;
    if (!self.IntersectionObserver) return;
    // The root depends on which element scrolls, and that flips at the
    // breakpoint. Read once, this went stale on the first resize or rotation
    // across 900px and infinite scroll stopped silently — the tail can never
    // intersect a root that is no longer a scroll container.
    const mql = window.matchMedia(DESKTOP_MQ);
    if (!bag.mqlBound) {
      bag.mqlBound = true;
      mql.addEventListener(
        'change',
        () => {
          if (bag.torn) return;
          off(bag.tailIo);
          bag.tailIo = null;
          armTail();
        },
        { signal: bag.ctrl.signal },
      );
    }
    const desktop = mql.matches;
    bag.tailIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!indexNext || indexBusy || indexDone) continue;
          enqueue(growIndex);
        }
      },
      { root: desktop ? list : null, rootMargin: '800px 0px' },
    );
    bag.tailIo.observe(tail);
  };

  // One pass per list mutation: seed the href set, build the row, arm the
  // observer, mark the snap point. Was two full walks plus a localStorage read
  // per listing.
  const scan = () => {
    if (bag.torn) return;
    eachListing((wrap) => {
      const link = wrap.querySelector(CARD_LINK);
      const href = link ? link.getAttribute('href') || '' : '';
      if (href) seenHrefs.add(href);
      ensureRow(wrap);
      observeCard(wrap);
      if (!wrap.classList.contains('nix-leolist-snap')) {
        wrap.classList.add('nix-leolist-snap');
      }
    });
  };

  const reconnectIo = () => {
    if (document.hidden || !io) return;
    io.disconnect();
    eachListing((card) => {
      if (card.dataset.nixLeolistEnrich !== undefined) return;
      io.observe(card);
    });
  };

  // Re-binds the list-bound observers when the site swaps #main_list wholesale.
  // Nothing observes between col-left and the list, and listMo watches the node
  // itself so its own removal never fires it — with the allowlist still hiding
  // every child of the REPLACEMENT, that is a permanently blank page. Asserted
  // from the DOM each island pass rather than latched.
  const relistIfReplaced = () => {
    if (bag.torn) return;
    const list = document.getElementById('main_list');
    if (!list || list === bag.listNode) return;
    off(bag.listMo);
    bag.listMo = null;
    bag.listNode = null;
    watching = false;
    watchList();
  };

  let watching = false;
  const watchList = () => {
    if (bag.torn) return;
    if (watching) return;
    const list = document.getElementById('main_list');
    if (!list) return;
    watching = true;
    bag.listNode = list;

    if (self.IntersectionObserver) {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            io.unobserve(entry.target);
            enqueue(() => enrichCard(entry.target));
          }
        },
        // A fixed 600px spans several windowed rows but less than one
        // fullscreen row, which is why the overlay kept landing on empty strips.
        { rootMargin: Math.max(600, Math.round(window.innerHeight * 1.5)) + 'px 0px' },
      );
      bag.io = io;
    }

    let queued = false;
    const coalesce = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (bag.torn) return;
        scan();
      });
    };
    const listMo = new MutationObserver(coalesce);
    listMo.observe(list, { childList: true });
    bag.listMo = listMo;
    bag.observers.push(listMo);
    // A rebind re-runs this whole function, and the controller only removes
    // listeners at teardown — so the document-level wiring is bound once and
    // the list-level wiring (above) is what gets rebound.
    const firstBind = !bag.docBound;
    bag.docBound = true;
    bag.onVis = reconnectIo;
    if (firstBind) {
      document.addEventListener('visibilitychange', bag.onVis, { signal: bag.ctrl.signal });
    }
    bag.onHide = () => {
      queue.length = 0;
      off(bag.io);
    };
    bag.onShow = (event) => {
      if (event && event.persisted) reconnectIo();
    };
    if (firstBind) {
      window.addEventListener('pagehide', bag.onHide, { signal: bag.ctrl.signal });
      window.addEventListener('pageshow', bag.onShow, { signal: bag.ctrl.signal });
    }

    const listEl = () => document.getElementById('main_list');
    const exitFakeFull = exitListFull;
    // The row whose top sits at or above the list's top edge — the one being
    // looked at. Same rule decides which listing Up/Down leaves from and which
    // strip Left/Right scrolls.
    const currentIndex = (el, wraps) => {
      // Clamp to the viewport: below 900px #main_list is not a scroll container,
      // the document scrolls instead, and its rect top goes negative as you go
      // down. Comparing against that raw value made every row fail the test and
      // pinned the index at 0, so arrows jumped back to the top of the list.
      const top = Math.max(el.getBoundingClientRect().top, 0);
      let idx = 0;
      for (let i = 0; i < wraps.length; i += 1) {
        if (wraps[i].getBoundingClientRect().top <= top + 32) idx = i;
      }
      return idx;
    };

    // Snap to a child edge, not a fixed delta: photos are w:1024 at native
    // aspect so every one is a different width. The last child is the copy
    // panel, so Right from the final photo lands on the text.
    const stepPhotos = (wrap, dir) => {
      if (!wrap) return;
      const strip = wrap.querySelector('.nix-leolist-photos');
      if (!strip) return;
      const max = strip.scrollWidth - strip.clientWidth;
      if (max <= 0) return;
      const base = strip.getBoundingClientRect().left;
      const here = strip.scrollLeft;
      let target = dir > 0 ? max : 0;
      const kids = strip.children;
      for (let i = 0; i < kids.length; i += 1) {
        const edge = here + (kids[i].getBoundingClientRect().left - base);
        if (dir > 0 && edge > here + 1 && edge < target) target = edge;
        if (dir < 0 && edge < here - 1 && edge > target) target = edge;
      }
      if (target < 0) target = 0;
      if (target > max) target = max;
      try {
        strip.scrollTo({ left: target, behavior: 'instant' });
      } catch {
        strip.scrollLeft = target;
      }
    };

    const revealRow = (row) => {
      if (!row) return;
      try {
        row.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
      } catch {
        row.scrollIntoView();
      }
    };
    const enterListFull = (row) => {
      const el = listEl();
      if (!el) return;
      bag.fullReturn = document.activeElement;
      el.classList.add('nix-leolist-list--full');
      revealRow(row);
      // Focus the way out. Fullscreen otherwise had exactly one exit for a
      // keyboard — Escape — and no way in at all, which left a pointer user's
      // focus stranded behind a cover that hides everything.
      if (bag.exit) {
        try {
          bag.exit.focus({ preventScroll: true });
        } catch {
          /* ignore */
        }
      }
    };
    const inFilters = (node) => !!(node && node.closest && node.closest(FILTER_SAFE));
    bag.onClick = (event) => {
      if (isFiltersOpen()) {
        // Click-outside closes — but a stock dialog lives OUTSIDE the panel, so
        // "outside" is the panel plus the two dialog hosts, not the panel alone,
        // and while a dialog is up every click is the dialog's to answer.
        if (!dialogOpen() && !inFilters(event.target)) setFilters(false);
        return;
      }
      const img = event.target && event.target.closest
        ? event.target.closest('.nix-leolist-photos img')
        : null;
      if (!img) return;
      const row = img.closest('.nix-leolist-row');
      if (!row) return;
      event.preventDefault();
      event.stopPropagation();
      enterListFull(row);
    };
    bag.onKey = (event) => {
      if (event.key === 'Escape') {
        // An open dialog owns Escape: pass it through untouched rather than
        // closing the panel out from under it.
        if (dialogOpen()) return;
        if (isFiltersOpen()) {
          setFilters(false);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        exitFakeFull();
        return;
      }
      // Arrows and PageUp/PageDown belong to the list, never to the filter UI:
      // typing a keyword or tabbing a checkbox list must not scroll listings.
      if (inFilters(event.target)) return;
      const target = event.target;
      const tag = target && target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // Editables and composite widgets own their arrows too — a combobox or a
      // listbox anywhere on the site went dead under a document-level capture.
      if (target && target.isContentEditable) return;
      if (target && target.closest && target.closest('[contenteditable=""], [contenteditable="true"], [role="listbox"], [role="combobox"], [role="menu"], [role="tablist"], [role="slider"], [role="textbox"], [role="grid"]')) {
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const listNode = listEl();
        if (!listNode) return;
        const rows = listingWraps();
        if (!rows.length) return;
        event.preventDefault();
        event.stopPropagation();
        const cur = currentIndex(listNode, rows);
        primeFrom(rows, cur);
        stepPhotos(rows[cur], event.key === 'ArrowRight' ? 1 : -1);
        return;
      }
      if (
        event.key !== 'ArrowDown' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'PageDown' &&
        event.key !== 'PageUp'
      ) {
        return;
      }
      const el = listEl();
      if (!el) return;
      event.preventDefault();
      event.stopPropagation();
      const wraps = listingWraps();
      if (!wraps.length) return;
      const idx = currentIndex(el, wraps);
      const dir = event.key === 'ArrowDown' || event.key === 'PageDown' ? 1 : -1;
      let next = idx + dir;
      if (next < 0) next = 0;
      if (next >= wraps.length) next = wraps.length - 1;
      const node = wraps[next];
      primeFrom(wraps, next);
      try {
        node.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
      } catch {
        node.scrollIntoView(true);
      }
    };
    if (firstBind) {
      document.addEventListener('click', bag.onClick, { capture: true, signal: bag.ctrl.signal });
      document.addEventListener('keydown', bag.onKey, { capture: true, signal: bag.ctrl.signal });
    }
    scan();
    armTail();
  };

  const arm = () => {
    if (bag.torn) return false;
    // Two gates, and a listing index is the only page that passes both. A
    // detail page or the homepage fails the first; an empty category fails the
    // second. Arming on either would wreck a page we build nothing for.
    if (!document.getElementById('main_list')) return false;
    // #main_list EXISTING is not evidence of listings. Measured 2026-09-14 on
    // the live https://www.leolist.cc/jobs/software-qa-dba/central-ontario: the
    // category is empty and the server still ships the container. Its eight
    // children are two <script>s, five hidden <input>s (#pageTitle,
    // #pageDescription, #pageCanonicalUrl{,Fr,Zh}) and one empty
    // DIV.js-listing-results-count — nothing that renders. The site's own
    // "Your search produced no results" panel is #no_results, inside
    // #filter-msgs, a SIBLING of the list and not part of it.
    //
    // So the old one-gate arm() armed there, and the allowlist — #main_list > *
    // display:none, kept only for a wrap holding a .nix-leolist-row — hid all
    // eight while scan() built no row. Measured in that state: #main_list
    // 1512x900 with zero visible children, #no_results pushed to y=901, one
    // viewport of pure black with nothing but the filters button on it. Not
    // stock, not listings: BLANK. /jobs/* is full of these, which is what
    // widening past /personals/ exposed.
    //
    // DIV.js-listing-results-count is not the gate either, and keeping it in
    // the allowlist does not help: measured the same day it is 652x0 with an
    // empty innerHTML and exactly two attributes (class, data-count), so it
    // renders nothing whether shown or hidden. Nor is its data-count read:
    // that is the SITE's tally, and listingCard() also refuses sponsored cards
    // and cards with no a.lst-item__link.mainlist-item — a non-zero count with
    // nothing we would build is the same blank page again.
    //
    // listingWraps() is reused rather than a second "is this a listing" test,
    // so this gate and the rows the allowlist keeps cannot disagree: both ask
    // listingCard(), once, in one place.
    //
    // FAILS TOWARD STOCK. If the site renames .lst-item, the sponsored label or
    // the card link, listingCard() returns null for every child, this returns
    // false, [data-nix-leolist-listings-only] never goes on, and the page
    // renders stock. The old gate failed the other way: #main_list is a plain
    // id that survives any card-class rename, so it would still arm and still
    // hide every child by elimination. Same direction as the rest of the
    // script — a dead selector stops matching, it never mangles.
    if (!listingWraps().length) return false;
    // Before applyIsland, not after: the dialog hosts have to be exempt on the
    // very first pass or the modals spend a frame hidden.
    exemptFilterHosts();
    if (!applyIsland()) return false;
    // The flag gates rules that hide by ELIMINATION, so it goes on LAST, after
    // the rows exist, and comes straight back off if anything here throws.
    // Setting it first meant one exception between here and the first scan()
    // left the allowlist on with nothing built — a blank page, not stock.
    try {
      unlockScroll();
      dropLightTheme();
      buildFilterPanel();
      watchIsland();
      watchList();
    } catch {
      delete document.documentElement.dataset.nixLeolistListingsOnly;
      return false;
    }
    if (document.documentElement.dataset.nixLeolistListingsOnly === undefined) {
      document.documentElement.dataset.nixLeolistListingsOnly = '';
    }
    return true;
  };

  if (arm()) return;

  // Two arming observers, because arm()'s two gates can be satisfied at
  // different moments:
  //
  //   obs      documentElement, childList — #main_list ARRIVING, which happens
  //            when <body> is appended. Cheap: only a direct child of <html>
  //            added or removed fires it.
  //   listObs  #main_list, childList — CARDS arriving into a list that was
  //            already there and empty. The listing gate would otherwise turn
  //            "empty at DOMContentLoaded" into "stock forever", and the site
  //            refills this list in place: its own filter controls swap the
  //            children out behind #preloader without touching <html>, so
  //            neither obs nor DOMContentLoaded would fire again.
  //
  // Measured 2026-09-14: on a populated category the cards are in the server
  // response (11 .lst-item in the raw HTML for /dating/m4c/central-ontario,
  // 10 for /community/activities/central-ontario), so DOMContentLoaded is
  // where arming normally lands and listObs never has to fire. It is the late
  // path, not the main one — and it is attached only where a list already
  // exists, so a detail page and the homepage still observe nothing but <html>.
  let listObs = null;
  const tryArm = () => {
    if (arm()) {
      // Disconnect when arming SUCCEEDS. This read `if (!arm())`, which threw
      // away the only remaining arming path on exactly the pages where the list
      // arrives after DOMContentLoaded.
      obs.disconnect();
      off(listObs);
      listObs = null;
      return;
    }
    if (listObs || bag.torn) return;
    const list = document.getElementById('main_list');
    if (!list) return;
    listObs = new MutationObserver(tryArm);
    // Registered so teardown() disconnects it like every other observer — a
    // re-injection must not leave the previous copy still watching for cards.
    bag.observers.push(listObs);
    listObs.observe(list, { childList: true });
  };
  const obs = new MutationObserver(tryArm);
  bag.observers.push(obs);
  // childList on documentElement only. subtree:true here meant every mutation
  // of the whole document ran this callback for the life of a page that never
  // arms — an ad detail page parses thousands of nodes past it.
  obs.observe(document.documentElement, { childList: true });
  document.addEventListener('DOMContentLoaded', tryArm, {
    once: true,
    signal: bag.ctrl.signal,
  });
})();
