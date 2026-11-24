# 20261123190000_agreements_party_join_by_key.sql (2026-11-23, a party's paper finds its record by the record's key, v2.8389)

Punch list #430, the first of its two views. One migration on a view. No client change, no edge function.

- **The cause.** `agreements_on_file` finds the customer, the supply house and the trade company behind a party's paper with three joins written as an equality onto a `COALESCE`: `pcu.id = COALESCE(pc.customer_id, pcp.customer_id)`, and the same for `supply_houses` and `gc_companies`. Postgres uses a join clause as an index condition on a table with row policies only when it can prove the clause leaks nothing, and it does not prove that of a `COALESCE` (the rule in `docs/MIGRATIONS.md`, from v2.8301). Where a table's policy reads one of its own columns, as `customers`' does, the join becomes a filter over the whole table under its policies instead of a lookup by its key.
- **The joins are a `CASE` now**, which says the same thing and which Postgres does trust: `pcu.id = CASE WHEN pc.customer_id IS NOT NULL THEN pc.customer_id ELSE pcp.customer_id END`, and the same for the other two. Each `CASE` picks the id the `COALESCE` picked, so every line is the same.
- **Nothing else changes.** The view is restated from `20261123083000_agreements_every_party_paper.sql` word for word but those three lines: the five branches, the columns and their order, `security_invoker`, the comment and the grant.

## Measured before it was written

No read-only path to a plan on prod was open from this session: the Supabase CLI at 2.72.7 has no verb that runs a query, the session pooler needs a database password this machine does not hold, and the dev seat reads through PostgREST, which hands back rows and no plan. A one-line read of the view as a dev through the dev seat answered. The shape was proved on a local Postgres 15 instead, as a role under a policy that reads a column: with the `COALESCE` the join is a `Join Filter` over a `Materialize` of the whole table, and with the `CASE` it is an `Index Cond` on the primary key; with the planner left free, the `COALESCE` hashes the whole table under its policy, 5,000 rows for 200 lines, and the `CASE` looks up 200 rows by key.

## How the view's security holds

Unchanged. The view is `security_invoker`, restated in this file, so every table under it is read under the caller's own policies. Each new join condition names the same columns as the old one and returns the same record.

## The bed

The SQL bed `paper-party` (`scripts/pgtest-paper-party.sh`, `supabase/tests/paper_party/20_scenario.sql`) applies this file twice, last. Its section 9 sends three papers through a person at a record (a trade company's person, a person at the customer, a rep at the insurer), checks that the papers reach their party through all six records and through none, then rebuilds the view as it stood from the live definition, each `CASE` put back as its `COALESCE`. It asserts that a dev, a master technician, the controller, the assistant and an estimator each read the same lines from both, that a paper through a person is named by the record found through the person, and that the plan of one paper's line, with sequential scans, hash joins and merge joins priced out, finds the customer and the supply house by their keys, where the view before did not find the customer so. The trade company's lookup is logged and not held: the bed's handful of people at trade companies is walked whole even on a plain equality, a sizing choice the planner makes whatever the join is written as.

**No table is made**, so the fence calls are not needed; nothing here writes. `CREATE OR REPLACE VIEW` with the same columns in the same order, so the file is safe to run twice.

Apply order: either way round. The client reads the same columns from the old view and the new one. Push after the merge. No types regen and no dev-mcp catalog rebuild: the view's columns are unchanged.
