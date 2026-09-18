---
name: "Sign-in page: ClickPlumbing.com in pipe letters"
group: gated
status: mock-up drawn 2026-09-18 · five treatments over the real header · waiting on the owner's pick
summary: >
  The sign-in title drawn as **letters made of pipe**: one shared pipe alphabet (straight runs,
  90° elbows, shadow · tube · highlight strokes) in copper (A), white PVC with purple-primer
  joints (B), copper with brass fittings and red handwheels (C), "Click" only (D), and a CSS-only
  copper-plated Playfair (E). Same photo, tiles and card in every frame; a 360 px row.
next: Pick A–E (or none). A ships as a `PipeWordmark` SVG component inside the title link, text kept for screen readers.
size: S (A/B) · S+ (C) · XS (D/E)
blocker: Owner's pick.
ver: mock-up 09-18
opinion: build — A is a small component and the page is the first thing every crew member and customer sees; copper says plumber to anyone.
---

# Sign-in page: ClickPlumbing.com in pipe letters

## The ask, in the owner's words

> On this page, I think it would be really cool if we made clickplumbing dot com have letters that look like pipes. Would you be able to help me mock up some solutions for this text?

(2026-09-18, on `/signin`.)

## The mock-up

[`login-pipe-lettering-before-after.html`](./login-pipe-lettering-before-after.html) — the header as shipped (Playfair Display, white, soft shadow), then five treatments in the same frame, a 360 px row for A–C, and a comparison table.

| | Treatment | Says "plumber" to | Build |
|---|---|---|---|
| A | Copper tube — gradient, specular line, drop shadow; valve caps for the i-dot and the period; water runs through it on hover | everyone | S — one SVG component + palette |
| B | White PVC, purple-primer band at every elbow | plumbers | S — palette on A |
| C | Copper with brass fittings at the elbows and red gate-valve handwheels | everyone, loudly | S+ |
| D | "Click" in pipe, "Plumbing.com" stays Playfair | everyone | XS on A |
| E | Copper-plated Playfair, CSS only | nobody in particular | XS |

**Recommendation:** A for the sign-in page, B kept as the palette for light surfaces; C if the flourish is wanted; D if it should ship this afternoon.

## Where it plugs in

| Exists | Change |
|---|---|
| [`AuthPublicLandingLayout.tsx`](../src/components/AuthPublicLandingLayout.tsx) — the h1 link `titleLinkText` | render a `PipeWordmark` inside the link; the word stays as the accessible name and the link stays the whole word |
| [`authPublicLanding.css`](../src/components/authPublicLanding.css) — Playfair 2.5 rem → 2 rem → 1.6 rem at 768 / 480 | the SVG scales to the same widths (520 → 420 → 300 px) |
| — | `src/lib/pipeWordmark.ts`: the twelve-glyph alphabet (C l i c k P u m b n g o .) + `renderPipeWord(word, palette)` as a pure kernel with tests; `src/components/PipeWordmark.tsx` presentational |

The same component can carry the word on the customer portal header and the printed cover letter later, palette by palette. Every new word needs its glyphs; the alphabet in the mock-up covers `ClickPlumbing.com` only.

## How to verify

Open `/to-dos/login-pipe-lettering-before-after.html` on the dev server (the photo is served from `/auth/`), or `/signin` after the build: the title reads "ClickPlumbing.com" to a screen reader, links to clickplumbing.com, and at 360 px the word fits above the three tiles.
