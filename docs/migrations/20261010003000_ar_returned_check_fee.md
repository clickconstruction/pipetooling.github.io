# 20261010003000_ar_returned_check_fee.sql (2026-10-09, v2.5033)

The returned-check fee. On a case for a check that came back, one press adds $30 to the bill the check was meant for, once, recorded on the case. The owner's call of 2026-10-09, sent by Punchlist, option (A).

**The law.** Tex. Bus. & Com. Code § 3.506(b), as amended by H.B. 2793 (82nd Leg., R.S., ch. 333, eff. Sept. 1, 2011): *"On return of a payment device to the holder following dishonor of the payment device by a payor, the holder, the holder's assignee, agent, or representative, or any other person retained by the holder to seek collection of the face value of the dishonored payment device may charge the drawer or indorser a maximum processing fee of $30."* § 3.506(c): no fee may be charged if a reimbursement fee was collected under Code of Criminal Procedure art. 102.007(e). A fee already collected is refunded if one later is.

## What it does

1. **The case records its fee.** `mercury_transaction_ar_returned` gains `fee_amount numeric`, `fee_invoice_id uuid` (→ `jobs_ledger_invoices`, `ON DELETE SET NULL`), `fee_added_at timestamptz` and `fee_added_by uuid` (→ `users`). `fee_added_at` set means the case has its fee.
2. **The bill carries its line.** `jobs_ledger_invoices.fee_lines jsonb` holds `[{description, amount, case_id, added_at}]`, inside `amount`. The printed bill shows each line as its own row, as a folded hazmat fee does, instead of spreading it over the work lines. The column is nullable with no default, so the change is metadata-only.
3. **`list_ar_return_case_fees(p_case_ids uuid[])`** returns, for office roles (`STABLE SECURITY DEFINER`), each case's fee and the bills its check paid. Those bills are the check's live payments plus the ones taken off (`deleted_records_archive`), the same two places `list_ar_deposit_trails` reads. Each bill carries its 0-based `sequence_order`, its status, whether it is a Stripe invoice, and the job's number and name.
4. **`add_ar_return_case_fee(p_case_id uuid, p_invoice_id uuid)`** is the one press. It refuses a training account, a digital twin and anyone outside the office (dev, master technician, assistant, controller, primary). It locks the case and the bill, then refuses unless:
   - **(a)** the case is open and its check came back (`returned`, `closed_at IS NULL`, `source` *bank* or *hand*). The error reads *Only an open case for a check that came back takes the fee.*
   - **(b)** the case has no fee yet. The error reads *This case already has its fee.*
   - **(c)** the check paid that bill, as a live payment of this check on it or one taken off it. The error reads *That bill is not one this check paid.*
   - **(d)** the bill is not a Stripe invoice. The error reads *Stripe holds Bill N: a sent Stripe invoice cannot take a line.*

   Then, in one transaction, it:
   - adds $30 to the bill's `amount` and appends the line to `fee_lines`;
   - adds $30 to the job's `revenue`, as `create_hazmat_fee_incident` does, so the part of the job on no bill stays where it was;
   - sets the case's four `fee_*` columns;
   - writes a `returned_check_fee` line in `job_activity_events` (*Returned check fee: $30 added to bill N (Tex. Bus. & Com. Code § 3.506)*).

   It returns `{ok, case_id, invoice_id, job_id, amount, bill}`.

`SET lock_timeout = '3s'` comes first. Both `ALTER`s are `IF NOT EXISTS` and both functions are `CREATE OR REPLACE`, so the file is idempotent. No table is created, so the read-only and twin blocks already on both tables stand. Grants: `list_…` to `authenticated, service_role`; `add_…` to `authenticated`; both revoked from `public, anon`.

## Push

Punchlist pushes it after merge. The client reads both functions fail-soft: before the push the case shows no fee box rather than a press that would fail. The reprint reads `fee_lines` only when the row carries it. Adding `fee_lines` to `JOBS_LEDGER_INVOICES_EMBED`, with the regenerated types, waits for a follow-up after the push, because an embed that names a missing column fails the whole job load.

## Verify after the push

On a test pair, or read-only against a real case:

1. `list_ar_return_case_fees(ARRAY[<an open bank case>])` lists the case's bill with `"stripe": false` and `fee_added_at` null.
2. **(a)** On a closed case, or a *rejected* or *unbanked* one: `add_ar_return_case_fee` raises *Only an open case for a check that came back takes the fee.*
3. **(b)** On a case that already has its fee, a second press raises *This case already has its fee.*
4. **(c)** On a bill of the same job that the check never paid, it raises *That bill is not one this check paid.*
5. **(d)** On a Stripe bill the check paid, it raises *Stripe holds Bill N: a sent Stripe invoice cannot take a line.*
6. After a real press, the bill reads $30 more with one `fee_lines` entry, the job's revenue reads $30 more, the case's `fee_added_at` and `fee_added_by` are set, and the job's history has the line.

## Checked before the PR

On Homebrew Postgres 15, with stand-ins for `users`, `auth.uid()`, `is_read_only()`, `is_digital_twin()` and the five tables, the file was applied twice. One press on an open bank case taken off bill 1 moved the bill from $13,680 to $13,710 with its line, and the job's revenue from $38,625 to $38,655. It set the case's fee and wrote the history line. Then (a) refused twice, for a rejected check and a closed case, and (b), (c) and (d) refused in turn. A subcontractor and a training account were refused. Nothing changed after the first press.

## Status

Merged as v2.5033 (#5102) and pushed with 002000 and 004000 on 2026-10-09 (drift 817 of 817). Verified read-only: the four case columns and `jobs_ledger_invoices.fee_lines` are present; no case carries a fee yet. Both RPCs refuse a signed-out caller over the pooler (*not authenticated* / *Sign in first.*), so the four refusals stand on the PG15 bed and are re-read on the first real press. Types: PR #5111; the `JOBS_LEDGER_INVOICES_EMBED` follow-up adds `fee_lines` after it.
