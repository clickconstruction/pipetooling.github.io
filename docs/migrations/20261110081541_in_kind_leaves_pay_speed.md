# 20261110081541_in_kind_leaves_pay_speed.sql (2026-11-10, v2.6834)

Punch list #301: an In kind payment leaves pay speed. A credit given instead of money is often dated to its bill's own day, so a customer who pays in kind read as *pays in 0 days*, and the forecast and the chase judged their bills by that pace.

- **Nothing is rewritten.** The record of a payment left out of pay speed already exists: `pay_speed_exclusions` (`20260825170000`). `pay_speed_samples()` skips a row there, so `get_billed_customer_pay_speeds`, `get_customer_pay_speeds` and `get_gc_money_monday_payload` follow; **Data health** already lists such a payment as *excluded*, and a person can count it again.
- **`in_kind_payment_leaves_pay_speed()`**, a trigger AFTER INSERT OR UPDATE OF `payment_type` on `jobs_ledger_payments` (SECURITY DEFINER): a payment whose kind reads In kind (v2.6816's own test) gets an exclusion row with `excluded_by` null, `excluded_by_name` *The app* and the reason. A payment whose kind changes away from In kind loses the row the app gave it; a row a person made is never touched.
- **The backfill**: every In kind payment already recorded gets its row, once (`ON CONFLICT DO NOTHING`).
- Additive and idempotent. No table is created, so no fence is called. The trigger takes a brief lock on `jobs_ledger_payments`; `lock_timeout` is 3 s.
- **Bed**: `npm run test:pg:in-kind` (`supabase/tests/in_kind/30_pay_speed.sql`, 7 checks more).
