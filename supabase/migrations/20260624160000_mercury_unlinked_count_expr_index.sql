-- Speed up the Tally "unlinked Mercury transactions" badge / counts.
--
-- count_unlinked_mercury_transactions_for_tally() and its siblings
-- (count_unlinked_mercury_transactions_for_tally_stale, list_stale_unlinked_*)
-- join mercury_transactions to the caller's debit-card links on the COMPUTED
-- key public.mercury_debit_card_id_from_raw(raw). With no index on that
-- expression the planner can only Seq Scan all ~11.4k mercury_transactions and
-- evaluate the JSON-extraction function once per row to build the join:
--
--   Hash Join  Hash Cond: (mercury_debit_card_id_from_raw(t.raw) = l.mercury_debit_card_id)
--     ->  Seq Scan on mercury_transactions t  (rows=11428)  Filter: duplicate_of_transaction_id IS NULL
--
-- Measured 2026-06-24: ~360 ms warm, and it touches the whole 29 MB hot table
-- on every call; cold (e.g. the first call right after the 2026-06-24 restart)
-- it was ~6.8 s. This is pure cache/CPU churn on a small instance and adds to
-- connection pressure during load spikes.
--
-- mercury_debit_card_id_from_raw(jsonb) is IMMUTABLE PARALLEL SAFE, so the
-- expression is indexable. Partial on (duplicate_of_transaction_id IS NULL) to
-- match every caller's WHERE clause and keep the index small. The planner can
-- then probe the index for the caller's handful of debit-card ids instead of
-- scanning + JSON-parsing the entire table (the two NOT EXISTS anti-joins
-- already have their mercury_transaction_id indexes).
--
-- Idempotent / drift-safe. mercury_transactions is small (29 MB) so a plain
-- CREATE INDEX builds in well under a second; if you would rather build it with
-- zero write-lock on a busy moment, run the same statement by hand with
-- CREATE INDEX CONCURRENTLY (cannot run inside a migration transaction).
create index if not exists mercury_transactions_unlinked_debit_card_idx
  on public.mercury_transactions (public.mercury_debit_card_id_from_raw(raw))
  where duplicate_of_transaction_id is null;

analyze public.mercury_transactions;
