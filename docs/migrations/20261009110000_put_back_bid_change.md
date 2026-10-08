# 20261009110000_put_back_bid_change.sql (2026-10-08, v2.4954)

Bid history PR 4 (punch list #73, [`to-dos/bid-history`](../../to-dos/bid-history/README.md)): Put back for a value. The ledger row names the table, the row and the columns and holds their old values, so one function puts a value back on every table the ledger covers.

`put_back_bid_change(p_change_id bigint, p_column text DEFAULT NULL) RETURNS jsonb`:

1. Reads the change from `bid_changes` under the caller's policies. Someone who cannot read the bid gets *That change is not in this bid's history.*
2. Refuses anything but an update (*Only a changed value can be put back. A removed row comes back another way.*), a table outside `bid_changes_tables()`, or a column the change never touched.
3. Writes the column (or, with `p_column` null, every column the change touched) still on the table, never a key, a stamp or a generated column. The value comes from the change's `old_values` through `jsonb_populate_record`, so each column takes its own type.
4. Before the write it sets `x-bid-action: put-back` on the request's headers, so `record_bid_change()` records the write as the caller's change tagged `put-back` (`by_app` false). It puts the headers back after.
5. Returns `{table, record_id, label, columns, before, after}`: the columns' values before and after, so the client can say *Lav-1 price is $9,800 again.* or *was already*.

Refusals, in words the window shows as they are:
- *That row was removed since. Put the row back first.*
- *Another row already has that value…* (a unique key)
- *What that value pointed to was removed…* (a foreign key)
- *You cannot change this bid, so nothing was put back.* (the update reached no row under the caller's policies)

**SECURITY INVOKER**, on purpose: the write runs under the caller's own policies on that table. Only someone who can edit the bid can put a value back (the owner, 2026-10-08), and a read-only user or a digital twin is held by the same restrictive policies and statement blocks as any edit.

A function only (`CREATE OR REPLACE`), no table touched; `SET lock_timeout = '3s'`. `EXECUTE` revoked from `PUBLIC` and `anon`, granted to `authenticated`. Apply order: either. Before it exists, Put back says *Put back is not ready yet.* Regenerate `src/types/database.ts` and the dev-mcp catalog after the push (the function is hand-added to the types).

Tests: `npm run test:pg:bid-changes` case 19 (runs on GitHub in `sql-beds.yml`):
- the estimator puts Lav-1's price back from $10,450 to $10,300;
- the ledger records it as hers, tagged `put-back`, a press, and the tag ends with the call;
- a removal is refused;
- a trainee (read only) and someone who cannot read the bid are refused, and the price stays.

On a scratch Postgres 15 with stubs: the file applied twice. A put back and a second one that finds it already done both ran. A row trigger saw the tag during the write, and the headers were back after. The four refusals are worded.
