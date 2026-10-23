---
name: "Uncollectible stamp in dark mode — the word reads at 1.09:1 on its own panel; recolor the stamp for dark and leave light alone"
number: 145
group: close
status: shipped v2.5769 (#6034) 2026-10-23; delete the folder once the owner has seen the stamp live in dark
summary: >
  A Collections row the office gave up on wears a tilted red stamp: UNCOLLECTIBLE, the reason the
  office typed, the day and the dollars (punch list #94, v2.4792). The stamp was drawn for light —
  a pale pink panel, red stencil, red handwriting. In dark mode the pink panel blends to a mauve
  grey and the salmon text sits on it at 1.09:1 (the word) and 1.59:1 (the reason and the caption).
  Three options were mocked up; A recolors the same stamp for dark and changes nothing in light.
next: ship A — one PR, the stamp's styles move from inline to four classes with a dark override; before/after screenshots to the owner
size: S (one component, one stylesheet block, no kernel)
blocker: none
ver: v2.5769
opinion: build A — the mark the office already knows, every line of it 4.5:1 or better in dark, light pixel-identical.
---

# Uncollectible stamp in dark mode (#145)

## The ask

The owner, 2026-10-23, with a dark-mode screenshot of the Collections rows: "I do not like how
uncollectible looks on dark mode. Help me improve this and take screenshots and choose better
colors that are better contrasting, but still visually attractive."

## What is there

`src/components/jobs/StagesUncollectibleStamp.tsx` draws the stamp inline, one set of styles for
both themes: a 3px `#b91c1c` frame, `rgba(254, 226, 226, 0.6)` panel, the word in
`var(--text-red-700)` (Impact), the reason in `var(--text-red-900)` (Marker Felt), the day and the
dollars in `var(--text-red-800)`. The red text tokens lighten in dark (`#f87171`, `#fca5a5`), the
panel does not: 60% pink over the `#111827` row blends to `#9f9197`, and pale red on mauve grey is
what the owner saw.

## The options (`mockup.html`, light and dark side by side, contrast on every line)

| | Word on panel | Reason on panel | Day and dollars | Light theme |
|---|---|---|---|---|
| **Today** | light 5.75 · **dark 1.09** | light 8.91 · **dark 1.59** | light 7.39 · **dark 1.59** | as is |
| **A — same stamp, recolored for dark** | 5.75 · **6.03** | 8.91 · **13.39** | 7.39 · **7.36** | unchanged |
| **B — a quiet pill at the row's top-right, reason as a muted paragraph** | 6.47 · 9.35 (on the row) | 4.83 · 6.99 | in the pill | redrawn |
| **C — the stamp as the word, day and dollars; the reason in the row's note style** | as A | 10.31 · 9.96 (in the note) | as A | redrawn |

Dark A: panel `var(--bg-red-100)` (`#4c1d1d`), frame `#ef4444` (4.71:1 on the row), the word
`#ff8a65`, the reason in the row's own ink `var(--text-strong)`, the day and the dollars in
`var(--text-red-800)`. The handwriting face stays; only its ink changes. The reason's size goes
from 0.9rem to 1rem in both themes, the one change light sees.

## Is this the best we can do? Are we being straightforward?

- **A keeps the mark the office knows.** v2.4792's point was that you cannot read the row
  without reading why. B and C move the why out of the mark; B turns a stamp into a chip that
  looks like every other chip on the row.
- **A changes nothing in light.** The owner's complaint was dark only; light is the stamp he
  approved in v2.4792 and v2.4819. B and C redraw both.
- **Every dark line clears 4.5:1 on its panel**, the frame clears 3:1 on the row, and the
  numbers are on the mock-up, not asserted.
- **One stamp, two palettes.** The styles move from inline to four classes in `src/index.css` with
  a `:root[data-theme='dark']` override, so the next palette change is a stylesheet edit.
- **Straightforward:** the word is still the loudest thing on the row, the reason is still the
  second line, the dollars still read *given up on*. Nothing is softened.

**Pick: A.**

## Where it plugs in

- `src/components/jobs/StagesUncollectibleStamp.tsx` — the four elements take classes; the
  `data-stages-uncollectible-stamp` hook, `role="note"` and the aria-label stay.
- `src/index.css` — the stamp block next to `tr[data-stages-row-stamped]`.
- `src/components/jobs/JobsStagesTab.render.test.tsx` — *Uncollectible (punch list #94)* reads the
  stamp by role and text; it does not change.

## How to verify

`/dev-login?as=1&to=/jobs?tab=stages`, Collections, a stamped row (BP398's jobs, or any job the
office gave up on); the gear menu's theme toggle, or `resize_window` with `colorScheme`. Read the
word, the reason and the caption at arm's length in both themes.

## Where it stands

Built as v2.5769 on `claude/wonderful-colden-c4bc11`; delete this to-do when it merges (the release note and `docs/recent-features/v2.5769.md` carry the record).
