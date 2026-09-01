# twin-census — T1 vector census toolkit

Quantity-discipline tooling for the estimator-twin program (see
`docs/twins/` and the Census Toolkit Plan artifact). Extracts exact
counts and positions from plan-set PDFs that have **no text layer**
(AutoCAD SHX output: every glyph, symbol, and dash is a bare line
segment), so the twin stops estimating quantities "by typology".

Requires `python3.11` with `pypdf` and `Pillow`; crops/renders use
Ghostscript (`gs`). Pure read-only analysis — nothing here touches the
database or the app.

## Scripts

- **`vector_census.py plans.pdf 31,32,33 out.json`** — the base kernel.
  Interprets each page's content stream (q/Q/cm CTM tracking, m/l/c/re
  paths, paint ops), splits linework from micro-strokes, union-finds
  micro-strokes into components (`GAP`), and hashes each component's
  normalized geometry so repeated shapes (words, symbols, room boxes)
  share an id. Output: per-page components + distinct-shape table with
  counts, sizes, and sample geometry.
- **`contact_sheet.py census.json out.png [--min-count N] [--min-strokes
  N] [--min-size PT] [--max-size PT] [--limit N] [--start N]`** — renders
  shapes onto a labeled grid for one-shot visual classification (this is
  how the shape table gets names: read one PNG instead of sweeping crops).
- **`hex_detect.py plans.pdf 31,32,33 out.json`** — merge-proof hexagon
  keynote detector (see its docstring for the geometry). Feed its
  positions into 600dpi crops to read the tags, then decode tag meanings
  from the sheet's KEYED NOTES legend.

## Validated

MPH LIVSTE (b419 shadow reference), 2026-08-31: 106/106 hexagons
detected dead-center, zero false positives; full keynote census of four
plumbing sheets including one (P401 roof gas) the human review subset
missed. Results: `example-livste-results.json`.

## Gotchas learned on LIVSTE

- "Image stamps" in a set like this are usually title-block furniture
  drawn identically on every sheet — the drawing content is vector.
- Exact-shape hashing can't count callout symbols: they merge with
  leader lines and inner text into unique clusters. Detect symbols by
  geometric signature instead; hash-census works for repeated words,
  room-number boxes, and standalone glyphs.
- Stacked callout pairs touch tip-to-tip; the shared point hosts four
  diagonals. Direction-validate corners (both edge bodies on the same
  side) or you mint phantom mid-pair detections.
- A hexagon's individual tip edges are more horizontal than vertical —
  classify tip direction from the *average* of the two edge vectors.
- Chairs and table symbols are the false-positive reservoir (45-degree
  diagonals); the slope-ratio window rejects them.

## T2 — path_census.py (footage)

`path_census.py inventory plans.pdf 84` buckets every stroke by CAD pen
(gray, width); `path_census.py chains plans.pdf 84 0.0 2.33 9 5` chains
one pen's strokes into runs and reports per-run footage with symbol /
margin / border chains filtered out. Decide pen→system once per set by
painting a bucket over a 72dpi render (1px = 1pt) and looking.

Scale: calibrate pt-per-ft from grid-label spacing vs the stated bay
size (TSAOG: 270pt bays = 30'-0" -> 9 pt/ft on full-size 30x42 at 1/8").

Validated mechanics on TSAOG (four pens decoded: sanitary, CW, fire,
storm/RD; runs match the drawing on overlay). The 0.85-1.1
reference-ratio gate is pending a scope-matched reference — the TSAOG
attempt instead surfaced that the fetched set was core/shell while the
reference takeoff priced the tenant fit-out (BT-15 reclassified).
**Protocol rule that fall-out bought: at unseal, line-compare the
reference takeoff's tags against the fetched set — a reference fixture
absent from the set means scope mismatch, stop scoring.**

## T4 — scorecard.ts (auto-scorecard)

`npx vite-node scripts/twin-census/scorecard.ts -- ref-rows.json
twin-items.json [set-tags.json]` — the unseal line-compare, mechanized.
Kernel: `src/lib/twinScorecard.ts` (unit-tested). Emits the JSON scorecard
(per-tag count deltas, fixture accuracy, per-system footage ratios) plus a
stderr summary; exits 2 on a scope-match FAIL — that run must not be
scored, flag the reference instead (PLACEMENT.md "Reference protocol at
unseal").

## T3 — template_match.py (Class C raster counting)

Pure-numpy FFT normalized cross-correlation for full-raster scan sets
where nothing is parseable. Harvest a template from ONE confirmed symbol
instance, then match the whole sheet:

    template_match.py harvest page.png <cx> <cy> <half> template.png
    template_match.py match page.png template.png 0.55 out
    # -> peaks + circled verification image; raise the threshold to the
    #    gap between real hits and lookalikes, verify visually, count.

Validated on Proud Mary K105 (the BT-14 count-miss sheet): 9/9 "FS"
floor-sink callouts found in 5.6s with clean threshold separation (real
0.73-0.94 vs lookalike bubbles K30/K38A at <=0.70) — the twin's blind
run had found 6. Corollary that closed the rest of BT-14's miss: trap
primers are DERIVED, not hunted — TP per trap (9 FS + 1 FD = 10 TP).
Text inside a callout bubble is what separates it from same-shape
bubbles; template symbols WITH their text, not bare shapes.
