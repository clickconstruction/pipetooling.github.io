# Substrate extractor — the two-pass recipe

---
file: docs/twins/EXTRACTOR.md
type: Harness procedure / Skill
purpose: How an agent harness turns a plan-set PDF into a SUBSTRATE.md-conformant substrate — the exact two-pass procedure, tooling, parameters, and coordinate math proven on the LIVSTE set (2026-08-28/29). Wave 1.2 of ESTIMATOR_TWIN_PIPELINE_PLAN.md. The vision model IS the extractor; this file is its operating manual.
audience: AI Agents, harness operators, Developers
last_updated: 2026-08-30
key_sections:
  - Tooling
  - "Pass 1: structure"
  - "Pass 2: crops"
  - Coordinate math
  - Output & attach
  - Quality rules
---

## Tooling

Two shell primitives in `scripts/substrate-extractor/` (poppler + sips; both proven):

- `overview.sh <pdf> <page> <out.png> [dpi=40]` — low-DPI rotated overview for locating
  regions. 40 DPI is enough to see table/note-block layout, never to read cells.
- `extract-crop.sh <pdf> <page> <x> <y> <w> <h> <out.png> [dpi=600]` — the crop pass:
  renders ONLY the region (pdftoppm `-x -y -W -H`, pixels at the render DPI, RAW
  pre-rotation page coords), rotates 90° CW for reading.
- `sweep.sh <pdf> <outdir> [dpi=40] [first] [last]` (Wave 1.2 automation) — overview
  EVERY page in one call + `manifest.txt`; Pass 1 starts from a complete contact set.
- `tiles.sh <pdf> <page> <x> <y> <w> <h> <cols> <rows> <outdir> [dpi=300] [overlap=60]`
  — tile a region into a grid of readable crops in one call + `tiles.txt` (raw rects
  for the coordinate kernel). The walk-the-drawing primitive for schedules AND the
  placement engine's plan sheets (docs/twins/PLACEMENT.md).

Check the set first: `pdffonts` empty + `pdfimages -list` showing only logos = **pure
vector** (CAD plot, text as outlines) — DPI wins completely and 600 DPI crops read
perfectly. A raster scan caps at its scan resolution; note that in the substrate's
generator field and expect `illegible` facts.

## Pass 1: structure

1. `pdfinfo` — page size and count. **Letter-size pages of E-sheets are the norm** (LIVSTE:
   612×792pt): everything is ~4× reduced, which is why page-level reads fail and why the
   stated drawing scale is INVALID for measurement (see SUBSTRATE.md design note 7).
2. Overview every page at 40 DPI. From title blocks alone (readable even at 40 DPI):
   sheet number, title, discipline → the full sheet inventory + classification.
3. On in-trade sheets, locate regions to crop: schedules, note blocks, legends, the
   drawing-title/scale strip, riser diagrams. Record each as an overview bbox.
4. Reconcile the set's self-indexes (cover drawing list vs the trade's own sheet index) —
   a sheet in one but not the other is a flagged question.

## Pass 2: crops

For each located region: scale the overview bbox ×(600/40)=15 to crop coords, render, read,
transcribe into the schema with confidence + the crop coords as provenance. Tiling rule:
keep tiles ≤ ~1500px on the long side after rotation so nothing is downscaled at read
time; split along the table's ROW direction (pre-rotation x for 90°-CCW sheets — verified:
tile bands at `-x <band> -W 800 -H 1455` walk the fixture schedule top to bottom).

## Coordinate math (90°-CCW-drawn sheets, the common case)

Overview (rotated CW for reading, H_raw = page height at overview DPI):
`x_raw = Y_readable · (crop_dpi/overview_dpi)`, `y_raw = (H_raw − X_readable) · (crop_dpi/overview_dpi)`.
Expect your first bbox to miss — render, read, adjust; the misses cost seconds. Record the
FINAL coords in the substrate's crop provenance, never the guesses.

## Output & attach

Build the JSON per `docs/twins/SUBSTRATE.md` (fact envelopes, schedules-as-tables,
reconciliation, rollup ending in the recommendation-only scope & risk read). Attach: insert
into `bids_plan_substrates` (bid_id, version, substrate) — immutable; a re-extract is the
next version with `supersedes`. Stamp the bid's note ledger (`[pipeline STG-2] …`) with the
headline numbers. Agents then read it via twin-mcp `get_plan_brief`.

## Quality rules

- **No naked facts** — every value carries confidence; `illegible` + `needs_crop` beats a
  guess, always. The Wave-1 gate counts exactly these.
- **Schedules may lack quantity columns** (LIVSTE does): `qty_scheduled: null` is normal;
  reconciliation (plan symbols vs riser) is then the only quantity source.
- **Scale calibration is mandatory on reduced prints** — find a dimension string + its
  endpoints; never trust the stated scale on a letter-size print.
- Machine-set text (COMcheck-style typed pages) reads at page resolution — split your DPI
  budget accordingly.
- The worked example: LIVSTE substrate v0.4 (15-tag fixture schedule from 6 tiles, P001
  notes, scales, two born RFI candidates) — its crop coords are in the substrate itself.
