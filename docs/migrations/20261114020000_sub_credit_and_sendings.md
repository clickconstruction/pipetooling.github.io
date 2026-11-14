# 20261114020000_sub_credit_and_sendings.sql (2026-11-13, v2.7235)

A sub's credit, and one sending across several sheets (punch list #347; the owner: "overpayment -> credit"). Ships with the sub's **Record payment** window growing into a sending.

- **`sub_payment_sendings`**: one row per money movement to a sub. `number` comes from `sub_payment_sending_number_seq` and is never reused. `person_id` is the roster person when the sheet's sub is one. It stores no amount: what was sent is the sum of its payment rows plus the credit kept with it.
- **`people_labor_job_payments.sending_id`**, nullable, with a partial index. The method check gains `credit`, the method of a payment made from a credit.
- **`sub_credit_entries`**: a ledger per person. Above zero is credit kept (`payment_id` is the row the extra came in with). Below zero is credit used (`payment_id` is the row the credit paid for). The entry goes when its row goes. At most one entry per payment row.
- **`people_labor_job_payment_events`** gains `sending_id`, `credit_amount` and `credit_person_id`, the snapshot a removal keeps.
- **`record_sub_sending(p_person_id, p_lines jsonb, p_credit, p_payment_date, p_method, p_method_ref, p_memo, p_hidden_from_sub)`**: the sending, a payment row per line and the credit entry, in one statement. Returns `{ sending_id, number, payment_ids, credit }`.
- **`apply_sub_credit(p_person_id, p_job_id, p_amount, p_payment_date, p_memo)`**: a payment row with method `credit` and the entry that takes it off the person's credit. Refused past the credit they hold. One person's ledger is serialized by `sub_credit_lock`, an advisory transaction lock.
- **Guards.** Trigger `guard_sub_credit_payment` on `people_labor_job_payments` (before an update of `amount`, `method` or `job_id`): a payment that carries a credit stays on its sheet, and one made from a credit keeps its amount and method. `move_labor_job_payment` refuses such a row with the reason. `remove_labor_job_payment` snapshots the sending and the credit, puts used credit back by removing its row, and refuses to remove a payment whose kept credit was already used. `restore_labor_job_payment` brings the row back with its sending and re-creates its credit entry, and refuses a from-credit payment whose credit has been used since.

All functions are `SECURITY INVOKER` except the trigger function, which is `SECURITY DEFINER` so the check reads the entries whoever makes the edit. Both tables are office staff only (`is_office_staff()`), read and insert. Ends with the four fence calls. Additive and idempotent.

**Locks.** `ADD COLUMN … REFERENCES`, the constraint swap and `CREATE TRIGGER` each take a short lock on `people_labor_job_payments`, a small table. `lock_timeout` is 3 s.

**Tried on a scratch Postgres 15** with the events and method migrations under it: it applies twice. One sending across two sheets with a credit kept, a second sending taking the next number, each refusal when recording, a use of the credit, an edit of a from-credit row refused, a move of either credit row refused while a plain row moves, a removal refused once the credit is used, a removed use putting the credit back and its undo taking it again, a removed kept row dropping the credit and its undo restoring the row, its sending and its credit.

**Order.** Push right after the merge. Until then the client's payment read falls back twice (to the row with its method, then to the row before that), the credit and sending reads fail soft, a payment that stays on its sheet is recorded by the plain insert as before, and an amount past the sheet says it is not switched on yet.

**After the push:** `npm run gen-types:linked`, then `node scripts/build-dev-mcp-catalog.mjs`, in one types PR.
