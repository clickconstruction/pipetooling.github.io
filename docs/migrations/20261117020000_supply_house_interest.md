# 20261117020000_supply_house_interest.sql (2026-11-16, v2.7467)

Supply house payments: interest and late fees. PR 5 of the train. Needs `20261116230000_supply_house_payments.sql`.

- **`supply_house_invoices.is_interest`** (boolean, default false) and **`late_invoice_id`** (the same house's bill that ran late, NULL when not known or when that bill is deleted). An interest row stays `document_kind` `invoice`: it is owed, aged and paid like any bill, and a save from an older client cannot turn it into something else. A check holds that only an invoice is interest and only interest names a late bill, never itself.
- **`supply_house_invoices_interest_guard`** (before insert or an update of `is_interest`, `late_invoice_id` or `supply_house_id`): the late bill is an invoice of the same house that is not interest itself; a bill that is on a job or a bid cannot be marked interest until it is taken off.
- **`supply_house_interest_allocation_guard`** on `supply_house_invoice_job_allocations` and `supply_house_invoice_bid_allocations` (before insert or an update of `invoice_id`): an interest bill takes no job and no bid. This is what keeps interest off every job's cost, whichever client writes.
- **`record_supply_house_payment`** gains an eleventh argument, **`p_interest`** `{ amount, late_invoice_id?, invoice_number? }`: the charge is made as its bill (numbered `Interest <day>` unless a number is given, dated and due on the payment's day) and paid whole by the same payment. The ten-argument function is dropped in the same statement run, since two functions of one name leave the API unable to choose. Every other argument is as it was, so the client of v2.7455 keeps working; the reply gains `interest_invoice_id`. The function's body is the ground's own, copied by script with the interest added.

Both guards are plain trigger functions with an empty `search_path`, revoked from every API role. No new table, so no fence calls. Additive and idempotent.

**Locks.** `ADD COLUMN` (a constant default and a nullable reference, so no rewrite), the check and three `CREATE TRIGGER`s take short locks on `supply_house_invoices` and the two allocation tables; adding the check reads every bill once. `lock_timeout` is 3 s.

**Tried** on the bed `supabase/tests/supply_house_payments/` (`40_interest.sql`), which CI runs on Postgres 15: the three migrations apply twice and every scenario passes, the earlier ones with their ten-argument calls against the new function.

**Order.** Push right after the merge. Until then the client sends `p_interest` only when there is interest, so a payment without it records as before.

**After the push:** `npm run gen-types:linked`, then `node scripts/build-dev-mcp-catalog.mjs`, in one types PR.

**Applied** to prod by 2026-11-18: `npm run check:migration-drift` read 1,366 local files against 1,366 remote versions, fully applied, this version among them (run in the docs pass after #8630).
