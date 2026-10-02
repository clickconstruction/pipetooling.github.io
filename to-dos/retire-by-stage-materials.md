---
name: "Takeoffs: retire By Stage, so every bid prices its materials one way"
number: 77
group: gated
status: the owner's yes 2026-10-01 · PR 1 shipped as v2.4389 (the pills and the switch window are gone) · PR 2 shipped as v2.4396 (the By Stage code is deleted) · PR 3 (flip the flags) left
summary: >
  Every bid stores its materials one of two ways, picked by the By Stage / Combined pills on
  Takeoffs and Labor. By Stage keeps "this assembly at this stage" picks with no prices, and gets
  a dollar figure only from three draft purchase orders. Combined keeps priced part lines, and
  since the Materials by stage train each fixture, line or part inside an assembly carries a stage
  (the 1 · 2 · 3 boxes). Combined now does everything By Stage was for, and nearly every feature
  built since the summer reads only Combined. On prod four bids ever had By Stage picks for real
  work, none since May; 151 bids still carry the By Stage flag because it was the default until
  April. The pills read like a view switch, but they swap the bid onto a separate, mostly empty
  set of data. Retire it: the pills, the By Stage editor and the stage purchase orders go, and
  every bid is Combined.
next: PR 3: recount on prod, then flip the 151 flags to Combined and restate the column comment.
size: S — one migration left
blocker: PR 3 needs a read of prod first. The office's word on B82, B83 and B85 is still open.
ver: v2.3588 · Materials by stage v2.3671 · 3672 · 3673 · 3675 · leftovers fixed v2.4368 · 4371 · PR 1 v2.4389 · PR 2 v2.4396
opinion: build — By Stage feeds nothing built since the summer, and its switch hides a bid's Combined list behind an empty editor.
mockup: not required — a retirement; the two pills and the By Stage editor go, and every Combined screen stays as it is
---

# Takeoffs: retire By Stage, so every bid prices its materials one way

## The ask

Grace, 2026-10-01, looking at the *Materials · By Stage · Combined* pills on Takeoffs: *"I
believe that after the recent additions of being able to break down parts by stage in the
combined view, it now makes the by stage tab redundant."* She asked for a deep look to confirm or
reject it. The finding was confirmed with one correction (below). She then asked to save the work
to the punch list for another session, waiting on the owner's yes: v2.3588 kept the By Stage
editor on purpose and left its fate to him, and `docs/TAKEOFFS_REFRESH_PLAN.md` lists *By Stage
retirement* as a separate owner call.

## What was found

**By Stage is not a view of the Combined list.** It is a second, older way of storing a bid's
materials, chosen by `bids.materials_model`:

- **Combined** (`'rough'`) keeps priced lines in `bids_takeoff_rough_part_lines`, and since
  v2.3671 to v2.3675 a stage per fixture, line or part inside an assembly in
  `bid_takeoff_stage_splits`. It also covers the assembly remembering a part's stage, the book
  remembering a fixture's, *Fill from rules & book*, the ×1.5 factor, the printed schedule of
  values and the Cover Letter's three stage sections.
- **By Stage** (`'exact'`) keeps assembly + stage + quantity picks in
  `bids_takeoff_template_mappings`, with no prices. It gets a dollar figure only after
  **Create purchase orders for Stages** makes three draft POs, linked on
  `cost_estimates.purchase_order_id_rough_in / _top_out / _trim_set`.

The pills on Takeoffs and Labor switch which set the bid uses. The other set is parked, not
converted. Clicking By Stage on a Combined bid does not show the list by stage; it shows an empty
editor, and Pricing loses the materials.

**The one thing only By Stage does** is make those per-stage POs (and *Add to selected PO*). It
has made 5 draft POs, all in February 2026, and none since. Nothing carries them to the job when
a bid is won: `purchase_orders` has no bid or job column. Ordering now runs through the
Procurement log and Job Parts Tally.

**How each tab treats the two** (code read 2026-10-01):

