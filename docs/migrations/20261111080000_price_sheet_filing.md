# 20261111080000_price_sheet_filing — a sheet's ready rows in one press, and a whole sheet taken back (v2.6911, punch list #308 PR 5)

**File**: `supabase/migrations/20261111080000_price_sheet_filing.sql`
**Card**: `to-dos/price-sheet-reader/README.md`

Three `CREATE OR REPLACE`, no table change.

| Function | Change |
| --- | --- |
| `price_row_file(p jsonb)` | The body [`20261111040000`](./20261111040000_price_rows.md) holds, plus one branch: a row of a sheet (`line_id` given) with no `unit_price` is filed with no price. The row gets its part, how it was matched, when and by whom; the house's number is kept on the part (`taught_from = 'sheet'`); nothing is written to `material_part_prices`. A one-off with no price is still refused. Returns `price: null`. |
| `price_row_take_back(line_id)` | The same body, plus: a row that filed no price is unfiled and the number it taught is removed. Its part stays on the row as the person's pick. |
| `price_sheet_take_back(paper_id)` | New. Takes back every filed row of a sheet, newest first, through `price_row_take_back`. Returns `{restored, left}`; `left` counts the rows whose price somebody changed since, which stay as they are. Behind `price_sheet_gate`. |

`EXECUTE` on each to `authenticated` and the service role, revoked from `anon`, stated again after each replace.

## Bed

`npm run test:pg:price-sheets`, 89 checks.
