# 20261009180000_bid_history_paged.sql (2026-10-08, v2.4963)

Bid history, the row cap (punch list #73; [`docs/TROUBLESHOOTING.md`](../TROUBLESHOOTING.md) `[row-cap]`). PostgREST answers any read with at most 1,000 rows and no error. `list_bid_history` returned exactly 1,000 for a dev on ZZ Test (34 ledger rows, 966 archive rows), so its oldest changes were cut without a word. The client now reads both history functions a page at a time with `.range()`. This file makes those pages safe.

- **`list_bid_history(p_bid_id, p_limit)`**: the body of `20261009060000` with three changes.
  - Its order is total: `changed_at DESC, id DESC NULLS LAST, archive_id DESC`. An archive row has no ledger id, and a cascade removes many rows at one `deleted_at`, so before this the pages could shuffle.
  - `p_limit` now defaults to `NULL`, which means no cap of its own. It was 2,000, which would have emptied every page past the second.
  - A given `p_limit` still bounds the read.
- **`latest_bid_cell_history(p_bid_id)`**: the body of `20261009090000` with its order made total (`cell_key, kind, rank, name_key, changed_at, label`).

Same signatures, same `SECURITY INVOKER`, same grants (`CREATE OR REPLACE` keeps them); `SET lock_timeout = '3s'`; no table touched. Apply order: after `20261009090000`, which defines the cells' function. The client works against either body: on the old one a page past 2,000 rows comes back empty.

Tests: on a scratch Postgres 15 with stubs, the file applied twice. Then a bid with 1,001 ledger rows at one instant and three archive rows removed together:
- read in two pages (1,000 and the rest), every row once;
- the whole read in the same order twice;
- `p_limit` 5 returns 5.

The client's paging is tested with the fake capped client (`loadBidHistory.test.ts`) and in the window (`BidHistoryWindow.render.test.tsx`: a 1,001-row bid shows all of them after *Show older changes*).
