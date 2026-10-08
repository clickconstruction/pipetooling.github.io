# 20261009090000_latest_bid_cell_history.sql (2026-10-08, v2.4952)

Bid history PR 3 (punch list #73, [`to-dos/bid-history`](../../to-dos/bid-history/README.md)): the narrow read behind **Past values**, the earlier values under the cells. Loading a bid's whole ledger to draw a tab would not last, so this returns only what the cells draw.

`latest_bid_cell_history(p_bid_id uuid)` returns one row per earlier value, keyed the way each tab finds its cell:

| Key | The cell |
|---|---|
| `price:<count row>:<pricing>` | a Workbench price. The typed price lives in `bid_count_row_custom_prices.unit_price`, or in `bid_pricing_assignments.unit_price_override` when a book pick exists; both read as one price history. The pricing is the old row's `price_book_version_id`, else the live row's. |
| `count:<count row>` | a count (`bids_count_rows.count`) |
| `takeoff:<part line>:<column>` | a takeoff line's `quantity` or `unit_price` |
| `labor:<labor row>:<column>` | a labor row's `rough_in_hrs_per_unit`, `top_out_hrs_per_unit` or `trim_set_hrs_per_unit` |

- `kind = 'changed'`: the old side of each update that touched the column, ranked newest first; ranks 1 and 2 are returned, with `total` the cell's count of changes (the client's *+N more*).
- `kind = 'removed'`: the value a removed row had when it went, rank 1 per `name_key`. The name key is the row's label lowercased, with the pricing (prices), the version (counts) or the column (labor hours), so a re-imported Lav-1 (a new row, a new id) shows *an earlier Lav-1 row*. Takeoff lines have no name key: one part sits on many count rows.
- `column_name` is the column the value is worded by (`unit_price` for both price sources); `changed_by_name` is the author's `users.name`.

**SECURITY INVOKER**: the ledger, and the live rows a price's pricing is read from, under the caller's own policies, so whoever can read the bid. The delete archive is not read: a removed row's value comes from the ledger's own delete row, so the label fallback covers removals since the ledger began (2026-10-06).

A function only (`CREATE OR REPLACE`), no table touched; `SET lock_timeout = '3s'`. `EXECUTE` revoked from `PUBLIC` and `anon`, granted to `authenticated`. Apply order: either. Before it exists the read fails and the cells show no past. Regenerate `src/types/database.ts` and the dev-mcp catalog after the push (the function is hand-added to the types).

Tests: `npm run test:pg:bid-changes` case 18 (runs on GitHub in `sql-beds.yml`). On a scratch Postgres 15 with stubs: a price changed three times from the custom-price table returns its two newest old values with total 3, keyed by count row and pricing; a removed SUMP returns its count and its price under their name keys.
