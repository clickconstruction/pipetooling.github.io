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
