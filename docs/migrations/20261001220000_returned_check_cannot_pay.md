# 20261001220000_returned_check_cannot_pay.sql (2026-10-01, v2.4313)

A check that came back can pay no bill (punch list #76 PR 1). Found on 2026-10-01: Loberg's stopped $5,622.49 could still be applied to #650 from Accounts Receivable's All list.

- **`jobs_ledger_payments_refuse_returned_deposit()`** + trigger `BEFORE INSERT OR UPDATE OF mercury_transaction_id` on `jobs_ledger_payments` — raises `This check came back, so it cannot pay a bill.` (`P0001`, hint `returned_deposit`) when the row is linked to a deposit with `mercury_transactions.status = 'failed'` or a `mercury_transaction_ar_returned` row with `returned`. An UPDATE that leaves the deposit as it was passes, so a payment on a check that bounced afterwards can still be edited and taken off. SECURITY DEFINER so a role that cannot read the Mercury tables is still refused; revoked from `public, anon, authenticated`.
- **`count_mercury_transactions_for_bank_payments`** — body from `20260927230000`, plus `and (v_include_hidden or t.status is distinct from 'failed')`.

Rehearsed on prod in `BEGIN … ROLLBACK` under `SET LOCAL ROLE authenticated` as the dev: count 1743 → 1742; apply and tip on Loberg's deposit refused; an ordinary payment edit passed.

Apply order: either. The client already hides the editor for a returned check, and the trigger only refuses what the client no longer offers.
