# Placement engine v0 — counters-first takeoff placement

---
file: docs/twins/PLACEMENT.md
type: Harness procedure / Skill
purpose: How an agent turns a substrate + plan-set PDF into a placed, imported CountTooling takeoff — the counters-first procedure, coordinate math, self-checks, and tooling. Wave 3.4 of ESTIMATOR_TWIN_PIPELINE_PLAN.md. The vision model IS the engine; this file is its operating manual (EXTRACTOR.md's sibling) Served by twin-mcp as get_placement_guide (bundled with CALIBRATION.md + EXTRACTOR.md).
audience: AI Agents, harness operators, Developers
last_updated: 2026-09-04
key_sections:
  - Tooling
  - The counters-first procedure
  - Coordinate math
  - Self-checks (counters prove out)
  - Import & review
  - Ask like a junior estimator, not like a model
  - Density tiers pick the pricing posture
  - The small-TI rule
  - Footage is traced by default
  - Vent is riser-shaped, not plan-shaped
  - Census sweep additions
  - Set-class triage before the census
  - Reference protocol at unseal
  - Institutional / district multiplier
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

## Sheet coverage: read EVERY sheet, demo plans included (BT-2 doctrine, 2026-08-30)

The sheet inventory is a checklist, not a menu. Walk **every** sheet in the set and
account for each one in your import note — traced, counted, or excluded WITH the
reason written down. Two classes trap a plans-sheet-only reader:

- **Demo plans (PD-\*, D-\*, "PLUMBING DEMOLITION")** carry real scope: fixtures to
  remove, cap, or relocate, each a labor/pricing row even though nothing new is
  installed. Count them like any plan sheet — a `Demo` canvas with one counter per
  demoed fixture class (`DEMO · WC remove`, `DEMO · cap 2"W`) keeps them out of the
  new-work tallies while pricing still sees them. On BT-2 the unread PD-100 hid 27
  demo fixtures (~$13.5k of scope).
- **Schedules, notes, risers, and site sheets** aren't traced, but each still gets a
  pass for keyed notes, printed totals, mount heights, and by-others statements —
  the reconciliation inputs the other doctrines below consume.

A sheet your import note doesn't mention is a silent gap; the auditor should be able
to read the note and know no sheet was skipped.

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
- **Tile-seam dedup runs automatically** (BT-2: FD-2 counted 12 vs 11 off a ~22 px
  overlap pair): the assembler drops same-counter same-page marks within 24 raw px
  (`dedupeSeamMarks`; `"seamDedupePx"` in the manifest overrides, 0 disables) and
  prints every drop. Read that list — a drop that ISN'T a seam pair means two real
  fixtures sit closer than the window; re-place with `seamDedupePx` lowered rather
  than losing one.
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
`pdf_headers: {"X-Twin-Token": …}`) + `external_ref` set to the bid number (`"b409"` — the
CT bid-stamp chip; always pass it) — plans land under your marks. Re-import (same name)
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

## Developed length: price developed feet, not projected feet (BT-2 doctrine, 2026-08-30)

BT-2 proved the residual: with registration-clean traces AND itemized vertical
allowances, twin footage still ran **55–65% of the human reference on every
system**. What's missing is developed length — fitting take-up, offsets around
structure, trap arms and sub-resolution laterals, the wall-thickness the plan-view
centerline ignores. Estimators price developed feet; the drawn takeoff is a
projection.

- Declare per-system factors in the manifest:
  `"developedLength": [{ "system": "Cold Water", "factor": 1.6, "source": "BT-2 calibration 2026-08-30" }]`.
  **Default 1.6** (the BT-2 midpoint; `DEFAULT_DEVELOPED_LENGTH_FACTOR` in the
  kernel) for every traced pressure + DWV system until a later backtest recalibrates
  per system — every factor NAMES ITS SOURCE like any allowance.
- The assembler scales DRAWN feet inside the size-split tooling rows (price-book
  names still match) and prints the per-system itemization (drawn × factor =
  developed); vertical allowances ride **unscaled** — they are already real 3D feet.
