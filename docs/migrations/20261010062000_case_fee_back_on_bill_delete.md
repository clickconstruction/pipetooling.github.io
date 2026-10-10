# 20261010062000_case_fee_back_on_bill_delete.sql (2026-10-10, v2.5144)

A deleted bill gives its returned check fee back to its case, so the office can put the $30 on again. Punch list #105, gap 1 (`to-dos/bill-riders-survive-delete-and-split.md`). Its client half is the case pane's note: *The $30 fee came off with its bill on Oct 10. Add it again.*

**Why.** `add_ar_return_case_fee` ([`20261010003000`](20261010003000_ar_returned_check_fee.md)) writes the $30 three times: the case's `fee_*` columns, an entry on the bill's `fee_lines` that names the case, and the job's revenue. Deleting the bill took the entry with the row. The delete paths are send back (`delete_billed_invoice_on_send_back`), Delete on a Ready to Bill line, and Split's void. The case's `fee_invoice_id` foreign key set it to null, but `fee_added_at` stayed. So the case still read *The $30 fee is on its bill*. The press refused a second fee (*This case already has its fee*), and the next rewrite of the revenue dropped the $30, because `job_rider_fees` no longer found the entry. The office could not put it back.

## What it does

1. **`mercury_transaction_ar_returned.fee_came_off_at`** (`timestamptz`, nullable, no default): when the case's fee last left with its bill.
2. **`jobs_ledger_invoices_give_case_fee_back()`**, a `SECURITY DEFINER` trigger function, `BEFORE DELETE ON jobs_ledger_invoices FOR EACH ROW WHEN (OLD.fee_lines IS NOT NULL)`. For a row whose `fee_lines` holds an entry that names a case:
   - each case with its fee on, matched by the entry's case id or by its `fee_invoice_id` naming this bill, gets `fee_amount`, `fee_invoice_id`, `fee_added_at` and `fee_added_by` cleared and `fee_came_off_at` stamped. `add_ar_return_case_fee` then runs again unchanged: it refuses only a case whose `fee_added_at` is set;
   - the job's history gets a `returned_check_fee_off` line: *Returned check fee: $30 came off with bill 1. The case can add it again.*;
   - the job's revenue loses the entries' amounts, read as `job_rider_fees` reads them. The next rewrite would write the same figure, and a second press does not count the fee twice in between.

   Case ids are compared as text, so an entry whose id is not a uuid cannot stop a delete. When the whole job is deleted, its bills go by cascade after its row. The revenue update then finds no row, the history line is skipped (`WHERE EXISTS` the job), and the case still gets its fee back.
3. **`list_ar_return_case_fees`** returns `fee_came_off_at` as a seventh column. Its return type changes, so it is dropped and created again with the same grants: `authenticated` and `service_role`, revoked from `public` and `anon`. The body is otherwise the same as in `20261010003000`.
4. **The backfill.** A case whose fee left with a bill before this file gets its fee back the same way: `fee_added_at` set, `fee_invoice_id` null, and no bill's `fee_lines` naming it. Its job's revenue is left alone, because whether a rewrite already dropped the $30 cannot be told from the database. The next rewrite settles it either way.

No table is created, so the read-only and twin blocks already on both tables stand. A training account or a twin cannot delete a bill, so the trigger never runs for one. `SET lock_timeout = '3s'` comes first.

**Locks.**
- `ALTER TABLE mercury_transaction_ar_returned ADD COLUMN` takes `ACCESS EXCLUSIVE` on that table, which holds the cases for checks that came back. It is a catalog change only, with no default and no rewrite.
- `CREATE TRIGGER` takes `SHARE ROW EXCLUSIVE` on `jobs_ledger_invoices`. That waits for writes in flight and holds new writes for the instant it takes. Reads pass. This is the hot table, so the 3 second lock timeout makes the push fail fast rather than queue the office's saves. Retry in a quiet moment.
- `DROP FUNCTION` / `CREATE FUNCTION` lock only the function.
- The backfill `UPDATE` takes `ROW EXCLUSIVE` on `mercury_transaction_ar_returned` and locks only the rows it changes, which is none on production today (below).

## Apply order

