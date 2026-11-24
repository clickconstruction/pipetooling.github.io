# 20261123193000_people_hours_recorded_pay_join_by_key.sql (2026-11-23, recorded time finds a person's pay row by its key, v2.8392)

Punch list #430, the second of its two views. One migration on a view. No client change, no edge function.

- **The cause.** `people_hours_recorded`, the view job costing reads, joins the pay config as `pc.person_name = COALESCE(ph.person_name, p.person_name)`: the name from whichever side of the view's `FULL OUTER JOIN` has the row. Postgres uses a join clause as an index condition on a table with row policies only when it can prove the clause leaks nothing, and it does not prove that of a `COALESCE` (the rule in `docs/MIGRATIONS.md`, from v2.8301). `people_pay_config`'s self-read policy reads `person_name`, so the join became a filter over every pay row under its policies, for every person-day the view hands back, instead of a lookup by the primary key.
- **The join is a `CASE` now**, which says the same thing and which Postgres does trust: `pc.person_name = CASE WHEN ph.person_name IS NOT NULL THEN ph.person_name ELSE p.person_name END`. It picks the name the `COALESCE` picked, so every row is the same.
- **Nothing else changes.** The view is restated from its only definition, `20260909022534_recorded_time_costing.sql`, word for word but that line. The `person_name` column still reads the `COALESCE`: one in the select list costs nothing. The six columns and their order, `security_invoker`, the comment and the grant are as they were.

## Who reads it

A job's Cost and Labor panels and Jobs crew P&L (`src/utils/teamLabor.ts` and its edge copy), bid labor and pricing, the Projects board, the Pipeline board's man-hours (`get_man_hours_by_job`) and the cost functions `20261118190000_salaried_week_in_cost_functions.sql` restated. None changes: the columns are the same.

## Measured before it was written

No read-only path to a plan on prod was open from this session: the Supabase CLI at 2.72.7 has no verb that runs a query, the session pooler needs a database password this machine does not hold, and the dev seat reads through PostgREST, which hands back rows and no plan. A one-line read of the view as a dev through the dev seat answered. The shape was proved on a local Postgres 15 instead, as a role under a policy that reads a column, with the view's own full join: with the `COALESCE` the pay rows are a `Join Filter` over a `Materialize` of the whole table, and with the `CASE` they are an `Index Cond` on the primary key.

## How the view's security holds

Unchanged. The view is `security_invoker`, restated in this file, so every table under it is read under the caller's own policies. The new join condition names the same columns as the old one and returns the same pay row.

## The bed

The SQL bed `people-hours-recorded` (`scripts/pgtest-people-hours-recorded.sh`, `supabase/tests/people_hours_recorded/20_scenario.sql`), new with this file, applies it twice. It seeds every side of the full join, each with a pay row and without one: approved hours alone, pending hours alone, both on one day, an hours row that names no person, and a person on no list. It rebuilds the view as it stood from the live definition with the `COALESCE` back, and asserts that a dev, the assistant, a pay-approved master and a crew member reading their own time each read the same rows from both, and that the plan, with sequential scans, hash joins and merge joins priced out, finds the pay row by its key where the view before did not.

**No table is made**, so the fence calls are not needed; nothing here writes. `CREATE OR REPLACE VIEW` with the same six columns in the same order, so the file is safe to run twice.

Apply order: either way round. The client reads the same columns from the old view and the new one. Push after the merge. No types regen and no dev-mcp catalog rebuild: the view's columns are unchanged.
