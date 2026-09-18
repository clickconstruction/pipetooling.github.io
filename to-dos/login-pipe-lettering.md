---
name: "Sign-in page: ClickPlumbing.com in pipe letters"
group: gated
status: round 5 drawn 2026-09-18 — the round-3 blocky white pipe, with curves only on the k, g and o · white flanges · red wheels on the i's · waiting on the owner's yes
summary: >
  The sign-in title drawn as **letters made of white pipe**: square-cornered runs (the round-3
  look the owner preferred), with only three glyphs curved — the **o** a ring, the **g** a ring
  with a curved tail, the **k** a stem whose branch curves up and down instead of overlapping
  blocks; every open tip a plain white **flange**; a **red handwheel** on each i and on the
  period as the only color; the title's existing soft shadow. Round 5 shows the design at size,
  the glyphs, one question (the b's bowl square or ring), and a 360 px frame.
next: Say yes (and square or ring for the b); then it ships as a `PipeWordmark` SVG component inside the title link, text kept for screen readers.
size: S
blocker: Owner's yes.
ver: mock-up round 5 · 09-18
opinion: build — five rounds converged; the component is small and every knob that was turned is a prop or a glyph entry.
---

# Sign-in page: ClickPlumbing.com in pipe letters

## The ask, in the owner's words

> On this page, I think it would be really cool if we made clickplumbing dot com have letters that look like pipes. Would you be able to help me mock up some solutions for this text?

(2026-09-18, on `/signin`.)

**Round 1** — five treatments (copper tube, white PVC, copper with brass fittings, "Click" only, CSS copper). The owner: *"I like the idea of the circles over the i's being the red wheels. I also like the idea of blocky letters, but I think those blocky letters should all be white, and it should be the tips that end in a flange."*

**Round 2** — shaded white pipe, bolted flanges, a dark edge, four knobs. The owner: *"the flanges and the letters can just be white. I think that we can make it much more simpler."*

**Round 3** — flat white, square corners, plain flanges, red wheels. The owner: *"I need the k to have a smoother corner and the g and o to as well. It is okay for a pipe to run in a circle or branch off."*

**Round 4** — every corner bent, rings for o, g and b, a branching k. The owner, pointing at round 3: *"I prefer this look from before. I just think that the k and the g and the o should all have curved edges instead of those overlapping blocks."*

## The mock-up — round 5

[`login-pipe-lettering-before-after.html`](./login-pipe-lettering-before-after.html) — the header as shipped, then the design at size: the round-3 square-cornered white pipe for every letter, and only three glyphs curved — the **o** a ring; the **g** a ring with its tail dropping off the right side into a curved hook; the **k** a stem with one branch that splits, an arm curving up and a leg curving down. A plain white flange across every open tip — never where a run meets another run or a ring; a short valve stem and a **red wheel** on each i and on the period; the title's existing soft shadow and nothing else. Then the twelve glyphs on a plain ground, one question (the **b**'s bowl square as in round 3, or a ring to match the o and g), and the word at 360 px.

## Where it plugs in

| Exists | Change |
|---|---|
| [`AuthPublicLandingLayout.tsx`](../src/components/AuthPublicLandingLayout.tsx) — the h1 link `titleLinkText` | render a `PipeWordmark` inside the link; the word stays as the accessible name and the link stays the whole word |
| [`authPublicLanding.css`](../src/components/authPublicLanding.css) — Playfair 2.5 rem → 2 rem → 1.6 rem at 768 / 480; `text-shadow: 0 2px 16px rgba(0,0,0,.45)` | the SVG scales to the same widths (540 → 420 → 300 px) and wears the same shadow as a `drop-shadow` filter |
| — | `src/lib/pipeWordmark.ts`: the twelve-glyph alphabet (square runs; `bend` and `rings` per glyph), the free-tip finder, flange and wheel geometry, `renderPipeWord(word)` as a pure kernel with tests; `src/components/PipeWordmark.tsx` presentational, one fill color (`currentColor`) plus the red accent |

The same component can carry the word on the customer portal header and the printed cover letter later. Every new word needs its glyphs; the alphabet covers `ClickPlumbing.com` only.

## How to verify

Open `/to-dos/login-pipe-lettering-before-after.html` on the dev server (the photo is served from `/auth/`), or `/signin` after the build: the title reads "ClickPlumbing.com" to a screen reader, links to clickplumbing.com, and at 360 px the word fits above the three tiles with the wheels still readable.
