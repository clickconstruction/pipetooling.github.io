---
name: "The home-screen icon reads crisp under iOS 26's glass"
number: 67
summary: >
  On an iOS 26 home screen the ClickTooling tile looks rough: the gear's dark ink goes muddy grey
  and its edges soften, while the Add to Home Screen sheet shows the same file crisp. The served
  file is right (v2.4158's centred 1024 px PNG, byte-identical to main's). iOS 26 composites its
  Liquid Glass material over every flat web-clip icon; native apps ship layered icons, so the
  glass sits above their art instead of on it. A web clip cannot opt out, so the fix is art that
  survives the glass: exact-size renders, heavier ink, and possibly a dark tile.
size: S
ver: v2.4227 · 5097 · 5117
mockup: not required — the proof is a photo of the home screen; the generator renders the candidate PNGs to compare
group: close
status: PR 1 shipped v2.4227 (exact-size renders, black ink, fatter wrench) · the owner 2026-10-09: it still does not look great · PR 2 v2.5097, the candidate sheet — nine icons under drawn glass at to-dos/app-icon-glass-candidates.html (a .png beside it) · the owner picked B on 2026-10-09 (yellow tile, heavier ink) · PR 3 v2.5117 re-rendered the five touch icons as B and made it the generator's default; the heavier stroke's bottom teeth 2 px nearer the edge at 180 px (15.6% against v2.4095's 17%) accepted with the pick
next: After the deploy, remove the app from an iOS 26 home screen and add it again, then photograph it beside a native icon. If B reads crisp under the glass, retire this card; if not, the sheet's other letters are one `TILE=… MARK=…` run away.
blocker: None — the client deploy, then a re-added icon on a phone.
opinion: close it on the photo.
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
- **PR 2** (item 3) — shipped v2.5097: `TILE` (`yellow` · `dark` · `dark-white`) and `MARK`
  (`now` · `heavier` · `simpler`) in the generator, the default byte-identical to v2.4227's files,
  and `--sheet`, which renders the nine pairs at 180 px with the glass approximated into
  `to-dos/app-icon-glass-candidates.html` and `.png`. Candidate A is the live 180 px file. The
  heavier pairs (B, E, H) put the bottom teeth 2 px nearer the edge at 180 (15.6% against 16.7%).
- **PR 3** (the owner's letter): the touch icons regenerated with that letter's `TILE` and `MARK`;
  nothing else changes.

## How to verify

- Decode each PNG and measure (pure Python — zlib plus the PNG unfilter; no PIL on this Mac): the
  ink box centred at size/2 on both axes, the four margins equal in pairs, the bottom teeth
  ≥ 17% from the edge. See memory note *App icon: measure, don't compute*.
- `curl` the live page's `<link rel="apple-touch-icon">` tags and each file after the deploy.
- The phone keeps the old bitmap: remove the icon, Add to Home Screen again, photograph it next
  to a native icon, with Reduce Transparency off.
