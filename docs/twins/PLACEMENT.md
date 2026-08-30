# Placement engine v0 — counters-first takeoff placement

---
file: docs/twins/PLACEMENT.md
type: Harness procedure / Skill
purpose: How an agent turns a substrate + plan-set PDF into a placed, imported CountTooling takeoff — the counters-first procedure, coordinate math, self-checks, and tooling. Wave 3.4 of ESTIMATOR_TWIN_PIPELINE_PLAN.md. The vision model IS the engine; this file is its operating manual (EXTRACTOR.md's sibling).
audience: AI Agents, harness operators, Developers
last_updated: 2026-08-30
key_sections:
  - Tooling
  - The counters-first procedure
  - Coordinate math
  - Self-checks (counters prove out)
  - Import & review
---

Counters proved out on LIVSTE (M4, 2026-08-30); this manual now carries both legs:
counters first, then line runs — which add exactly two requirements counters never had:
a **per-page scale** and a **line-type roster from the legend**.

## Scale: doorways are the ruler (owner rule, 2026-08-30)

The stated scale on a reduced print is a lie, and the true scale **can change from page
to page** — never carry one page's calibration to another. The field-proven standard:
**door openings are always 3 feet.** Every plan sheet has several, which makes the
calibration self-verifying:

1. On each sheet you will trace, crop 2–4 doorways (the gap in the wall line at a door
   swing arc), and measure each opening jamb-to-jamb in RAW px.
2. Feed them to the kernel — `calibrateFromDoors(doors, dpi)` (or `doorSamples` in the
   assembler manifest): the median wins, and any sample >10% off is flagged (you
   mis-measured, or it's a double/oversized door — remeasure or drop it, never average
   it in).
3. Cross-check once per set against a dimension string or the known building SF when
   available; record both in your import note.
4. A page with polylines and no scale is REJECTED by the local validator (and the feet
   would be meaningless) — calibrate before tracing, every page.

## Tooling

- `scripts/substrate-extractor/overview.sh <pdf> <page> <out.png> [dpi=40]` — locate.
- `scripts/substrate-extractor/extract-crop.sh <pdf> <page> <x> <y> <w> <h> <out.png> [dpi=600]`
  — read (RAW pre-rotation px at the render DPI; output rotated 90° CW for reading).
- `scripts/placement-engine/pagesize.sh <pdf> <page> [dpi]` — page pt/px dims + the px→pt divisor.
- `scripts/placement-engine/assemble.ts` (vite-node) — placements manifest → validated
  takeoff.json + the counts-vs-schedule self-check. The kernel
  (`src/lib/takeoffPlacement.ts`, unit-tested) owns every coordinate conversion — never
  hand-convert.
- Scoring: CT repo `takeoff-eval.js` (`diffTakeoffs`) against a human reference.

## The counters-first procedure

1. **Read the substrate first** (`get_plan_brief`): the fixture schedule is your counter
   roster (one CT counter per tag, names verbatim: WC-1, LAV-1, …) and the sheet
   inventory names the plumbing PLAN sheets (floor plans — not schedules, notes, risers).
   No substrate → stop; extraction (EXTRACTOR.md) comes first.
2. **Per plan sheet**: overview at 40 DPI → identify the drawing area and its wings;
   walk it in crop tiles at 300 DPI (fixture tags are large; 600 DPI only where tags
   crowd). Keep tiles ≤ ~1500 px on the long side after rotation.
3. **In each tile**: find every fixture TAG (the schedule's designators, usually in a
   hexagon/circle callout by the fixture symbol). Aim the mark at the FIXTURE SYMBOL the
   tag points to, not the callout bubble. Record readable-frame coords + the tile's crop
   rect into your placements manifest via the kernel's `readablePtToRawPx` — or record
   raw px directly if you computed them.
4. **A tag you can't resolve** (ambiguous leader, symbol under a wing break, tag not in
   the schedule): place nothing, add a `notes` entry at the spot prefixed `RFI:` — it
   rides the RFI-flags convention into PipeTooling. Never guess.
5. **Scale per sheet**: carry the substrate's calibrated `pixelsPerUnit` (px per FOOT in
   the base frame) when it has one; leave `scale: null` otherwise — an unscaled
   counters-only import is valid (lines are what need scale).
