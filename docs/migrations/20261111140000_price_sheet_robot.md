# 20261111140000 — price_sheet_robot

**Shipped in:** v2.6923 (punch list #308, PR 9)

## What it does

Adds one nullable column, `supply_papers.robot_request_id`, a reference to `bid_price_matrix_requests(id)` that is set to null when the request is deleted, and a partial index on it.

## Why

The pricing twin reads a bid's quote PDFs for a request the estimator queued. `twin-mcp put_price_sheet` leaves what it read as a price sheet draft: one `supply_papers` row of kind `quote` with its groups and lines. The column ties the draft to the request, so the same house on the same request is one sheet, rewritten only on the twin's own word and never once a person has filed a row of it.

## Safety

- Starts with `SET lock_timeout = '3s';`. `ADD COLUMN IF NOT EXISTS` with no default is a catalog change, and the foreign key is validated against a column that is null on every row.
- Additive and idempotent. No table is new, so no fence applier runs.
- No policy changes: the twin writes through the service role in `twin-mcp`, and the estimator reads the paper through the quote read policy from `20261111040000_price_rows.sql`.

## Order

Push after the PR merges and before `twin-mcp` is deployed. The old function never writes the column, and the new function would be refused its insert without it.

## Tested

`scripts/pgtest-price-sheets.sh` (section 32 of `supabase/tests/price_sheets/20_scenario.sql`).

**Applied** to prod by 2026-11-11: `npm run check:migration-drift` read 1239 local files and 1239 remote versions, fully applied (read in the docs pass after #7525); types regenerated in #7651.