The merge first, then the push. The client reads `fee_came_off_at` when it is there and ignores it when it is not. A client from before the merge shows a case whose fee came off as one with no fee yet, with the press and no note. That is right, only quieter.

**Split ([#5274](https://github.com/clickconstruction/pipetooling.github.io/pull/5274), v2.5140)** carries a bill's fee lines onto its parts. With this trigger on, a returned check fee carried that way would ride on its part and also be given back to its case, so a second press would count it twice. So the same PR makes Split refuse a bill that carries a case entry, beside its GC card fee refusal (`splitBillReturnedCheckFeeRefusal`): *This bill carries a returned check fee, so it cannot be split. Splitting it would count the fee twice.* `add_ar_return_case_fee` refuses a Stripe bill, so such a bill reaches Split only if it went out on Stripe after the fee went on. Production holds no bill with a case entry today.

**Restore.** A dev restoring a deleted bill from Recently deleted brings its entry back, but the case has already been cleared. If that ever happens, put the case's fee back by hand, or take the entry off the restored bill.

## Checked before the PR

As the house bed `scripts/pgtest-revenue-riders.sh` on Postgres 15 in Docker. The bed's own path on the Mac's Postgres 15 cannot start inside the session sandbox: it fails to allocate shared memory. The scenario has 32 checks, all ok; the 14 new ones are in section 6. The seed adds job D, with a $1,000 line and two $530 bills. Bill 1 carries case D's $30, which the case records. Bill 2 carries case F's $30, whose case already lost its `fee_invoice_id`. Case E's fee left with a bill before this file. The migration runs twice after `20261010044000`.

- **The backfill** gives case E its fee back with the stamp. It leaves case F, whose entry still rides on a live bill, and case D. The second run stamps no other case.
- `list_ar_return_case_fees`' result type carries `fee_came_off_at timestamp with time zone`.
- **Deleting bill 1:**
  - clears case D's four fee columns and stamps it;
  - writes D's revenue as $1,030 (1,060 − 30), which is the $1,000 line plus `job_rider_fees`' $30 for F's entry still on bill 2;
  - writes the history line once;
  - leaves case F alone.
- **Deleting Southern Post's bill 1**, whose entry names `case-1` (not a uuid), goes without an error. Its revenue drops by the $30 ($1,813 → $1,783) and no history line is written.
- **Deleting job D** with the bills keyed `ON DELETE CASCADE`, as on production, gives case F its fee back without an error and leaves no history line. Production has no key on `job_activity_events`; the bed adds one here, so a line written for a job that is gone would fail.
- **Two SQL mutants**, each alone, failed the bed: the trigger on `UPDATE OF status` instead of `DELETE` (case D keeps its fee), and the history line without its `WHERE EXISTS` (deleting job D fails on the key).

**Production, read-only over the pooler, 2026-10-10 05:34 UTC:**
- no case has a fee on (`fee_added_at` set: 0), so the backfill's set is 0;
- no bill carries an entry that names a case (0 of 574 bills);
- no trigger of this name exists yet.

## Verify after the push

Read-only, over the pooler, with `SET default_transaction_read_only = on`:

1. `SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'jobs_ledger_invoices_give_case_fee_back'` returns one row, `O`.
2. `SELECT pg_get_function_result('public.list_ar_return_case_fees(uuid[])'::regprocedure)` ends with `fee_came_off_at timestamp with time zone`.
3. `SELECT count(*) FROM public.mercury_transaction_ar_returned WHERE fee_came_off_at IS NOT NULL` reads 0, the backfill's set as read above. Any case stamped since was stamped by a delete, and its job's history has the matching `returned_check_fee_off` line.
4. Regenerate the types (`list_ar_return_case_fees` gains a column) and run `npm run check:migration-drift`.

**Live, on a ZZ TEST job** with a check that came back, after the push:
1. In Accounts Receivable → Came back, open the case and press **Add the $30 fee to bill N**.
2. Take the payment off, then send the bill back.
3. The case reads *The $30 fee came off with its bill on <day>. Add it again.*, and the job's total is $30 lower.
4. Press it again on another bill the check paid. The fee and the job's total come back once.