| Where | Combined | By Stage |
|---|---|---|
| Takeoffs | Priced lines, *What Pricing sees*, Stages panel | Picks with no prices |
| Pricing and Labor | Materials from the lines | Only the three POs: B403 has 9 picks, $0.00 materials, an 82% margin |
| Cover Letter: schedule of values, Materials by stage | Yes | Always empty (`loadMaterialsByStageForBid` reads lines only) |
| Submittals | Parts from the lines | Every fixture lands in *No part on the takeoff yet* |
| Procurement log stage | From the stage boxes | Guessed from the fixture name; the picked stages are ignored |
| Job budget when won (`bid_estimate_breakdown`) | From the lines | $0 without the POs |
| Bid flow strip, Takeoffs step (`useBidFlowFacts`) | Done when lines exist | Never done |
| Alternate and version material cards (`usePricingCardsData`) | Yes | None |

Untouched by either: Labor's hours by stage and the Labor sub-sheets, CountTooling imports (counts
are model-blind), and the robots (twin-mcp writes neither takeoff table; its bid shells take the
column default, Combined).

**Who uses it (prod, read-only, 2026-10-01):**

- 409 bids: 258 Combined, 151 By Stage. 83 Combined bids were made in the last 60 days. B403 is
  the only By Stage bid made since May, and it is the ZZ Twin test bid.
- Of the 151 By Stage bids, 145 hold no By Stage data at all; 66 have counts and nothing priced.
- Picks exist on six bids: B82, B85, B159 (lost), B403 (test), and B138 and B287 (both lost and
  already Combined, with leftover rows). 25 rows in all, the newest from 2026-08-30.
- Stage POs exist on three bids, all with no outcome and still on the board. B82 *City of Seguin
  886ft re-pipe* ($27,000 bid) and B83 *Ornare Austin Showroom* ($71,218) both count **the same
  two draft POs** ($27,734.00), named *Orange Austin Showroom – Takeoff 2/11/2026*. The Materials
  by stage PO pickers list every draft PO in the company, so two bids can claim one. B85
  *Chipolte* counts one PO ($546.85).
- Combined's stage boxes: 6 rows on B375 and B490. The takeoff book: 2 entries with 5 staged
  items, in *Default*.

## The decision

**Open, the owner's:** retire By Stage, or keep it. Grace's read and the reviewer's: retire.

Defaults if he says yes (veto any of them on the row):

1. **No conversion.** The six bids with picks are lost or test bids, or B82 and B85 below. Their
   rows stay in `bids_takeoff_template_mappings` and nothing shows them.
2. **B82, B83 and B85 are the office's call before PR 1.** They are eight months old with no
   outcome. After PR 1 their Pricing reads Combined lines (none), so their materials go from the
   PO totals to $0. Marking them lost or no-bid first makes that moot. B82's figure is another
   project's POs anyway.
3. **The guide `choose-by-stage-or-combined-for-materials` is deleted**, and the three guides
   that link to it are fixed: `import-a-takeoff-from-counttooling`, `raise-a-purchase-order` and
   `start-here-as-an-estimator`.
4. **The table and its copy RPCs stay in this train.** Dropping `bids_takeoff_template_mappings`,
   `bids.materials_model` and the stage PO columns is a later residual. The version, duplicate,
   adopt, materialize and deleted-records RPCs all name the table. The SQL POs-first rule in
   `bid_estimate_breakdown` and `bid_pricing_history` is harmless once no bid can make new
   stage POs.