6. **Assemble**: `npx vite-node scripts/placement-engine/assemble.ts -- manifest.json out.json`
   — fix every REJECTED line (they use import-takeoff's own field names) and every ✗ in
   the counts-vs-schedule report before importing.

## Coordinate math

CT's base frame is PDF points at scale 1, rotation 0 (`TAKEOFF_IMPORT.md`): `pt = px_raw × 72 / dpi`.
The kernel does this (`rawPxToBasePt`) plus the two frame hops you actually face:
readable-crop → raw (`readablePtToRawPx`: `x_raw = cropX + y_readable`,
`y_raw = cropY + (cropH − x_readable)`) and overview-bbox → crop rect
(`overviewBoxToRawRect`, EXTRACTOR.md's ×15 math generalized). Trust the kernel; a
hand-derived coordinate is a bug you'll find only at review.

## Self-checks (counters prove out)

- **Counts vs schedule** (`countsVsSchedule`, printed by the assembler): every scheduled
  tag placed the scheduled number of times; qty-less schedules check presence.
  Reconciliation rows in the substrate (plan vs riser counts) are the tie-breaker.
- **Local validation** mirrors import-takeoff exactly — a clean assemble never 400s.
- **Visual spot-check**: re-crop 2–3 placed points (±60 px window at 300 DPI) and confirm
  the mark sits on the symbol. Cheap, catches frame mistakes wholesale.

## Lines v1: tracing the runs

The roster comes from the plans, mirroring counters-from-the-schedule: the P001 legend
maps line styles to systems, and the hexagon tags you IGNORED for counters (P26, W1, …)
are the line identity system. v1 scope: **per-system polylines** (Cold Water, Hot Water,
Sanitary, Vent, Gas — sizes ride the hex tags later); sanitary traced from the
underground plan (P200), water from the piping plan (P201); vent reconciled against the
riser rather than traced.

1. Calibrate the page first (doorways, above) — the validator refuses unscaled lines.
2. Trace topology at medium DPI (150–200) full-width bands — runs cross tile borders, so
   trace a whole run before moving on; refine vertex positions in 300 DPI crops only
   where junctions crowd. Record vertices in RAW px, in drawing order, one manifest
   `lines` entry per continuous run.
3. Junctions: end a polyline where the system tees; start the branch as its own run.
   Crossing lines that don't connect (different systems) are NOT junctions.
4. Self-checks (the assembler prints all three):
   - **feet by line type** — sane against CALIBRATION.md's bands and the building SF;
   - **connectivity** — every placed fixture within ~6 ft of a matching run
     (`marksFarFromLines`); a flagged fixture means a missed run or a wrong trace;
   - door-calibration outliers — resolved, not averaged away.
5. A run you can't follow (buried under a wing break, ambiguous continuation): trace what
   you can and drop an `RFI:` note at the break — same never-guess rule as counters.

## Registration: the trace must sit ON the drawing (owner gate, 2026-08-30)

A trace that floats off the linework gives approximately-right feet and misplaced
fittings — and it LOOKS fine until overlaid. Three tools close the loop (all in
`scripts/placement-engine/`, run against the plan PDF):

1. **`registration.ts <manifest> <pdf> [minPct]`** — renders each traced page to
   grayscale and scores every run's samples against the ink (±3 px window). A run under
   the threshold fails loudly with its worst floating gap located in RAW px. Gate every
   import on this. Dash-broken styles (waste "—W—", dash-dot water) cap below 100% by
   construction — 75–85% is honest for them; solid runs should score 95+.
2. **`snap.ts <manifest> <pdf> [radius]`** — pulls every vertex onto the nearest ink.
   Fixes endpoint sloppiness only; a mid-segment gap means the PATH is wrong.
3. **`density.ts <pdf> <page0> <dpi> <h|v> <perpFrom> <perpTo> <alongFrom> <alongTo>`**
   — the dash-aware line finder: integrates ink ALONG the candidate run direction, so a
   dashed line shows as a fill band at its exact coordinate (solid ≈90%+, dash-dot
   25–70%, noise ≈0–5%) while single-row scanlines land in gaps and miss it entirely.
   Use it FIRST to locate every system's true position and duty cycle; the duty sets
   that run's registration bar (`minPct` per line in the manifest — solid 75+,
   dash-broken 25–40).
4. **`follow.ts <pdf> <page0> <dpi> <x> <y> <h±|v±>`** — walks the ink itself from an
   anchor, emitting the actual path with its jogs. Use scanline probes (dark-pixel rows/
   columns from the same PGM) to find each system's true position first — **walls render
   as linework too**: a run that follows a wall scores well and is still wrong, so
   confirm the system identity from labels/legend before keeping a followed path.
5. Import only after: registration clean at your threshold, counts-vs-schedule clean,
   connectivity clean or explained. What you could not trace to the gate's standard is
   an on-sheet `RFI:` note and an honest exclusion — never a straight line through rooms.

## Fittings: the joints fall out of the geometry (owner ask, 2026-08-30)

You never place fittings — they are DERIVED from your traced runs by the kernel
(`deriveFittings`, printed by the assembler on every run): an interior vertex that turns
≈90° is a **90 Ell**, ≈45° a **45 Ell**; a run endpoint landing on another same-system
run's body at ≈90° is a **Tee**, at ≈45° a **Wye**; axial end-to-end joins are couplings
(not counted); anything outside ±20° of 90/45 is flagged **odd** — name it or fix the
trace, never let it vanish. `"materializeFittings": true` in the manifest bakes them in
as visible counters ("CW · Tee") so the reviewer sees every joint on the sheet. Trace
consequences: place your vertices AT the true corner (a lazy vertex mints a phantom odd
fitting), and end branches ON the main they tee from (the snap radius is ~2 ft). Sizes
and reducers ride the keyed-note hexes for now — a later pass.

## Import & review

One `import-takeoff` call with the takeoff.json + `pdf_url` (PipeTooling `plan-fetch?bid=…`,
`pdf_headers: {"X-Twin-Token": …}`) — plans land under your marks. Re-import (same name)
replaces; that is the fix loop. Then `set_project_review_status → 'ready'` and watch
`get_work_state.ct_takeoff` for `reviewed` or `changes` + note (get_ct_guide has the full
loop). Log the run: bid note with per-tag counts + heartbeats.
