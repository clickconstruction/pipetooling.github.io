# 20261010062000_case_fee_back_on_bill_delete.sql (2026-10-10, v2.5144)

A deleted bill gives its returned check fee back to its case, so the office can put the $30 on again. Punch list #105, gap 1 (`to-dos/bill-riders-survive-delete-and-split.md`). Its client half is the case pane's note: *The $30 fee came off with its bill on Oct 10. Add it again.*

**Why.** `add_ar_return_case_fee` ([`20261010003000`](20261010003000_ar_returned_check_fee.md)) writes the $30 three times: the case's `fee_*` columns, an entry on the bill's `fee_lines` that names the case, and the job's revenue. Deleting the bill took the entry with the row. The delete paths are send back (`delete_billed_invoice_on_send_back`), Delete on a Ready to Bill line, and Split's void. The case's `fee_invoice_id` foreign key set it to null, but `fee_added_at` stayed. So the case still read *The $30 fee is on its bill*. The press refused a second fee (*This case already has its fee*), and the next rewrite of the revenue dropped the $30, because `job_rider_fees` no longer found the entry. The office could not put it back.

## What it does

The rule it keeps: a case's fee is on exactly when a live bill carries its entry. `fee_came_off_at` is set exactly when the fee left with its bill and took its amount off the job's revenue.

1. **`mercury_transaction_ar_returned.fee_came_off_at`** (`timestamptz`, nullable, no default).
2. **`jobs_ledger_invoices_give_case_fee_back()`**, a `SECURITY DEFINER` trigger function, `BEFORE DELETE ON jobs_ledger_invoices FOR EACH ROW WHEN (OLD.fee_lines IS NOT NULL)`. It acts on a row whose `fee_lines` holds an entry that names a case. Each case with its fee on is matched by the entry's case id, or by its `fee_invoice_id` naming this bill. For each one:
   - `fee_amount`, `fee_invoice_id` and `fee_added_at` are cleared. `add_ar_return_case_fee` then runs again: it refuses only a case whose `fee_added_at` is set. `fee_added_by` stays, so a bill that comes back can still say who added the fee.
   - While the job stays, the case is stamped `fee_came_off_at`. The job's history gets a `returned_check_fee_off` line: *Returned check fee: $30.00 came off with bill 1. The case can add it again.*
   - While the job stays, the job's revenue loses the entries' amounts, read as `job_rider_fees` reads them. The next rewrite would write the same figure, and a second press does not count the fee twice in between.

   Case ids are compared as text, so an entry whose id is not a uuid cannot stop a delete. When the whole job is deleted, its bills go by cascade after its row. The case still gets its fee back, but nothing is lowered, stamped or noted.
