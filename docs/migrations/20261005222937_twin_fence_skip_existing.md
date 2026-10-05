# 20261005222937_twin_fence_skip_existing.sql (2026-10-05, v2.4604)

`apply_digital_twin_write_blocks()` goes incremental. It ran `DROP POLICY IF EXISTS` + `CREATE POLICY` for all three `digital_twin_write_fence_*` policies on every RLS-enabled public table (~250), unconditionally. Both statements take an ACCESS EXCLUSIVE lock, which blocks even SELECTs, and every lock is held until the migration commits. So each CREATE TABLE migration that ends with the call (`20261005173119_sent_documents.sql`, `20261005155515_lien_owner_record_requests.sql`, `20260928050129_contract_text_history.sql`, …) locked the app's tables one after another for the rest of its push. A slow query on any table stalled the sweep for the whole `lock_timeout`, with every table already locked still queued behind it. Same hazard `20260814185815_read_only_stmt_blocks_skip_existing.sql` fixed for `apply_read_only_stmt_blocks()`.

The new body only visits tables that lack at least one of the three policies (counted by name in `pg_policy`), and on those it creates only the missing ones; it never drops. The per-table allowance chain is v3's byte for byte (`20260830210000_robot_price_research.sql`, lines 41–103). Same signature and return value (the number of policies created), so a rerun on a fully fenced database returns 0 and no types regen is needed.

**Discipline change**, recorded in the function COMMENT: a plain rerun no longer rebuilds an existing fence. To change an allowance, including an existing table gaining a `bid_id` or `cost_estimate_id` column (which changes its derived allowance), ship a one-off migration that drops the affected `digital_twin_write_fence_*` policies and then calls the helper. Same discipline as the read-only stmt blocks.

The file ends with a self-test call of the new body. Every RLS table in prod already carries all three policies (`20261005173119` ran the old full rebuild and `20261005181927` created no table), so it creates 0 policies and takes no table locks. The old full rebuild is never called.

Rehearsed on a throwaway Postgres 15.14 (prod is 17.6): one table per branch of the allowance chain (22 RLS tables), plus a table with RLS off, a partitioned table and a table outside `public` that both versions must skip.

- v3 rerun with every table fenced: recreated all 66 policies and held ACCESS EXCLUSIVE on all 22 tables.
- This file applied as `db push` would: self-test returned 0, policies unchanged, COMMENT replaced, still `SECURITY DEFINER` with `search_path=public`.
- New rerun with every table fenced: 0 created, no lock of any mode on any user table.
- Every fence policy dropped, then rebuilt by the new body: every policy (command, permissive, roles, USING, WITH CHECK) identical to v3's on all 22 tables.
- New RLS table: 3 created, ACCESS EXCLUSIVE on that table only, policies identical to what v3 produces.
- One policy dropped on one table: 1 recreated, only that table locked.
- A 7 s query holding `jobs`: v3's sweep held ACCESS EXCLUSIVE on the tables it had passed, a 1 s-timeout read of one of them was canceled, and the sweep died on `lock_timeout`. The new body returned 0 at once and the read went through.

Apply: `supabase db push` any time after merge. `CREATE OR REPLACE FUNCTION` + `COMMENT` + the self-test, no client coupling.
