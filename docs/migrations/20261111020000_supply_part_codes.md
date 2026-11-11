# 20261111020000_supply_part_codes — what each supply house calls a part (v2.6901, punch list #308 PR 2)

**File**: `supabase/migrations/20261111020000_supply_part_codes.sql`
**Card**: `to-dos/price-sheet-reader/README.md`

## What it adds

The parts book knows a part by its name alone, and every supply house writes the name its own way. Each house prints its own number for the part on every quote and bill. This migration gives that number a home, so the next paper from the house finds the part with no press. It is the crosswalk punch list #298 designed as its stage 2 and had not built.

| Object | What it holds |
| --- | --- |
| `supply_part_codes` | One row per house and number: `code` as printed; `code_key`, generated, the code with everything but letters and digits removed and upper-cased; `part_id`, or `not_a_part` for a house's catch-all number; `unit_factor`, how many of the book's units one of the house's prices covers; `taught_by`, `taught_from` (`typed` · `name` · `notes` · `sheet` · `bill`) and `taught_line_id`, the paper line it was learned on. |
| `may_edit_parts_book()` | The role list every parts book policy repeats (`dev`, `master_technician`, `assistant`, `controller`, `estimator`, `primary`, `superintendent`) as one function. SECURITY DEFINER, stable, `EXECUTE` to `authenticated` and the service role, revoked from `anon`. |

## The rules the table holds

- **One number means one thing at a house**: unique on (`supply_house_id`, `code_key`). `512-207` and `512 207` are one number. The same number is free at another house.
- **A part or not a part, never both and never neither**: `supply_part_codes_part_or_not`.
- **A number has a letter or a digit**: `supply_part_codes_key_not_empty`.
- **`unit_factor` is above zero**, 1 by default.
- **A number goes with its part and with its house**: both are `ON DELETE CASCADE`. A merge of two parts (PR 9) moves them first.

## Access

Read, insert, update and delete for `may_edit_parts_book()`, the same people who edit `material_part_prices`. Nothing for `anon`. The migration ends with the four fence appliers, so a read-only account, a digital twin and an archived caller are held as on every table.

## Additive and idempotent

`CREATE … IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` before each policy. The bed applies it twice. No existing table changes.

## Bed

`npm run test:pg:price-sheets` (`scripts/pgtest-price-sheets.sh`, `supabase/tests/price_sheets/20_scenario.sql`), 19 checks through RLS inside one transaction that rolls back.
