---
name: "By Stage is retired: what is left"
number: 77
group: residual
status: shipped 2026-10-02 as v2.4389 (switched off), v2.4396 (code deleted) and v2.4405 (the 151 flags set to Combined) · #78 first as v2.4388 · four leftovers, none urgent
summary: >
  Every bid prices its materials one way now: the part lines on Takeoffs, staged with the
  1 · 2 · 3 boxes. By Stage, the older second way, is gone from the screens, the code and the
  data. Four things were left on purpose. Three old bids read no materials. The engine still
  carries three material slots where one would do. The robots' scorer and mission still name
  the old picks table. And the old table and columns are still in the database, unread.
next: The office's word on B82, B83 and B85. The rest waits for a quiet week.
size: S — four small pieces, each its own PR
blocker: B82, B83 and B85 are the office's call.
ver: v2.4388 · 4389 · 4393 · 4396 · 4405
opinion: later — nothing here is wrong on screen except three stale bids
mockup: not required — data and code leftovers; no screen changes
---

# By Stage is retired: what is left

## What shipped

Grace, 2026-10-01: Combined's stage boxes make By Stage redundant. The owner said yes the same
day, asked for the plan to be checked first, and asked for thorough live testing. It shipped in
three PRs: v2.4389 took the By Stage / Combined pills and the switch window off Takeoffs and
Labor, v2.4396 deleted the By Stage code (about 3,000 lines), and v2.4405 set the 151 bids still
flagged By Stage to Combined in the data. #78 went first (v2.4388, every copy of a takeoff keeps
its stage boxes), and its live test found v2.4393. Each fragment in `docs/recent-features/` says
what was checked and how. The live walk used to test it is `npm run walk:bids`
(`docs/E2E_SMOKE.md`).

## What is left

1. **B82, B83 and B85 read no materials on Pricing.** They link stage purchase orders and have
   no part lines. B82 *City of Seguin 886ft re-pipe* and B83 *Ornare Austin Showroom* count the
   same two draft POs ($27,734.00); B85 *Chipolte* counts one ($546.85). All three are from
   February with no outcome. The office marks them lost or no-bid, or someone redoes the takeoff.
   `bid_estimate_breakdown` and `bid_pricing_history` still count a linked stage PO first, so a
   job made from one of them would budget the PO total.
2. **Three material slots where one would do.** `…MaterialTotalRoughIn` / `TopOut` / `TrimSet`
   still thread through `useBidPricingEngine`, Labor, Pricing and `computeBidCostBreakdown`. Top
   Out and Trim Set are always empty. Folding them touches the money kernel and its tests.
3. **The robots still name the picks table.** twin-mcp's scorer counts
   `bids_takeoff_template_mappings` beside the part lines, and `docs/twins/missions/estimator.md`
   says so. Changing either means a regenerated brief and a deploy of twin-mcp.
4. **The old table and columns.** `bids_takeoff_template_mappings` (25 rows on six bids),
   `bids.materials_model` (always `rough`) and `cost_estimates.purchase_order_id_*` can be dropped
   once 1 is settled. `create_bid_version`, `clone_count_rows_to_bid_version`,
   `duplicate_bid_to_service_type`, `adopt_bid_as_version` and `materialize_bid_version` name the
   table, and the two SQL readers above name the PO columns, so the drop rewrites those bodies.
   `bidCopySql.test.ts` will say which copies to change.

## How to verify

`npm run walk:bids` on `main` and on the branch, then `diff`. For SQL, copy
`scripts/pgtest-materials-model-flip.sh`. The numbers behind the retirement are in
`docs/migrations/20261002120000_bids_materials_model_all_combined.md`.
