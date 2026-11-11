# 20261111100000_price_sheet_fixtures — a price sheet's fixtures placed on the takeoff (v2.6916, punch list #308 PR 6)

**File**: `supabase/migrations/20261111100000_price_sheet_fixtures.sql`
**Card**: `to-dos/price-sheet-reader/README.md`

The assembly, its bundle price and the takeoff line are written by the client under the caller's own row level security, as the Add Assembly window writes them. This migration only lets the sheet remember what it placed.

| Object | Change |
| --- | --- |
| `supply_paper_groups` | `count_row_ids uuid[]` and `placed_line_ids uuid[]` (one heading may name two tags), `bundle_price`, `replaced_bundle_price`, `replaced_bundle_effective_date`, `made_template`. The single `count_row_id` and `placed_line_id` from [`20261111060000`](./20261111060000_price_sheets.md) carry the first of each. |
| `price_sheet_group_place(group_id, p)` | Records a placement on a fixture that is not placed: the assembly, the bid's rows, the takeoff lines, the bundle price set and the one replaced, and whether the assembly was made for it. Needs an assembly on file and at least one line. |
| `price_sheet_group_unplace(group_id)` | Clears it. |
| `price_sheet_take_back(paper_id)` | The body [`20261111080000`](./20261111080000_price_sheet_filing.md) holds, plus a refusal while any fixture of the sheet is placed: *Fixtures of this sheet are on a takeoff. Take them off first.* |

Each function is SECURITY DEFINER behind `price_sheet_gate`, `EXECUTE` to `authenticated` and the service role, revoked from `anon`. No table is new, so no fence applier runs. Additive and idempotent; the bed applies it twice.

## Bed

`npm run test:pg:price-sheets`, 97 checks.

**Applied** to prod by 2026-11-11: `npm run check:migration-drift` read 1239 local files and 1239 remote versions, fully applied (read in the docs pass after #7525); types regenerated in #7651.
