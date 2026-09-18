---
name: "Sign-in page: ClickPlumbing.com in pipe letters"
group: gated
status: round 3 drawn 2026-09-18 — flat white pipe, white flanges, red wheels on the i's, per the owner's notes on rounds 1 and 2 · waiting on the owner's pick
summary: >
  The sign-in title drawn as **letters made of white pipe**: one pipe alphabet (straight runs,
  90° elbows) in flat white, every open tip ending in a plain white **flange**, a **red
  handwheel** on each i and on the period as the only color; the same soft shadow the title
  wears today. Round 3 is one design with two small choices — wheel weight, flanges or none —
  and a 360 px frame.
next: Say yes (or pick thin/full wheels, flanges/none); then it ships as a `PipeWordmark` SVG component inside the title link, text kept for screen readers.
size: S
blocker: Owner's yes.
ver: mock-up round 3 · 09-18
opinion: build — flat white with one red accent is the simplest version that still reads as pipe, and it matches the page's existing white-on-photo title.
---

# Sign-in page: ClickPlumbing.com in pipe letters

## The ask, in the owner's words

> On this page, I think it would be really cool if we made clickplumbing dot com have letters that look like pipes. Would you be able to help me mock up some solutions for this text?

(2026-09-18, on `/signin`.)

**Round 1** showed five treatments (copper tube, white PVC, copper with brass fittings, "Click" only, CSS copper). The owner: *"I like the idea of the circles over the i's being the red wheels. I also like the idea of blocky letters, but I think those blocky letters should all be white, and it should be the tips that end in a flange."*

**Round 2** drew that with shaded white pipe, bolted flanges, a dark edge and four knobs. The owner: *"the flanges and the letters can just be white. I think that we can make it much more simpler."*

## The mock-up — round 3

[`login-pipe-lettering-before-after.html`](./login-pipe-lettering-before-after.html) — the header as shipped, then the design at size: **flat white** pipe, no gradients, no edges, no bolt heads; a plain white flange across every open tip (the top and bottom of every stem, the mouths of the C and c, the feet of the n and m — never where a run meets another run); a short valve stem and a **red wheel** on each i and on the period; the title's existing soft shadow and nothing else. Then the twelve glyphs on a plain ground, two small choices (thin or fuller wheels; flanges or none, for comparison), and the word at 360 px.

## Where it plugs in

| Exists | Change |
|---|---|
| [`AuthPublicLandingLayout.tsx`](../src/components/AuthPublicLandingLayout.tsx) — the h1 link `titleLinkText` | render a `PipeWordmark` inside the link; the word stays as the accessible name and the link stays the whole word |
| [`authPublicLanding.css`](../src/components/authPublicLanding.css) — Playfair 2.5 rem → 2 rem → 1.6 rem at 768 / 480; `text-shadow: 0 2px 16px rgba(0,0,0,.45)` | the SVG scales to the same widths (540 → 420 → 300 px) and wears the same shadow as a `drop-shadow` filter |
| — | `src/lib/pipeWordmark.ts`: the twelve-glyph alphabet (C l i c k P u m b n g o .), the free-tip finder, flange and wheel geometry, `renderPipeWord(word, { stroke, flanges, wheel })` as a pure kernel with tests; `src/components/PipeWordmark.tsx` presentational, one fill color (`currentColor`) plus the red accent |

The same component can carry the word on the customer portal header and the printed cover letter later. Every new word needs its glyphs; the alphabet covers `ClickPlumbing.com` only.

## How to verify

Open `/to-dos/login-pipe-lettering-before-after.html` on the dev server (the photo is served from `/auth/`), or `/signin` after the build: the title reads "ClickPlumbing.com" to a screen reader, links to clickplumbing.com, and at 360 px the word fits above the three tiles with the wheels still readable.
