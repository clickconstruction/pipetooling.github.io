# 20261009235900_gc_controller_pay_speeds_and_promises.sql

GC mode, Owner Billing's O5e: the controller reads pay speeds and promises, and records a promise (v2.5029). The SQL is `to-dos/gc-mode/mockups/owner-billing-o5.md`'s *O5e*, word for word, on branch `spike/gc-mode`. The lead's calls, 2026-10-09: widen the two read gates and the write gate; leave `get_pay_speed_transactions` (Data health) as it is; the controller audit's form.

**Why:** the controller is on the money team (`gc_money_team()`), but three gates left it out. A controller's Money and Bill the customer read no customer's usual days to pay and no promise, so the due days on a controller's screen could differ from a dev's, and a controller's **They said when…** was refused (*Not allowed to record payment promises*). The O5 plan had named the write gate as the owner's call.

It is the controller audit's form (`20260927230000`): each function is its live definition (`pg_get_functiondef`, read on 2026-10-09, the same as the repo's last) with `'controller'` named beside the others, and nothing else changed. `CREATE OR REPLACE` keeps grants and owner.

## What it does

1. **`can_read_payment_promises()`**: dev, assistant-like, master, **controller**, primary. `list_job_payment_promises` and `list_payment_promise_records` read through it.
2. **`can_write_payment_promises()`**: dev, assistant-like, master, **controller**. `add_job_payment_promise` and `void_job_payment_promise` write through it.
3. **`get_billed_customer_pay_speeds()`**: its gate names the **controller** beside master and primary; the body is the live one, word for word. Its comment now names the controller too.

`get_pay_speed_transactions`, the Data health reader with the same gate, stays as it is. So does `list_job_promised_pay_dates` (the Stages chips).

## The lock note

`CREATE OR REPLACE FUNCTION` takes no table lock, and `COMMENT ON FUNCTION` none either. A read running at that moment finishes on the old body. `SET lock_timeout = '3s';` heads it as every migration's does.

## Verify after the push

1. **The gates.** `SELECT pg_get_functiondef('public.can_write_payment_promises()'::regprocedure) LIKE '%controller%';` gives `true`, and likewise for `can_read_payment_promises()` and `get_billed_customer_pay_speeds()`.
2. **The screens**, read only: a controller's Money shows the same expected days as a dev's on the same bill.

## The SQL beds

`scripts/pgtest-gc-owner-billing.sh` re-applies this migration with Owner Billing's others. `70_controller_reads.sql` checks:
- the customer's usual days to pay as the dev reads them, and the controller reading the same, with an estimator still reading nothing;
- the promise as the dev reads it, the controller reading the same, and an estimator nothing; the controller reading Their word's records;
- the controller's own promise landing; an estimator's refused in its words; a controller in training mode writing nothing.

## Status

**Applied to prod 2026-10-09 at 13:43 UTC** by the lead (GC MODE) from a clean checkout at main's tip (59273584a) with `scripts/db-push.sh` (`--include-all`); drift 826/826 after. Verified through the management API, rolled back: step 1, `can_read_payment_promises`, `can_write_payment_promises` and `get_billed_customer_pay_speeds` each name the controller; as a controller, reads true, writes true and the pay speeds not null; as an estimator, reads false and writes false. No types change (the signatures are unchanged) and no deploy. Step 2, the screens read-only side by side as a controller and a dev, is the lane's, on the first certified GC bill.
