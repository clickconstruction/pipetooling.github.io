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

Line runs come after counters prove out (locked default): a counters-only takeoff is
already a large human time-saver, and fixture placement is the higher-confidence vision
task. Everything below is counters; the takeoff.json contract already carries
quickLines/polylines for the day the engine grows them.

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

## Import & review

One `import-takeoff` call with the takeoff.json + `pdf_url` (PipeTooling `plan-fetch?bid=…`,
`pdf_headers: {"X-Twin-Token": …}`) — plans land under your marks. Re-import (same name)
replaces; that is the fix loop. Then `set_project_review_status → 'ready'` and watch
`get_work_state.ct_takeoff` for `reviewed` or `changes` + note (get_ct_guide has the full
loop). Log the run: bid note with per-tag counts + heartbeats.
