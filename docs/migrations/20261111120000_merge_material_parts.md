# 20261111120000_merge_material_parts — two copies of one part merged into one (v2.6921, punch list #308 PR 8)

**File**: `supabase/migrations/20261111120000_merge_material_parts.sql`
**Card**: `to-dos/price-sheet-reader/README.md`

## What it adds

| Object | What it does |
| --- | --- |
| `merge_material_parts(p_keep, p_drop)` | Moves everything that points at `p_drop` to `p_keep` in one transaction, then deletes `p_drop`. Returns `{prices_moved, prices_merged, assemblies, takeoff_lines, purchase_order_lines, house_numbers, also_known_as}`. |
| `material_part_distinct_pairs` | Two parts a person said are not the same: `low_part_id`, `high_part_id` (the lower id first, by a check), who and when. A pair goes with either part. |

## What the merge moves, table by table

| Table | Rule |
| --- | --- |
| `material_part_prices` | A price only the copy had moves over. Where both have one from the same house, the newer dated price stays on the survivor's row (a dated price over an undated one; on a tie, the survivor's), the takeoff lines whose `source_material_part_price_id` named the copy's row are pointed at the survivor's, and the copy's row is deleted. |
| `material_part_price_history` | Moved. |
| `material_template_items` | Moved. An assembly that held both holds the survivor once, the quantities summed (one part appears once in an assembly). |
| `bid_takeoff_stage_splits` | Moved; the copy's split is dropped where the survivor already has one for the same row and line. |
| `bids_takeoff_rough_part_lines`, `purchase_order_items`, `jobs_tally_parts`, `bids_tally_parts`, `bid_submittal_item_parts`, `job_material_movements`, `supply_paper_lines`, `supply_part_codes` | Moved. |
| `material_parts` | The survivor's notes gain *Also known as: ‹the copy's name›* unless they already say it; a maker, link, part type or order increment the survivor lacks is taken from the copy. The copy is deleted. |

## Refusals

- The same part twice, a part that is not in the book, parts of two service types, a robot's part.
- The gates of `price_sheet_gate`: signed in, `may_edit_parts_book()`, not read-only, not a digital twin, not archived.
- A takeoff line in a version someone else locked: the `bid_version_lock_guard` trigger raises its own words and the whole merge rolls back.

## Access

`EXECUTE` to `authenticated` and the service role, revoked from `anon`. `material_part_distinct_pairs`: read, insert and delete for `may_edit_parts_book()`. One table is new, so the migration ends with the four fence appliers.

## Bed

`npm run test:pg:price-sheets`, 114 checks.

**Applied** to prod by 2026-11-11: `npm run check:migration-drift` read 1239 local files and 1239 remote versions, fully applied (read in the docs pass after #7525); types regenerated in #7651.