3. **`jobs_ledger_invoices_take_case_fee_on()`**, `AFTER INSERT ON jobs_ledger_invoices FOR EACH ROW WHEN (NEW.fee_lines IS NOT NULL)` (review on #5283). A new bill can carry a case's entry: a Split part, or a bill restored from Recently deleted. If that case's fee is on no live bill, the case is attached to the new bill:
   - `fee_invoice_id` is set to the new bill, and `fee_amount` comes from the entry;
   - `fee_added_at` keeps its value, else takes the entry's `added_at`, else now;
   - the stamp is cleared.

   A stamped case also gets its amount back on the job's revenue and a `returned_check_fee_back` line: *Returned check fee: $30.00 is back on bill 3.* A case released by a whole-job delete was never stamped, and its restored job row still holds the fee, so nothing is raised. A case whose fee is on another live bill is left there.
4. **`list_ar_return_case_fees`** returns `fee_came_off_at` as a seventh column. Its return type changes, so it is dropped and created again with the same grants: `authenticated` and `service_role`, revoked from `public` and `anon`. The body is otherwise the same as in `20261010003000`.
5. **`add_ar_return_case_fee`**, restated byte for byte from `20261010003000` but for one refusal, (b2): *A bill already carries this case's fee.* It fires when any live bill's `fee_lines` names the case. The same signature keeps the grants, and they are restated as the source has them.
6. **The backfill.** A case whose fee left with a bill before this file gets its fee back the same way: `fee_added_at` set, `fee_invoice_id` null, and no bill's `fee_lines` naming it. Its job's revenue is left alone, because whether a rewrite already dropped the $30 cannot be told from the database. The next rewrite settles it either way.

No table is created, so the read-only and twin blocks already on both tables stand. A training account or a twin cannot delete or add a bill, so neither trigger runs for one. `SET lock_timeout = '3s'` comes first.

**Locks.**
- `ALTER TABLE mercury_transaction_ar_returned ADD COLUMN` takes `ACCESS EXCLUSIVE` on that table, which holds the cases for checks that came back. It is a catalog change only, with no default and no rewrite.
- The two `CREATE TRIGGER`s each take `SHARE ROW EXCLUSIVE` on `jobs_ledger_invoices`. That waits for writes in flight and holds new writes for the instant it takes. Reads pass. This is the hot table, so the 3 second lock timeout makes the push fail fast rather than queue the office's saves. Retry in a quiet moment.
- The function changes lock only the functions.
- The backfill `UPDATE` takes `ROW EXCLUSIVE` on `mercury_transaction_ar_returned` and locks only the rows it changes, which is none on production today (below).

## Apply order

The merge first, then the push. The client reads `fee_came_off_at` when it is there and ignores it when it is not. A client from before the merge shows a case whose fee came off as one with no fee yet, with the press and no note. That is right, only quieter.

**Split ([#5274](https://github.com/clickconstruction/pipetooling.github.io/pull/5274), v2.5140)** carries a bill's fee lines onto its parts. This PR makes Split refuse a bill that carries a case entry, beside its GC card fee refusal (`splitBillReturnedCheckFeeRefusal`): *This bill carries a returned check fee, so it cannot be split. Splitting it would count the fee twice.* A client from before the merge can still split such a bill. Its part then carries the entry, and section 3 attaches the case to it, so nothing doubles. `add_ar_return_case_fee` refuses a Stripe bill, so such a bill reaches Split only if it went out on Stripe after the fee went on. Production holds no bill with a case entry today.

**Restore.** A bill restored from Recently deleted brings its entry back, and section 3 attaches its case again. A whole job deleted and restored ends where it began.

## Checked before the PR

As the house bed `scripts/pgtest-revenue-riders.sh` on Postgres 15 in Docker. The bed's own path on the Mac's Postgres 15 cannot start inside the session sandbox: it fails to allocate shared memory. The scenario has 42 checks, all ok. Sections 6 and 7 hold the 24 new ones.

The seed adds job D, with a $1,000 line and two $530 bills:
- bill 1 carries case D's $30, which the case records;
- bill 2 carries case F's $30, whose case already lost its `fee_invoice_id`;
- case E's fee left with a bill before this file.

The migration runs twice after `20261010044000`. The bed's stand-ins add what the restated press reads: `is_read_only`, `is_digital_twin`, the payments, the archive, and a user's name and email.

- **The backfill** gives case E its fee back with the stamp. It leaves case F, whose entry still rides on a live bill, and case D. The second run stamps no other case.
- `list_ar_return_case_fees`' result type carries `fee_came_off_at timestamp with time zone`.
- **Deleting bill 1:**
  - clears case D's amount, bill and day, keeps who added it, and stamps it;
  - writes D's revenue as $1,030 (1,060 − 30), which is the $1,000 line plus `job_rider_fees`' $30 for F's entry still on bill 2;
  - writes the history line once;
  - leaves case F alone.
- **Deleting Southern Post's bill 1**, whose entry names `case-1` (not a uuid), goes without an error. Its revenue drops by the $30 ($1,813 → $1,783) and no history line is written.
- **A bill that comes back** (Split's part, or a restore) carrying D's entry and its `added_at`:
  - attaches case D to it, with the entry's amount and day, and clears the stamp;
  - puts the $30 back on the revenue ($1,060, which is 1,000 + `job_rider_fees`' 60);
  - writes *Returned check fee: $30.00 is back on bill 3.* once.
- **The press:**
  - it now refuses D with *This case already has its fee.*;
  - case G is released, but its entry was written onto bill 2 without the press, so the press refuses it with *A bill already carries this case's fee.*;
  - after bill 3 goes again ($1,030), the press puts D's fee on bill 2. The total is $1,060, which a rewrite also writes.
- **Deleting job D** with the bills keyed `ON DELETE CASCADE`, as on production, gives D and F their fees back unstamped, without an error. Production has no key on `job_activity_events`; the bed adds one here, so a line written for a job that is gone would fail. **Restoring** the job row, its line and its bills attaches both cases to bill 2 again and raises nothing: the restored total of $1,060 is what a rewrite writes, and no history line is written.
- **Five SQL mutants**, each alone, failed the bed:
  - the delete trigger on `UPDATE OF status`;
  - the insert trigger on `UPDATE OF status`;
  - the insert trigger raising the revenue whether or not the case was stamped (a restored job reads $1,090);
  - the press without (b2);
  - the delete trigger stamping on a whole-job delete.

**Production, read-only over the pooler, 2026-10-10 05:34 UTC:**
- no case has a fee on (`fee_added_at` set: 0), so the backfill's set is 0;
- no bill carries an entry that names a case (0 of 574 bills);
- no trigger of this name exists yet.

## Verify after the push

Read-only, over the pooler, with `SET default_transaction_read_only = on`:

1. `SELECT tgname, tgenabled FROM pg_trigger WHERE tgname IN ('jobs_ledger_invoices_give_case_fee_back', 'jobs_ledger_invoices_take_case_fee_on')` returns two rows, both `O`.
2. `SELECT prosrc LIKE '%A bill already carries this case''''s fee%' FROM pg_proc WHERE proname = 'add_ar_return_case_fee'` reads true.
3. `SELECT pg_get_function_result('public.list_ar_return_case_fees(uuid[])'::regprocedure)` ends with `fee_came_off_at timestamp with time zone`.
4. `SELECT count(*) FROM public.mercury_transaction_ar_returned WHERE fee_came_off_at IS NOT NULL` reads 0, the backfill's set as read above. Any case stamped since was stamped by a delete, and its job's history has the matching `returned_check_fee_off` line.
5. Regenerate the types (`list_ar_return_case_fees` gains a column) and run `npm run check:migration-drift`.

**Live, on a ZZ TEST job** with a check that came back, after the push:
1. In Accounts Receivable → Came back, open the case and press **Add the $30 fee to bill N**.
2. Take the payment off, then send the bill back.
3. The case reads *The $30 fee came off with its bill on <day>. Add it again.*, and the job's total is $30 lower.
4. Press it again on another bill the check paid. The fee and the job's total come back once.
