## What it does

One script, five hosts: **pornhub.com, xnxx.com, xvideos.com, eporner.com, xhamster.com**.
It removes; it never adds.

**1. The gate** — decides per page, every page load:

```
┌──────────────────────────────────┐                        
│     any page on the 5 sites      │                        
└─────────────────┬────────────────┘                        
                  │                                         
                  ▼                                         
┌──────────────────────────────────┐                        
│multi-row hover grid + real pager?│                        
└─────────────────┬────────────────┘                        
                  │                                         
                  ├─────────────────────────────┐           
                  │                             │           
                 yes                           no           
                  │                             │           
                  ▼                             ▼           
┌──────────────────────────────────┐ ┌─────────────────────┐
│THE WALL: only cards + pager stay │ │untouched, 100% stock│
└──────────────────────────────────┘ └─────────────────────┘
```

**2. A qualifying gallery page** becomes:

```
┌─────────────────────────┐
│header: hidden, slides in│
│                         │
│  when pointer nears top │
└────────────┬────────────┘
             │             
             ▼             
┌─────────────────────────┐
│    cards edge to edge   │
│                         │
│ 1px gap, title on hover │
└────────────┬────────────┘
             │             
             ▼             
┌─────────────────────────┐
│          pager          │
└─────────────────────────┘
```

- **Kept:** video cards · pager · the site's own dark theme (used, or restored where the site drops it)
- **Hidden:** promos · sidebars · tag clouds · footers · sponsor rows · ad slots · HD/CC/duration badges on thumbnails

**3. The video page** each card links to becomes:

```
┌───────────────────────────────────────────────────────────┐
│                  player, centred, unmuted                 │
└─────────────────────────────┬─────────────────────────────┘
                              │                              
                              ▼                              
┌───────────────────────────────────────────────────────────┐
│title | channel | like | subscribe (the site's own buttons)│
└─────────────────────────────┬─────────────────────────────┘
                              │                              
                              ▼                              
┌───────────────────────────────────────────────────────────┐
│            related videos, laid out as the wall           │
└───────────────────────────────────────────────────────────┘
```

The row under the player is the site's **own** title, channel link, like/favourite and subscribe controls — untouched, so they work exactly as before. On xnxx/xvideos it is one line: title left, votes and actions right.

**Anything that doesn't pass the gate is left completely stock.** If a selector rots, the page renders stock — never mangled.

## What it does not do

- no infinite scroll, no filters, no watched-marking, no downloads
- no network calls, no storage, no settings panel, no `@require`, `@grant none`
- does not touch the video element or the player controls

## How it differs from what is already here

| already on Sleazy Fork | this script |
|---|---|
| PervertMonkey (xvideos / xhamster / eporner) — infinite scroll, filters, watched marks, shared 360 KB core | keep-list redesign of the gallery and video pages; no feed features; self-contained |
| PornEnhance (xvideos) — ad removal + layout | full-bleed wall + autohide header + video page reduction |
| Better xHamster / Xhamster Widescreen — bigger player | player **and** gallery **and** the row under the player, on five hosts |
| Eporner Auto Unmute | included, plus the wall |

Not a repost: nothing listed does the gallery gate + purge + autohide + video-page strip together, and nothing does it across these five hosts in one file.

## Known limits

- **pornhub** shows its age-consent modal on a first visit; the wall renders behind it and the player only loads a source once that modal is dismissed. That is the site's gate, not the script's.
- **xhamster** related rail is lazily hydrated (placeholder cards fill on scroll). On a very slow load the video page can come up stock until the rail hydrates; reload fixes it.
- **youporn** was dropped (2026-09): its player sits behind an age gate that only clears on a real click, so there is nothing to redesign.
- Built and verified on Chromium (Violentmonkey). Firefox should work (`:has()` is used, so Firefox ≥ 121) but is not measured.

## Privacy

Zero requests, zero storage. The whole script is CSS plus DOM marking; read it.

## Source

Source, changelog and issues: https://github.com/izzykatt/userscripts — one file, no build, MIT.