5. **The takeoff book's per-item Stage column is hidden** in the admin section
   (`TakeoffBookAdminSection.tsx`), because Combined never reads it. Combined learns stages
   through *Remember* (the entry's `stage_split`) and the assembly's memory. The column stays in
   the table, and `takeoffBookLearnWrite.ts` keeps writing its `'rough_in'` default.

## Where it plugs in

- **Takeoffs** — `src/components/bids/BidsTakeoffTab.tsx` (3,189 lines):
  - the pills block (*Materials model (By Stage / Combined)*, about line 2195);
  - the By Stage branch (about 2368–2714), with the template picker portal and the assembly
    preview modal (the two `createPortal`s near 3090 and 3124);
  - `setTakeoffMapping`, `saveTakeoffMapping`, `addTakeoffTemplate` and `removeTakeoffMapping`
    (1085–1215);
  - `createPOFromTakeoff` and `addTakeoffToExistingPO` (1310–1419);
  - the exact branches of `applyTakeoffBookTemplates` (986) and `printTakeoffBreakdown` (1421).

  `docs/BIDS_TAKEOFF_TAB_ARCHITECTURE.md` → *By Stage ("exact") editor* maps the whole region, its
  state and its quirks 9–11.
- **Labor** — `BidsLaborTab.tsx`: the pills (about 804–862). It also copies the three PO ids on
  save (about 380–384).
- **The switch** — `src/hooks/useBidPricingEngine.ts`: `openMaterialsModelSwitch` and
  `confirmMaterialsModelSwitch` (about 1357). The window lives in `src/pages/Bids.tsx`
  (*Switch materials model?*, about 1576–1646). `MATERIALS_MODEL_CAPTION` and
  `normalizeMaterialsModel` live in `src/lib/bids/bidTakeoffHelpers.ts`, which turns a null or
  unknown model into `'exact'`.
- **The exact reads** in `useBidPricingEngine.ts`:
  - `loadTakeoffCountRows` (the mappings);
  - `loadCostEstimate` (the PO totals);
  - the Pricing load's *Phase 2 … Exact materials model* (POs, then mappings × PO prices).
- **The other exact reads:**
  - `BidsTakeoffMaterialsSummarySection.tsx`: the MATERIALS BY STAGE PO pickers and the PO
    review modal. The Combined text there still says *Takeoffs → Rough*.
  - `src/lib/bidDocuments/costEstimatePage.ts`: the exact page.
  - `src/lib/bids/bidMaterialsIo.ts`: the PO branch of `loadBidMaterials` (v2.4368).
  - `src/hooks/usePricingCardsData.ts`: the model read.
  - `Bids.tsx` `isExactMaterials` → the `BidVersionPicker.tsx` caveat about shared POs.
- **Tests** to rewrite:
  - `BidsTakeoffTab.render.test.tsx`: four smokes mount the exact body, including the null-model
    smoke.
  - `Bids.render.test.tsx`: the switch window.
  - Others: `costEstimatePage.test.ts`, `usePricingCardsData.render.test.tsx`,
    `useBidPricingEngine.*.render.test.tsx` and `takeoffBookFill.test.ts`.
- **Guides:**
  - `choose-by-stage-or-combined-for-materials` (deleted).
  - `fill-a-takeoff-from-the-book` (its *By Stage bids* section).
  - `raise-a-purchase-order` (the takeoff bullet).
  - `import-a-takeoff-from-counttooling` (*pick the model*).
  - `cost-a-takeoff-one-fixture-at-a-time` (*By Stage bids have no view pills*).
  - `create-an-assembly-while-doing-a-takeoff` (*a By Stage mapping*).
  - `start-here-as-an-estimator` (*pick the model*). It is still on the plain-words legacy list,
    so editing it means a full rewrite by `src/lib/plainWords.ts` and removing its row.
  - `stage-a-takeoff-for-a-schedule-of-values` is also on the list, and becomes true as written.
    Leave it alone.
- **Docs:**
  - `GLOSSARY.md` (By Stage / Combined).
  - `BIDS_SYSTEM.md` → Takeoffs.
  - `TAKEOFFS_REFRESH_PLAN.md`: the status line, and the *Retirement PR recipe* this follows.
  - `BIDS_TAKEOFF_TAB_ARCHITECTURE.md`: the By Stage region becomes history.
  - `BIDS_TABS_ARCHITECTURE.md`.
  - `docs/twins/missions/estimator.md`: the scorer's *template mappings / rough-part lines*.
  - The baseline's column comment (*rough … without stage*) is stale. PR 3 restates it.

## The plan

1. **PR 1 — every bid is Combined** (client, guides):
   - The pills go from Takeoffs and Labor. The switch window, `openMaterialsModelSwitch` and
     `confirmMaterialsModelSwitch` and the caption go too.
   - `normalizeMaterialsModel` returns `'rough'` for everything, so a bid flagged By Stage opens
     on One at a time or the Sheet with its counts. The By Stage code becomes unreachable but
     stays in this PR.
   - The guide changes above ship in this PR.
2. **PR 2 — delete what PR 1 made unreachable** (client, no behaviour change):
   - Every item in *Where it plugs in*: the editor, the two portals, PO making, the PO pickers
     and review, the engine's exact branches, the exact Labor print and the PO branch of
     `loadBidMaterials`.
   - The `BidVersionPicker` caveat, and the book admin's Stage column (decision 5).
   - The smokes rewritten, and `MaterialsModel` removed.
3. **PR 3 — the data says it too** (migration):
   - `UPDATE bids SET materials_model = 'rough' WHERE materials_model = 'exact'`: 151 rows on
     2026-10-01, re-count first.
   - `COMMENT ON COLUMN` saying By Stage retired in v2.NNNN.
   - Start the migration with `SET lock_timeout = '3s';`. Add its `docs/migrations/` page, and
     run `supabase db push` after the merge.
   - No table drop (decision 4).

#78 shipped first, as v2.4388: a new version, a duplicate and an adopt keep Combined's stage
boxes, which are the only stage data a bid has once this ships.

## How to verify

- **Test bids:**
  - B403 *ZZ Twin LIVSTE*: By Stage, 9 picks, no POs.
  - B398 *ZZ Test*: Combined, an alternate.
  - B490 *Shipley Do-Nuts* and B375 *SpaceX*: Combined with stage boxes.
  - B159: By Stage, lost.
- **PR 1:**
  - B403 opens on the Combined view.
  - No *Materials* pills appear on Takeoffs or Labor.
  - B490's Stages panel, *What Pricing sees*, Pricing's materials, the Cover Letter's schedule of
    values and the Approval PDF all read the same as before the PR. Record the PDF instead of
    downloading it: override `J.API.text` and `J.API.save` on the jsPDF from
    `/src/lib/loadJsPDF.ts`, because jsPDF sets them per instance.
  - `npx vitest run src/components/bids src/lib/bids src/lib/bidDocuments src/hooks` and
    `npm run check:plain-words`.
- **PR 2:** the same walk gives the same numbers, and the suites are green.
- **PR 3:** a `BEGIN … ROLLBACK` dry run updates the expected count. After the push,
  `SELECT materials_model, count(*) FROM bids GROUP BY 1` returns only `rough`.
- **Prod reads** without the dev-mcp key: psql over the session pooler, as in
  `docs/DB_FREEZE_RUNBOOK.md`, with `PGOPTIONS='-c default_transaction_read_only=on'`.

## Where it stands

PR 1 shipped as v2.4389 and PR 2 as v2.4396. Every bid reads as Combined and the By Stage code is
gone. #78 shipped first as v2.4388, and the live test of it found v2.4393 (a new version shows its
stage boxes right away). Each fragment says what was tested and how.

**Left:**

- **PR 3, the flags.** `UPDATE bids SET materials_model = 'rough' WHERE materials_model = 'exact'`
  and the column comment, as planned above. Recount first: the 151 was read on 2026-10-01 by an
  earlier session and not recounted since.
- **B82, B83 and B85.** Their Pricing reads no materials now. The office marks them lost or no-bid,
  or someone redoes the takeoff. `bid_estimate_breakdown` and `bid_pricing_history` still count
  their stage POs first.
- **Residuals, none urgent:** the three material slots in the engine and `computeBidCostBreakdown`
  (two are always empty now); twin-mcp's scorer and `docs/twins/missions/estimator.md` still name
  `bids_takeoff_template_mappings`; dropping that table, `bids.materials_model` and the stage PO
  columns.
