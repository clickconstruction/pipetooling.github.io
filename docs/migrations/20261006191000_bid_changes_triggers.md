# 20261006191000_bid_changes_triggers.sql (2026-10-05, v2.4598)

Bid history, PR 1, file 2 of 2 (punch list #73): attaches `record_bid_change()` (from [`20261006190000_bid_changes`](20261006190000_bid_changes.md)) as `record_bid_change`, `AFTER INSERT OR UPDATE OR DELETE … FOR EACH ROW`, to the seventeen tables `bid_changes_tables()` lists. On `bids` the update side is `UPDATE OF` the 48 columns `bid_changes_bid_columns()` keeps. Nothing else is in the file: history starts the moment it commits.

## Why a file of its own

`CREATE TRIGGER` takes SHARE ROW EXCLUSIVE on its table: writes to that table wait, reads never do, and every lock taken is held until the file commits. Alone in its file, the seventeen locks are held for seventeen catalog inserts. Ordered least-written first and `bids` last, the hottest locks are held the shortest. In one file with the ledger, they would also have been held through the read-only block pass. A table that already has its trigger is skipped without taking a lock, so the file is safe to re-run alone.

## Deploy note

1. **File order.** `supabase db push` applies `20261006190000_bid_changes` first, then `20261006191000_bid_changes_triggers`, each in its own transaction. Push in a quiet moment (evenings): only the second file waits on bid writes.
2. **If the second file trips its lock timeout** (`canceling statement due to lock timeout`): the first file is already applied and recorded, and the second rolled back whole, so no table has a trigger and no save was affected beyond a wait of up to three seconds. Run `supabase db push` again at a quieter moment. It applies the second file alone.
3. **The one query that proves capture is live** (expect `17`, then a recent `last_change` once anyone saves a bid):

   ```sql
   SELECT (SELECT count(*) FROM pg_trigger WHERE tgname = 'record_bid_change' AND NOT tgisinternal) AS triggers,
          (SELECT count(*) FROM public.bid_changes) AS rows_so_far,
          (SELECT max(changed_at) FROM public.bid_changes) AS last_change;
   ```

4. **For the first hour, watch the database log for `record_bid_change on`** (Supabase → Logs → Postgres). A caught failure leaves a warning and no row, and the warning is its only sign. Any warning there means a table is not recording, and the warning names the table and the error.
5. **A day after the push, list the seventeen tables with their ledger rows so far.** A zero on a table people wrote that day means it is not recording. The direct-cost tables are written rarely, so a zero there needs a check on a ZZ test bid before it means anything.

   ```sql
   SELECT t.table_name, count(c.id) AS rows_since_push, max(c.changed_at) AS last_row
   FROM unnest(public.bid_changes_tables()) AS t(table_name)
   LEFT JOIN public.bid_changes c ON c.table_name = t.table_name
   GROUP BY t.table_name
   ORDER BY count(c.id), t.table_name;
   ```

## Can a trigger error reach the person saving?

Not from the ledger's own work: the function catches every error inside it (`WHEN OTHERS`) and raises a warning, which PostgREST does not pass on. The scratch scenario renames `bid_changes`, then makes every write to it fail. An insert, an update and a delete that cascades all save. Two things the guard cannot catch, by Postgres design:
- **A cancel** (`statement_timeout`), which ends the whole save anyway.
- **A wait for a lock on `bid_changes`.** That only happens behind DDL on `bid_changes` itself, which the ledger's doc rules to run `CONCURRENTLY` or under a lock timeout.

## Apply order

After the merge, right after `20261006190000_bid_changes`. No client change.
