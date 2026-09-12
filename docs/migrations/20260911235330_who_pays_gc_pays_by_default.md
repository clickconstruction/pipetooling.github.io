# 20260911235330_who_pays_gc_pays_by_default.sql (2026-09-11, v2.3353)

Who pays the bill, PR 5 (fragment `docs/recent-features/v2.3353.md`): `customers.gc_pays_by_default boolean NOT NULL DEFAULT false` — when this customer is the GC on a job, new jobs default to `bill_to_party = gc`. Additive, idempotent; the customers table's existing RLS governs writes; no CREATE TABLE. Push as the PR merges (the job form's customers selects name the column).
