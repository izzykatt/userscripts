---
description: Listing bodies are pasted into Sleazy Fork's form — write and render them accordingly.
paths:
  - "listings/**"
---

# Listing copy

`listings/<script>.md` is the **Additional info** body of that script's Sleazy
Fork listing, exactly as posted. It is a form body, not a document — which is
why `listings/.markdownlint.jsonc` turns off `MD041` (no H1) and `MD040` (bare
fences render as `<pre>`, which is what preserves the diagrams).

## What a listing must contain

Sleazy Fork requires a script to be **properly described**, and an undisclosed
behaviour is the most common reason a script is taken down. Say:

- what it does;
- what it deliberately does **not** do;
- how it differs from what is already on the shelf;
- its known limits.

Honest beats flattering. The description is part of the deliverable.

## Diagrams

Render with the flake, never by hand:

```bash
nix run .#diagram -- path/to/graph.mmd
```

It applies `-p 0 -x 1 -y 2` and **fails above 80 columns**. Paste the ASCII
output inside a bare fence. Never `-a/--ascii` — that downgrades the
box-drawing glyphs. `graph TD` is the default; `LR` only for 2–3 nodes.

## Posting

Paste the code, then **select Markdown** before pasting the body. The radio is
a custom control and a click that misses leaves HTML selected, which publishes
raw `##` and fences (measured 2026-09-14).
