---
name: "The home-screen icon reads crisp under iOS 26's glass"
number: 67
group: gated
status: PR 1 shipped v2.4227 (exact-size renders, black ink, fatter wrench) · waiting on the owner's home-screen photo to decide item 3
summary: >
  On an iOS 26 home screen the ClickTooling tile looks rough: the gear's dark ink goes muddy grey
  and its edges soften, while the Add to Home Screen sheet shows the same file crisp. The served
  file is right (v2.4158's centred 1024 px PNG, byte-identical to main's). iOS 26 composites its
  Liquid Glass material over every flat web-clip icon; native apps ship layered icons, so the
  glass sits above their art instead of on it. A web clip cannot opt out, so the fix is art that
  survives the glass: exact-size renders, heavier ink, and possibly a dark tile.
next: >
  After v2.4227 deploys: remove the icon from the phone, Add to Home Screen again, and photograph
  it next to a native icon (Reduce Transparency off). From that photo the owner decides item 3, the
  dark tile — PR 2 is a `TILE` option in the generator and the touch icons regenerated — or closes
  the card if the tile now reads crisp.
size: S
ver: v2.4227
blocker: The owner's photo of the v2.4227 tile, then the call on item 3.
opinion: your call — PR 1 shipped; the dark tile is a brand change and waits on a photo of PR 1's result.
mockup: not required — the proof is a photo of the home screen; the generator renders the candidate PNGs to compare
---

# The home-screen icon reads crisp under iOS 26's glass

## The ask

The owner, 2026-09-29, after v2.4158 went live, with a photo of the Add to Home Screen sheet
beside one of the home screen: "now the share icon looks good but the saved icon on the
dashboard still looks rough". Then: "I want this to look great", and to park the three options
here rather than build them that day.

## What is known

- **The file is right.** The page links `/apple-touch-icon.png`; the served file is the v2.4158
  render, byte-identical to main's, measured centred (margins 196 / 196 × 175 / 175 px on 1024).
  The manifest's only icon is `favicon.svg` (`purpose: any maskable`) — iOS uses the touch icon.
- **The phone is the difference.** The sheet shows the raw art; the home screen lays iOS 26's
  Liquid Glass over it. The Add Task icon beside it is native and layered, so it stays crisp.
- **Ten-second check on any iOS 26 phone:** Settings → Accessibility → Display & Text Size →
  Reduce Transparency. If the tile snaps crisp, it is the glass. Turn it back off after.
- **History:** v2.4095 pulled the mark in from the bottom band; its inset formula was wrong and
  v2.4158 fixed it (the gear is drawn around (320, 320) in a 640 space, not the tile's 512 box).

## The three items

1. **Exact-size renders.** iOS now downsamples the 1024 px file about 5.7× itself. Render
   180 (iPhone @3x), 167 (iPad Pro), 152 (iPad) and 120 (iPhone @2x) from the SVG with the same
   Chromium, and link each: `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180.png">`.
   Keep `/apple-touch-icon.png` (1024) as the unsized fallback — the help share-card shell, the
   web-push icon in `sw.ts` and the manifest point at that name.
2. **Heavier art for the touch icon only.** Pure black ink (`#000`) instead of `#161617`, and a
   fatter wrench cutout (scale the wrench group up a little, or stroke it in the tile yellow), so
   the glass has less thin detail to smear. The favicon and the CountTooling / Takeoff Tooling
   marks keep their art; the generator already rewrites the SVG before rendering, so this is two
   more string replacements guarded like `SVG_MARK_TRANSFORM`.
3. **A dark tile — owner's call.** Native icons that wear the glass best are dark with light art:
   a near-black tile with the yellow gear would read crisp, but it breaks the yellow tile the
   ClickTooling / CountTooling / Takeoff Tooling family shares. Decide from a photo of PR 1.

## The plan

- **PR 1** (items 1 + 2) — shipped v2.4227: `scripts/generate-app-icon.mjs` (the sizes loop, the ink
  and wrench rewrites), `public/apple-touch-icon*.png` (five files), `index.html` (the sized links).
  Every render measured centred with the bottom teeth ≈17% out and the ink at 0.
- **PR 2** (item 3, only if the owner picks it): a `TILE` option in the generator, the touch
  icons regenerated; nothing else changes.

## How to verify

- Decode each PNG and measure (pure Python — zlib plus the PNG unfilter; no PIL on this Mac): the
  ink box centred at size/2 on both axes, the four margins equal in pairs, the bottom teeth
  ≥ 17% from the edge. See memory note *App icon: measure, don't compute*.
- `curl` the live page's `<link rel="apple-touch-icon">` tags and each file after the deploy.
- The phone keeps the old bitmap: remove the icon, Add to Home Screen again, photograph it next
  to a native icon, with Reduce Transparency off.
