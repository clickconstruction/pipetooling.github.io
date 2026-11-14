# 20261114030000_sub_payment_checked.sql (2026-11-13, v2.7237)

A sub payment is ticked against the bank (punch list #347, PR 4). Ships with the ✓ column on the Subs Ledger.

- `people_labor_job_payments.checked_at timestamptz`, `.checked_by uuid` (to `users`, set null on delete) and `.checked_by_name text`, all nullable. Null is not checked.
- `set_sub_payment_checked(p_payment_id, p_checked)`, `SECURITY INVOKER`, so the payments table's own update policy is the gate. It sets or clears the three columns on the row and on every row of the same sending, and returns how many rows it touched. It refuses a back-charge and a payment made from a credit: neither moved money.
- Trigger `clear_sub_payment_check_on_change`, before an update of `amount` or `payment_date`: when either changes on a ticked row, the three columns are cleared. An update that sets the tick itself is left alone.
- A removed payment that is put back comes back unticked: the removal's snapshot does not carry the tick.

Additive and idempotent. No table is created, so no fence call is needed. `ADD COLUMN … REFERENCES` and `CREATE TRIGGER` take a short lock on a small table. `lock_timeout` is 3 s.

**Needs** `20261114020000_sub_credit_and_sendings.sql` first: the function reads `sending_id` and the `credit` method.

**Tried on a scratch Postgres 15** over the three migrations before it: applies twice. A row with no sending ticks alone, one line of a sending ticks both, a back-charge and a from-credit row are refused, a memo edit and a save of the same amount keep the tick, an amount edit and a date edit clear it, and clearing unticks the whole sending.

**Order.** Push right after the merge. Until then the payments read falls back (no ticks are read, every sheet still draws) and pressing a box says ticking is not switched on yet.

**After the push:** the types and the dev seat's catalog, in one types PR with the credit migration's.
