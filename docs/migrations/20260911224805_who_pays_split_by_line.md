# 20260911224805_who_pays_split_by_line.sql (2026-09-11, v2.3349)

Who pays the bill, PR 3 (fragment `docs/recent-features/v2.3349.md`): `jobs_ledger_fixtures.bill_to_party text` with CHECK `jobs_ledger_fixtures_bill_to_party_check` (NULL · `customer` · `gc`) — who pays one work line on a split job; the per-payer carve groups untagged-by-invoice rows by it. Additive, idempotent; no RLS change (the fixtures table's existing policies govern writes); no CREATE TABLE. Push as the PR merges — the client's fixtures embed and the autosave reinsert name the column.
