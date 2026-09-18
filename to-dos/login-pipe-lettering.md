---
name: "Sign-in page: ClickPlumbing.com in pipe letters"
group: ready
status: PICKED 2026-09-18 — the round-3 title with the thicker wheels ("let's just do this old title") · ready to build
summary: >
  The sign-in title as **letters made of white pipe**: flat white, square-cornered runs, a plain
  white **flange** across every open tip, a **thick red handwheel** on each i and on the period
  as the only color, the title's existing soft shadow. The k, g and o are the round-3 shapes.
  Ships as a `PipeWordmark` SVG component inside the title link, the text kept for screen readers.
next: Build it — one PR, size S. The mock-up page is the spec.
size: S
blocker: none
ver: picked 09-18
mockup: has
opinion: build — picked; the component is small and the mock-up page carries the exact geometry.
---

# Sign-in page: ClickPlumbing.com in pipe letters

## The ask, in the owner's words

> On this page, I think it would be really cool if we made clickplumbing dot com have letters that look like pipes. Would you be able to help me mock up some solutions for this text?

(2026-09-18, on `/signin`.)

## The pick

**2026-09-18, the owner, on the round-3 frame with the fuller wheels:** *"let's just do this old title."*

[`login-pipe-lettering-before-after.html`](./login-pipe-lettering-before-after.html) is now that design and nothing else: flat white blocky pipe, square corners (`stroke-linejoin: round` on a 16-unit stroke over a 100-unit cap height), a plain white flange (1.9× the pipe across, 0.45× thick) across every open tip — never where a run meets another run — a short valve stem and a thick red handwheel (ring 0.42× the stroke, four spokes, a hub) on each i and on the period, and the title's existing soft shadow. The page holds the header as shipped, the pick at size, the twelve glyphs, and the word at 360 px. The glyph table and the renderer in the page are the geometry to port.

## How it got here

Six rounds on 2026-09-18. Round 1: five treatments (copper tube, white PVC, copper with brass fittings, "Click" only, CSS copper) — *"red wheels over the i's, blocky letters, all white, tips end in a flange."* Round 2: shaded white pipe, bolted flanges, four knobs — *"just white, much simpler."* **Round 3: flat white, square corners, plain flanges, red wheels — the pick, with its fuller-wheel variant.** Rounds 4–6 tried curved k, g and o (bends, rings, a branching k, pipes laid over one another) — *"I do not like what you have proposed, let's just do this old title."*

## Where it plugs in

| Exists | Change |
|---|---|
| [`AuthPublicLandingLayout.tsx`](../src/components/AuthPublicLandingLayout.tsx) — the h1 link `titleLinkText` | render a `PipeWordmark` inside the link; the word stays as the accessible name and the link stays the whole word |
| [`authPublicLanding.css`](../src/components/authPublicLanding.css) — Playfair 2.5 rem → 2 rem → 1.6 rem at 768 / 480; `text-shadow: 0 2px 16px rgba(0,0,0,.45)` | the SVG scales to the same widths (540 → 420 → 300 px) and wears the same shadow as a `drop-shadow` filter |
| — | `src/lib/pipeWordmark.ts`: the twelve-glyph alphabet (C l i c k P u m b n g o .), the free-tip finder, flange and wheel geometry, `renderPipeWord(word)` as a pure kernel with tests; `src/components/PipeWordmark.tsx` presentational, one fill color (`currentColor`) plus the red accent |

Every new word needs its glyphs; the alphabet covers `ClickPlumbing.com` only.

## How to verify

`/signin` after the build: the title reads "ClickPlumbing.com" to a screen reader, links to clickplumbing.com, and at 360 px the word fits above the three tiles with the wheels still readable. The mock-up at `/to-dos/login-pipe-lettering-before-after.html` is the reference.
