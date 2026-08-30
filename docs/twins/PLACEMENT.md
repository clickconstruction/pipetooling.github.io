# Placement engine v0 — counters-first takeoff placement

---
file: docs/twins/PLACEMENT.md
type: Harness procedure / Skill
purpose: How an agent turns a substrate + plan-set PDF into a placed, imported CountTooling takeoff — the counters-first procedure, coordinate math, self-checks, and tooling. Wave 3.4 of ESTIMATOR_TWIN_PIPELINE_PLAN.md. The vision model IS the engine; this file is its operating manual (EXTRACTOR.md's sibling) Served by twin-mcp as get_placement_guide (bundled with CALIBRATION.md + EXTRACTOR.md).
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
5. **Two x-families in one density window = two pipes, not one jogging pipe** (M6-v5):
   parallel runs (a main and its companion) sit a few px apart, and a greedy follower
   stitches between them, fabricating jogs and elbow pairs. When density shows two
   persistent perp-coordinates over the same span, draw two runs and let the tee at
   their real junction come out of the geometry. Watch the derived fitting counts
   across passes — they are the convergence metric (phantom fittings scream).
6. **Plumbing is Manhattan** (owner catch, 2026-08-30): architects draw runs that go
   straight, turn 90°, and continue — a tracer that connects jog-start to jog-end draws
   a diagonal shortcut through un-piped rooms and mints phantom 45° fittings from its
   own artifact. snap.ts orthogonalizes every run (the L-corner with more ink under it
   wins); registration REFUSES undeclared diagonal segments. A genuinely diagonal run
   (a true 45° tail) is declared `diagonalOk` on that line — deliberately, per run,
   never as a default.
7. Import only after: registration clean at your threshold, counts-vs-schedule clean,
   connectivity clean or explained. What you could not trace to the gate's standard is
   an on-sheet `RFI:` note and an honest exclusion — never a straight line through rooms.
8. **Mains are not a takeoff — sweep for the branches** (owner catch #4, 2026-08-30).
   A registered spine with clean gates can still be missing every lateral to the
   fixtures, and the connectivity check will NOT catch it when the fixture marks live
   on a different sheet than the runs (per-page check — cross-page blindness). After
   the mains register, run branch density sweeps perpendicular to each main/header
   (v-sweeps across horizontal runs, h-sweeps across vertical ones, both sides) and
   walk every hit to its fixture; crop-decode the diagonal wyes density can't see.
   On LIVSTE P200 this pass found 20 laterals the spine trace had skipped — dog-ward
   FD drops + collector, SS-8 drop, wet-table wyes, WC riser, lab verticals, west
   laterals — and SAN footage went 174.5 → 290.3 ft (+66%). The fitting mix is the
   tell: a traced system with almost no tees is a spine, not a takeoff (tees went
   3 → 20 when the branches landed).

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

## Keyed-note census: the hexes ARE the drops (owner refinement pass, 2026-08-30)

Plan hexagons are per-sheet keyed notes, and on plumbing sheets they are **sized
pipe drops/risers** — the sub-resolution stubs you cannot trace (trap arms,
riser turns, sub-2-ft leads) are exactly what the architect keyed instead of
drawing. Do not trace them; **count them**:

1. **Decode the sheet's own KEYED NOTES table FIRST.** Every P-series sheet
   carries its table in the same margin region (this set: raw300
   `(300,75,900,750)`, top-left, both P200 and P201). Crop the FULL region the
   substrate names — a half-height crop silently loses table rows (W32 was
   missing from the v0.5 substrate for exactly this reason). Decode every key
   before counting anything.
2. **One CT counter per key, on a `Drops` canvas** — name carries the decoded
   size (`P1 · 2"W dn + 2"V up`, `W23 · 1/2"CW dn`). The reviewer toggles the
   layer like any other; pricing reads sized-drop counts directly.
3. **Census by tiles**: 4 crops at 300 DPI over the plan zone, count every hex
   with its raw coordinate. Cross-check across sheets — the same fixture's
   waste key (P200) and water key (P201) land at the same plan position (staff
   WC-12: P2 @ (325,808) on P200, W32+P26 @ (312,807/791) on P201).
4. **The census is also a fixture audit**: a keyed pair with no fixture mark
   under it is a missed fixture (this pass surfaced a possible second L-6 in
   the staff row — recount before the eval diff).
5. **Schedule report reads ✗ for keyed counters — that is correct.** They are
   keyed notes, not scheduled fixtures; say so in the import note instead of
   forcing them into the schedule.

## Printed-total reconciliation: name every foot you didn't trace (gas, 2026-08-30)

A printed total (the gas sizing note's `140'-0"`) is a cross-check, not a
target to trace toward. Reconcile it as **on-plan traced + named allowances**,
each carried as an on-sheet note with `detail`:

- on-plan traced footage (here 23.8 ft, registration-gated);
- **vertical allowances** keyed on the sheet (G1 `2" gas up to roof` — count
  the hex, note the riser height as an allowance);
- **continuation symbols** (the break squiggle) = off-sheet scope; drop a
  scope-boundary note at the symbol (`gas continues offsite`, `4" waste
  continued at tenant`) so the exclusion is a written fact, not a silent gap;
- equipment loads printed at the terminus (WH-1 `199 CFH`) ride the note
  detail — they justify the pipe size at pricing time.

The reconciliation lives where the reviewer can see it: notes at the exact
symbols, arithmetic in the import note.

## The third dimension (backtest BT-1 doctrine, 2026-08-30)

Plan-view tracing captures the horizontal projection only. On BT-1 the human
reference carried 3.5× the twin's water feet and ~9× its fittings — almost all of
it vertical. The fix is not to draw what isn't drawn; it is **explicit vertical
allowances** in the manifest (`verticals: VerticalAllowance[]`):

- one entry per family of identical verticals (bay drops, wet-wall drops, waste
  stub-ups, VTR risers, trap-primer laterals, site continuations);
- every height NAMES ITS SOURCE — a mount height printed on the plan ("valve at
  10' AFF", "WH-1 24\" A.F.F."), a keyed note, or a doctrine default (2 ft
  slab stub; deck height assumed and flagged RFI when the architectural set
  wasn't read);
- each entry carries the fittings it implies (a drop = tee at the main + 90 at
  the turn-down; a stub-up = 90 + tee; a VTR = 90).
The assembler folds allowances into the size-split feet and fitting counts of
the **tooling paste block** (`<out>.tooling.txt` — the ESTIMATE view) and prints
them itemized. CountTooling stays the DRAWN view — allowances never appear as
lines there, because nothing on the sheet registers them.

## Size attribution (BT-1 doctrine)

The plans label pipe sizes on nearly every run — read them and carry them. A
manifest line takes `size: '3"'`; the assembler mints a size-variant lineType
(`3" Sanitary Waste`) on the SAME system canvas, so CT layers stay per-system
while feet, fittings, and tooling rows all split by size — the shape a priced
takeoff needs (`ft of 3" Sanitary Waste`, `2" Sanitary Waste · Tee`). Split a
drawn run where its label changes size. Fitting derivation joins branches
ACROSS sizes within a system (a 2" branch tees into the 3" main) and names the
fitting by the BRANCH size, matching estimator convention.

## Fitting allowances (BT-1 doctrine)

Geometry-derived fittings are a FLOOR, not a count — plan-view topology cannot
see riser fittings, fixture-drop fittings, vent turns, or underground bends
(BT-1: 13 derived vs 120 in the human reference; with allowances the twin
reached ~67). Every vertical allowance declares its fittings; the standard
table: drop/stub-up = 1 tee + 1–2 90s; VTR = 1 90; primer lateral = 2 90s.
Review the assembler's itemized allowance print before import.

## Scope-call standards (BT-1)

- **"By others" beats habit**: a system the plan marks by-others (compressed
  air on BT-1) is EXCLUDED from counts and named in the letter — even when a
  human reference counted it. If pricing it anyway is desired, that is the
  owner's call in review, not the takeoff's.
- **On-sheet oddities are counted, then flagged**: keyed systems with unclear
  ownership (3" PVC pit conduit) get counted under their own line type + an
  on-sheet note asking whose scope they are.
- **Cost lines may ride the counts** (the human pattern: `rentals`,
  `bfp/hammass` as count rows) — allowed, name them plainly.
- **The robot price book carries mirrored unit prices** from sent/won human
  bids (source named in the ledger note when added). Entry names MATCH the
  tooling-row names exactly (`ft of 1/2" Cold Water`, `3" Sanitary Waste ·
  Tee`) so Workbench matching lines up without aliases.

## Product price research (owner ask, 2026-08-30): the schedule names what to look up

The fixture schedule hands you manufacturer + catalog number for every scheduled
product — that is a research list. The protocol:

1. **Search the exact catalog number** (manufacturer or major distributor listing —
   Ferguson, SupplyHouse, Grainger, the manufacturer's own page). Prefer a page
   showing a live price for that exact model.
2. **Record it as a robot part** (`material_parts`, `is_robot`): name = schedule
   designation + model ("OI-1 · Striem OS-25 oil interceptor"), `manufacturer`,
   and **`link` = the exact page you read the price on — MANDATORY** (the owner's
   rule: an estimator must be able to click and check every researched price).
   `notes` carries date, price type (list/street), and any caveat.
3. **Record the price** (`material_part_prices`) attributed to the **'🤖 Web
   Research' supply house** with today's effective_date — researched prices never
   masquerade as supplier quotes.
4. **What you may record**: a displayed price for the exact model. Close-variant
   pricing (different trim of the same body) is recordable with the variance named
   in notes. "Call for pricing", login-walled, or quantity-negotiated items get NO
   price — record the part with its link and a note, and flag it.
5. **Researched prices are COST-basis inputs** for assemblies and estimating
   context. Sale prices stay the Workbench's margin decision — never copy a
   researched cost into a sale price book entry.
