---
name: "Combined takeoffs: a new version or a duplicate keeps its stage boxes and order rules"
number: 78
group: ready
status: found 2026-10-01 while reviewing By Stage (#77) · not started
summary: >
  Three bid functions copy or move a bid's Combined part lines and leave two things behind. A new
  version (create_bid_version) and a duplicate into another trade (duplicate_bid_to_service_type)
  never copy the stage boxes in bid_takeoff_stage_splits, and they drop each line's order rule
  (order_increment, order_increment_unit). Adopting a bid as a version (adopt_bid_as_version)
  moves the lines but leaves the stage boxes filed under the old bid, where nothing reads them.
  Today this touches little: stage boxes on 2 bids, order rules on no line. Once By Stage retires
  (#77), the boxes are the only stage data a bid has, so every copy should keep them.
next: One migration — create_bid_version and duplicate_bid_to_service_type copy the order rules and the boxes, re-keyed; adopt_bid_as_version re-points the boxes.
size: S — one migration (three function bodies), no client change
blocker: None.
ver: stage boxes v2.3671 · order rules v2.3406 · versions v2.2395 · duplicate v2.4188
opinion: build — small, and it closes the one gap before Combined is the only way to stage materials
mockup: not required — a database copy fix; no screen changes
---

# Combined takeoffs: a new version or a duplicate keeps its stage boxes and order rules

## The ask

Found on 2026-10-01 while confirming Grace's read that Combined's stage boxes make By Stage
redundant (#77). Grace asked to save the work to the punch list for another session. This is
the one gap on the Combined side. It needs no owner call, because it is a copy that loses data.

## What is wrong

- **The boxes** live in `bid_takeoff_stage_splits` (v2.3671). There is one row per scope: a
  fixture (`count_row_id`), a part line (`line_id`, a foreign key to
  `bids_takeoff_rough_part_lines`), or a part inside a bundle line (`line_id` + `part_id`). The
  row has no version column. A version's boxes are the rows whose count rows belong to that
  version.
- **`create_bid_version`** (newest body `20260827191047_clone_all_prices_on_new_bid_version.sql`)
  inserts the source version's rough lines under the new version without `order_increment` or
  `order_increment_unit`. Those columns were added after the function was last rewritten, in
  `20260914120000_order_increments.sql` (v2.3406). It never touches the boxes.
  `clone_count_rows_to_bid_version` (`20260823034820_count_rows_per_version.sql`) re-keys the
  lines, the mappings, custom prices, hides and assignments onto the cloned count rows through
  its `v_map`. The boxes are not in that list.
- **`duplicate_bid_to_service_type`** (newest body `20260929230000_bids_alternate_group_tags.sql`)
  has the same two gaps.
- **`adopt_bid_as_version`** (`20260823041240_adopt_bid_as_version.sql`) moves the count rows
  and lines to the target bid, keeping their ids, so the boxes still point at the right rows.
  But their `bid_id` stays the source's, and `loadStageSplitsForBid` reads by `bid_id`. The
  target never sees them.
- **`materialize_bid_version`** moves rows in place, keeping ids and `bid_id`, so its boxes
  survive. Check it, but it needs no change.

## The fix

One migration starting with `SET lock_timeout = '3s';`. Use `CREATE OR REPLACE` from the newest
body of each function: grep every migration for the name first.

1. **Order rules:** add `order_increment, order_increment_unit` to the rough-line copy in both
   `create_bid_version` and `duplicate_bid_to_service_type`.
2. **Boxes on a new version or a duplicate:** copy the source's boxes onto the new rows.
   - **Fixture boxes** re-key through the count-row map (`v_map` in
     `clone_count_rows_to_bid_version`; the duplicate builds its own).
   - **Line and part boxes** need an old-line → new-line map. Mint the new ids first: one
     `gen_random_uuid()` per source line, in a temp table or CTE. Insert the lines with those
     ids, then insert the boxes through the same map. An `INSERT … RETURNING` does not promise
     the source order, so it cannot pair the rows by position.
   - Keep `source` (`hand`, `rule`, `book` or `assembly`) as is.
3. **Adopt:** `UPDATE bid_takeoff_stage_splits SET bid_id = p_target_bid_id` for the rows whose
   `count_row_id` moved.
4. Add `docs/migrations/<version>_<slug>.md`, and run `supabase db push` after the merge.

## How to verify

- Dry-run the migration and a copy inside `BEGIN … ROLLBACK` with psql over the session pooler
  (`docs/DB_FREEZE_RUNBOOK.md`):
  - Create a version of B490 *Shipley Do-Nuts*, which has 4 boxes. The new version's count rows
    and lines carry the same weights.
  - Duplicate it into another trade. The copy carries the same weights too.
  - Give a line an order rule first, then check that both copies keep it.
- After the push, make a version of a ZZ test bid in the app. Its Stages panel on Takeoffs reads
  the same shares as the source's. Delete the version afterwards.
- Prod on 2026-10-01: 6 boxes on B375 and B490, no line with an order rule, and 47 bid versions.