- CountTooling stays the drawn view: factors never touch the CT lines, only the
  tooling paste block. A system the factor list doesn't cover is carried as-is and
  the report says so — an uncovered system is visible, never silently unscaled.
- Recalibration duty: every backtest recomputes twin-vs-reference footage per
  system; a factor that leaves the ratio outside 0.9–1.1 gets retuned in this file
  with the new backtest named as source.

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
- **Site/civil is never ours (audit 2026-09-04, b411)**: sewer and water
  services, taps and saddles, meters, yard cleanouts, tie-ins to the public
  main, and any interceptor set on the site sewer are civil scope — EXCLUDED
  from counts and named as an exclusion in the letter, even when the set
  carries the civil sheets. The building stops at 5 ft outside the slab. b411
  rowed ~$14k of site work against a reference that bids none of it ("we do
  not bid civil/site").
- **Scheduled = counted (b406)**: a tag on the fixture schedule is a floor.
  When you cannot find its symbol, carry the scheduled quantity anyway ("idk i
  just added them in the bid"), flag it with an `RFI:` note — never zero a
  scheduled item. And read the WHOLE schedule before calling a tag missing:
  HR-1 on b405 was on it ("it is in the fixture schedule, look again").
- **Ambiguous ownership on the plumbing sheets → in scope (b407)**: an RPZ, a
  landlord-boundary device, or a keyed item drawn on the P-sheets with unclear
  ownership is counted and priced ("assume it is in the scope"); the letter
  names the assumption. Exclusion is for what a note assigns to others, not
  for what the plans leave unlabeled.
- **Sawcut is excluded by default (b408)**: slab fit-outs sometimes need it,
  but it is normally an exclusion line, not a row. Drop the `ft of Sawcut &
  Patch` row; write the exclusion.
- **One plan set, two packages → ask (b408)**: when a set serves core/shell AND
  a tenant/architectural package, nothing on the drawings tells you the split
  — "the scope was communicated via phone". Look for a sibling bid on the same
  address (`get_work_state`, the board search); if one exists, `ask_question`
  which package is yours BEFORE counting, and state the assumed boundary in
  the lock note. BT-5 priced $114k of the sibling's scope.

## Ask like a junior estimator, not like a model (audit 2026-09-04)

Wendi answered 16 threads in one pass; the ones she could not use were the
ones written in twin vocabulary — "letter uplift", "priced under your model",
"my PEX/PVC-tier draft", "the sweep rule" — and came back "idk what this means
but youre way too low" / "idk i just added them in the bid". Rules:

- **Plain trade words only.** No tier, model, sweep, uplift, census, developed
  length, allowance row. Say what is on the sheet and what you did with it.
- **One ask per question**, answerable with yes/no, a number, or
  which-of-these. "Do you count the 2" ball valves from the riser or from the
  plan?" — not a paragraph carrying three sub-questions.
- **Anchor every one**: `sheet_ref` + a one-line `context` (v2.2535). None of
  the questions she answered on 2026-09-04 carried an anchor; she hunted for
  each.
- **Never ask her to grade your number** ("is ~$250k the right
  neighborhood?"). The scorecard grades numbers; she answers about the plans
  and her practice. Ask what she carried and why.
- **A standing rule goes to doctrine the same day** — "I measure every 1/2in
  home run", "we do not bid civil/site", "SELF PERFORM" are rules, not bid
  answers (FEEDBACK_LOOP.md's promotion rule).

## The pricing model (BT-2 doctrine, 2026-08-30 — mirrored from b376)

The 🤖 Robot Default book was reshaped to the human sale model (source: Wendi's
keyed b376 rows; ledger note on b405). The shape, so future mirrors keep it:

- **Fixtures carry LOADED prices** — the fixture row absorbs its share of labor,
  trim, and connections (WC/Lav $3,350-class, sinks $4,350-class, specialty gear
  at its own mirrored number), NOT material-concept prices. A fixture priced
  under ~$500 is a red flag outside demo/cleanout/bib rows.
- **Footage is two-tier**: buried/underground sewer is cheap dirt work
  ($25–35/ft regardless of diameter); above-slab cast iron carries the system
  price ($130–160/ft); copper water rides its size curve ($22–90/ft). Never
  price buried 4" at the above-slab CI rate — that single row was the BT-2
  price miss ($204/ft vs her $35).
- **Travel, rentals, and incidentals are HUMAN lines (audit 2026-09-04, b418 +
  b408)**: the reference rows them as one flat `RENTALS/TRAVEL` line priced by
  judgment per job — never per mile. The $80/mi book rate (calibrated once:
  b376, $20k at 249 mi on a $347k job) put $23,464 of travel on a ~$49k
  Brownsville proto at 293 mi — "charging 50% for traveling is actually crazy
  work". Until Wendi's bands are recorded (PENDING — the next audit question:
  what she carries at ~50 / 100 / 200 / 300 mi on a small proto vs a $300k
  job), carry ONE `Travel & Rentals` row, count 1, priced at the LESSER of
  $80 × miles and 10% of the building subtotal, and state the building total
  and the travel line separately in the lock note so the scorecard reads both
  ways. Incidentals / DSC rows: never — "assessed by humans depending on job".
- **The schedule's model IS the model — never upsize, and sanity-check the
  device price (b411 + b418)**: the plan called an OS-25 oil interceptor; the
  robot rowed an OS-100 at $9,500 ("wrong item and wrong price"). An OS-25 +
  riser runs ~$1,500; an OS-75 + riser + H-20 cover $4–5k ("should be 4-5
  thousand") — the robot book's $6,270 / $8,000 / $9,500 interceptor entries
  are wrong and get re-mirrored at the digest. Rule: any single device priced
  above ~10% of the building subtotal gets checked against the researched
  part price (Product price research, below) before it stays.
- **Demo fixtures price at `Demo Fixture (remove/cap)`** ($500/ea) — the PD-*
  sheet-coverage doctrine feeds this row.
- **Med gas is SELF-PERFORMED** (b405 answer, 2026-09-04: "SELF PERFORM") —
  price outlets, piping, fittings, manifold, and alarms as installed rows from
  the robot book, not as a sub allowance; the letter no longer says "by
  certified sub". (Supersedes the BT-2 allowance rule.)
- Letter uplift over raw rows is the OWNER's margin decision (b376 sent at
  ~1.84× rows) — the twin never applies it; the draft stops at book-priced rows.

## Material tiers: the spec box picks the rates (BT-3 doctrine, 2026-08-31)

BT-3 (Hyper Kidz, PVC-spec TI) proved the loaded-fixture model transfers across
job types (twin fixtures $101k vs ~$95k implied — within 6%) and that the entire
price miss lived in the footage/fitting tier: the book charged cast-iron rates
($140–160/ft on 2"/3") on a job whose spec box reads PVC waste/vent +
copper/CPVC/PEX water, where the human priced $13/ft water and $25/ft sewer
flat. Twin raw $218k vs her sent $134k; re-tiered ≈ $129k — within 4%.

- **Read the PLUMBING MATERIAL SPECIFICATION box during extraction and record it
  in the substrate.** It is a pricing input, not trivia.
- The 🤖 Robot Default book carries BOTH tiers. **PVC waste/vent spec** → assign
  ft/fitting rows to the `(PVC)` entries (`ft of 2" Sanitary Waste (PVC)` $25,
  PVC fitting set mirrored from b370). **CPVC/PEX-permitted water** → `ft of
  Water (CPVC/PEX tier, any size)` $13. **Copper-only water / cast-iron waste**
  → the standard entries (the b376 tier).
- **The tell that the tier is wrong**: on a fixture-driven TI, a footage+fittings
  bucket rivaling or exceeding the fixtures bucket means re-check the spec box
  before drafting.

## Count valves beyond the schedule (BT-3 doctrine)

BT-3's only count miss was BALL VALVE 0 vs 12 — exactly CALIBRATION.md's
load-bearing finding (humans count valves/cleanouts the schedule never lists).
After placing scheduled fixtures, sweep for isolation valves: one per fixture
group/battery header, one at each equipment connection (WH in/out, RP, laundry),
one at the service entry. When the plan draws valve symbols, count those; when
it doesn't, carry the sweep-derived count as an allowance row named plainly
(`Ball Valve (isolation)`) with the derivation in the import note.

## 4" underground fittings ride an allowance (BT-3 doctrine)

Plan-view Manhattan tracing of a buried 4" spine yields almost no fittings
(BT-3: 2 vs her 36 on the 4" family) — the bends, wye-and-eighth stacks, and
riser turns live below slab and in the NTS riser. Derive a 4" fitting allowance
from the riser: per WC battery ≈ 1 tee per WC into the main + 1 90 per
direction change shown; per FCO a cleanout tee; per POC a coupling + bend. Carry
it as vertical-allowance fittings with the riser named as source — geometry
stays the floor, never the count.

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

## Density tiers pick the pricing posture (retro sweep + BT-7 doctrine, 2026-08-31)

The material-tier rule above needs one more input the spec box can't give:
**how occupied the slab and ceiling are.** The retro sweep across BT-2..BT-6
isolated it, and BT-7 validated it blind (−17% on a kitchen TI where the old
posture read −39%):

- **Occupied/congested** (kitchen TI, vet clinic, owner-spec grocery): loaded
  CI waste $130–160/ft AND copper water — working around equipment, hoods,
  existing trades is what the loaded rate encodes.
- **New-slab/open** (ground-up shell, open TI): material tiers — PVC $25/ft
  waste, PEX-practice $13/ft water — even when the written spec is stricter
  (next section).

## Price to her tier logic, not the material spec (BT-6 doctrine, 2026-08-31)

BT-6 (Pepper Lunch, −39% before the fix) sharpened BT-3's spec-box rule in both
directions. The spec box picks the *material family*; the human picks the *rate*
by practice:

- Above-ground 2"/3" waste+vent goes at the LOADED $140–160/ft entries even
  when the spec allows PVC — the rate encodes labor, not resin.
- Water is priced at the PEX tier ($12–13/ft) even when a spec clause says
  Type L copper — she bids her practice, not the clause.
- Underground bulk stays the cheap-dirt tier regardless.
- **Trap primers count PER TRAP** (BT-6: 13 where the schedule showed one TP
  model). **Gas equipment drops each carry their own 1/2" footage.**
- **Two-view sheets double text counts** (above-grade + underground drawn
  side-by-side): detect via paired x-offsets at matching y, partition to one
  view per counter, riser cross-check. BT-7 corollary: enlarged-kitchen
  right-side clusters may be REAL fixtures, not duplicates — verify against the
  riser before deduping.

## The small-TI rule (BT-11 → BT-12 doctrine, 2026-08-31)

BT-11 (ATI Schertz, +59.9%) exposed that footage+fitting rows POISON a small
job; the micro-sweep calibrated the replacement and BT-12 validated it blind
(−2.6%, zero tuning):

- **Trigger**: fewer than ~10 fixtures in a single cluster.
- **Price per-fixture all-in**: WC $3,350 exactly (×3 verified), sink battery
  $2,000/station, specialty (MS/EWC/DF) $2,500.
- **DROP entirely**: footage rows, fitting rows, sawcut rows — they are inside
  the per-fixture number at this scale.
- **KEEP**: dedicated runs (gas, storm), specials (grease, med gas), travel.

**Measured residual (BT-17/18, 2026-09-01 — PENDING owner decision, parked as
question 836b6c22):** with fixture accuracy at 100/100/91%, the rule still
landed −21/−29/−17% on the Take 5 pair + Church cafe — the human itemizes
branch footage, vent, water, and hammer arrestors ON TOP of fixture money at
this scale. Candidate fixes (do not apply until answered): a footage residual
(~$6–8k on sub-$50k jobs) or ~30% higher per-fixture all-ins; plus a
"Take 5 proto package" book entry (pair-implied ≈ $37.4k building +
~$51/mi travel, sources b166/b237). Until then, expect small-TI locks to run
light and say so in the lock note.

## Footage is traced by default (BT-8 + T2, 2026-08-31)

Untraced footage models regress to 0.60× of reference (BT-8). The correction
hierarchy:

1. **Trace with the T2 path census** (`scripts/twin-census/path_census.py`):
   pen inventory → one visual overlay to map pen→system → chained runs with
   symbol/margin filters. Calibrate scale per view (grid-label spacing or
   doorways — Revit letter prints MIX scales on one sheet: 1/8 plans beside
   1/16 demo views, BT-16).
2. Where the set is full-raster (Class C) and tracing is impossible, model
   footage and apply the **1.6× correction** — and say so in the import note.

Audit 2026-09-04 confirmations (b405/b407/b408/b409): she **measures every
1/2" home run** (b408: 719 ft vs the twin's 48 — no per-fixture length rule
exists); branch mains below the 4" spine default to **3"** by rule of thumb
(b407 — she sizes by rule, not by ISO label, and says she was off on that
one); b409's four `[verdict:teach]` rows were all footage the model never
traced (3" waste 224 ft / $34k, 1" water 118 ft, 2" waste 120 vs 337 ft, 2"
45s ×13). Every **connect-to-existing / POC carries 10 ft of pipe** at that
size — "I always drop 10ft just in case" (b405).

## Vent is riser-shaped, not plan-shaped (BT-19 doctrine, 2026-09-01)

The Hunter Rd triple put twin vent ratios at 0.17×/0.28×/0.54× even with the
1.6× correction applied — on two-story sets the vent tree (every fixture's 2"V
to the collector, transitions under windows, VTR stacks at the back of the
building) dwarfs its plan-view shadow. The reference carried 835 ft of vent on
a building whose 4" waste ran 236 ft.

- **Model vent from the RISER, not the plan**: count the riser's 2"V drops ×
  their floor-to-collector heights + the horizontal collector length. Where no
  riser exists, carry vent ≈ 1.5–2× waste footage as a named allowance.
- **Model under-slab mains at BUILDING length on multi-wing plans** — the
  office reference ran 369 ft of 4" spanning both wings; a wet-cluster-width
  model halves it.
- The 1.6× correction stays valid for WASTE (ratios 0.82–1.25× on the same
  runs); it was never a vent model.

## Census sweep additions (BT-17..19 doctrine, 2026-09-01)

Additions to the count-past-the-schedule sweep (CALIBRATION.md's load-bearing
finding), plus one refinement:

- **Hammer arrestors count PER quick-closing connection** — beverage/kitchen
  TIs carry many (Church cafe: 9 where the protos carry 1). Sweep solenoid
  fixtures: dishwashers, ice makers, carbonators, sensor valves, washers.
- **IMB (ice-maker box) hides in office break rooms** — the office reference
  carried 2 the census missed. One per break-room refrigerator recess.
- **FD default on office sets**: 1 per HVAC closet + 1 per restroom.
- **Drawn trim beats the sweep** (refines the BT-3 valve rule): when the riser
  DRAWS its trim — balancing/check valves, expansion tank, circulating pump,
  thermometers, hose-end drains — count the drawn items and SKIP the
  sweep-derived valve allowance. The sweep applies only when the plans show no
  valve symbols at all (BT-19: sweep carried 12 ball valves vs the engineer's
  drawn 1).
- **Parse WHAT is by-others** (refines the BT-1 scope call): exclude the thing
  the note names, not the system around it. "CA system by others" on Take 5
  protos means the compressor/equipment — the human priced ~70 ft of
  galvanized CA piping + fittings on BOTH protos. Equipment by others ≠ piping
  by others; when ambiguous, count the piping and drop an `RFI:` note.

## Set-class triage before the census (T1/T2 toolkit, 2026-08-31)

First minutes with any set: classify it, then pick tools
(`scripts/twin-census/README.md`):

- **Class A — vector + text**: pdftotext census (tags, schedules, keyed notes)
  + T2 footage. Fastest path.
- **Class B — vector, no text** (AutoCAD SHX stroke soup): T1 vector census —
  shape hashing for repeated words/boxes, geometric detection for keynote
  hexagons (106/106 on LIVSTE), 600dpi crops at detected positions to read
  tags, sheet-margin KEYED NOTES legends to decode them. Never sweep crops
  blindly; the census aims every look.
- **Class C — full-raster scans**: template-match (T3, unbuilt) or targeted
  vision; footage falls back to the 1.6× rule.

## Reference protocol at unseal (BT-9/10, BT-14, BT-15, BT-16 — 2026-08-31)

Rules the backtest/shadow scorecard MUST apply before a delta means anything:

- **Reference-quality gate** (BT-9/10): longshot references (loss_reason
  "longshot in the dark", no_bid, stale) are not gate-eligible. Prefer WON or
  competitive-loss + recent + has-takeoff.
- **Scope-match check** (BT-15 void → BT-16 first pass): line-compare the
  reference takeoff's fixture tags against the fetched plan set. A reference
  fixture absent from the set = scope mismatch = STOP SCORING and flag. BT-15
  scored −28% against the wrong package (core/shell set vs her tenant-fit-out
  takeoff) and the delta was void.
- **Bid-tab band** (BT-15 rule, survives its void): when a bid tab exists,
  score against the winning band, not only the single human number.
- **Index-listed-but-missing sheets → RFI first** (BT-14): when the set's own
  index names sheets the file doesn't contain, park the question before
  estimating around the hole.
- **A loss note IS a band** (BT-19): "winner came in far below / less than
  half" in loss_reason bounds the market the same way a bid tab does — report
  the delta vs the human AND vs the implied winner band. Three campus
  buildings lost to <0.5× the human number; the twin at −20..−34% was still
  ~1.5× the winner. A uniform gap of that shape is a market-posture flag for
  the owner, not a takeoff or tier error.
- **Under a lost-on-price number is LIGHT, not competitive (b407 correction,
  2026-09-04)**: BT-4 called $247k vs her $281k loss "inside the competitive
  band"; her answer was "no, priced too light". A price she lost on is still
  the number she would defend; landing under it means the takeoff or tiers
  are short. Report "under the human" as a miss every time — only a bid tab
  or a loss note bounds the market below her.
- **Check a reused shell's ledger BEFORE working it** (BT-4/BT-5 rediscovery):
  `open_backtest` with `reused: true` may hand back a shell that already ran
  through STG-6 — read `get_work_state`'s audit ledger first. A scored
  backtest can never be re-run blind; keep the prior result and move on.

## Institutional / district multiplier (BT-16 hypothesis — PENDING AUDIT)

BT-16 (AISD Garcia MS): quantities matched the reference takeoff nearly
line-for-line, and the price still landed −57.5%. Same scope, 2.35× price gap —
school-district work carries prevailing wage, summer-phasing compression,
district GCs/bonds, and painting of exposed piping (her rows carry paint; the
commercial book does not).

- **Working rule (unconfirmed)**: on ISD/district/prevailing-wage bids, apply
  ~2.2–2.4× over the loaded book before comparing to the human number. Caveat:
  the reference LOST on price, so the market band sits below it and the true
  multiplier may be nearer ~1.8–2.2×.
- **Do not misread the delta**: when the scope-match check passes and the gap
  is uniform across systems, suspect the wage/tier basis — not the takeoff and
  not the book's commercial rates.
- Confirmation question is seeded on the b422 audit; promote this section to
  hard doctrine (and a book multiplier entry) when Wendi answers.
