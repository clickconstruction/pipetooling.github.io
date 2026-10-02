# 20261002100000_combined_copies_keep_stages.sql (2026-10-01, v2.4388)

Punch list #78. `CREATE OR REPLACE` of the four functions that copy or move a bid's Combined takeoff, plus one repair `UPDATE`. Same signatures, so owners and grants stay. Each body is the newest one on main with additions only; the note at the top of the file names the migration each came from.

**What a copy lost before.** A stage box (`bid_takeoff_stage_splits`, v2.3671) sits on a fixture (`count_row_id`), on a part line (`line_id`) or on a part inside a bundle line (`line_id` + `part_id`). It has no version column: a version's boxes are the rows whose count row or line belongs to it. The Sold in rule (`order_increment`, `order_increment_unit`, v2.3406) is a snapshot on the part line. All three copies were last written before either existed.

| Function | Before | Now |
|---|---|---|
| `clone_count_rows_to_bid_version` | cloned the count rows and re-keyed five children | also copies each fixture's box onto its clone |
| `create_bid_version` | copied the lines without their order rule, and no boxes | mints the new line ids first (a `jsonb` map, source line → new line), copies the lines with their order rule, and after the count-row clone copies each line and part box onto the cloned line |
| `duplicate_bid_to_service_type` | the same two gaps | a second temp map (`_dup_bid_line_map`) beside the count-row map; the lines keep their order rule; every box is copied, found by the row it sits on |
| `adopt_bid_as_version` | moved the rows and lines, left the boxes under the retired bid | moves the boxes' `bid_id` with them |

`materialize_bid_version` moves rows in place and keeps their ids, so a first split always kept its boxes. It is unchanged.

**Why the ids are minted first.** A line box needs its line's copy. `INSERT … RETURNING` does not promise the source order, so the copies cannot be paired by position.

**The duplicate also catches up on eight columns** added since it was written: `cost_estimate_labor_rows.kind`, `unit`, `source` and `source_note` (v2.3291: a sub line or a per 100 ft row copied without `kind` and `unit` was costed as a counted fixture) and `cost_estimates.travel_people`, `travel_nights`, `travel_meals_rate` and `travel_hotel_rate`.

**The repair.** `UPDATE bid_takeoff_stage_splits SET bid_id = <its count row's bid_id>` where the two differ: the boxes an earlier adopt left behind. `loadStageSplitsForBid` reads by `bid_id`, so those boxes were not lost, only unread. A second run finds none.

**RLS.** All four functions are `SECURITY INVOKER`, so the box inserts and updates pass the same policies as a box set by hand: the bid-pricing roles and `can_access_bid_for_pricing`. A training (`read_only`) account and a digital twin are refused as before.

**Tested on a throwaway copy of the whole schema** (`npm run test:pg:combined-copies`: the Supabase Postgres image, every migration applied in order, the scenario run as an estimator through RLS inside a transaction that rolls back). Against the old functions the scenario fails at its second step: a new version's `Copper main` line reads no order rule where the source reads `20 | ft_stick`. With this migration all fifteen steps pass: a first split, a new version, a version of a version, a duplicate into another trade and in the same trade, an adopt, and the repair on four orphaned boxes. The migration was not dry-run on prod: this session had no database access to it.

[`bidCopySql.test.ts`](../../src/lib/bids/bidCopySql.test.ts) pins the newest bodies to the generated types. A column added to a copied table, or a new table with `bid_id` and `count_row_id`, fails there until the copies learn it.

**Left for punch list #79:** quoted fixture costs (`bid_count_row_custom_costs`) follow no copy; a duplicate of a bid with versions stacks every version's rows; a duplicate keeps pointing at the first bid's own prices; an adopt leaves `bid_submittal_takeoff_choices` behind.

Apply with `supabase db push` after the PR merges. No client change, so deploy order does not matter, and the types do not change.
