# 20261009233000_gc_money_monday_email.sql

GC mode, Owner Billing's O7b: the Monday money email, a Report Subscriptions stream (v2.5024). The plan is `to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md` → PR 10, and the SQL is `to-dos/gc-mode/mockups/owner-billing-o7.md`'s *O7b's SQL as built*, word for word, on branch `spike/gc-mode` as merged by the lead on 2026-10-09. It needs O1's pay applications with O4a's `invoice_id` (`20261009200000`), the contract's days to pay (O5d), the Pipeline's `pay_speed_samples()` (`20261002030000`) and `job_payment_promises` (`20260911051414`), and `get_my_email_schedule` / `get_global_email_schedule` as `20260915180000` left them.

It is additive and idempotent: one table, its index and three policies, one payload function, the two schedule functions restated, one cron job, and the three block calls.

## What it does

1. **`gc_money_monday_email_requests`**: one row per send, the house shape (`requested_by`, `recipient_user_id`, `send_at`, `repeat_weekly`, `sent_at`, `error`, `attempts`), with an index on the pending rows.
   - Insert: the money team (`gc_money_team()`) in their own name, for a recipient on the money team (dev, master_technician, controller).
   - Read: the requester, the recipient or a dev. Stop a pending send: the requester or the recipient, a dev any.
   - No update or truncate for a client: only the service-role function stamps rows. anon has nothing.
2. **`get_gc_money_monday_payload()`**, SECURITY DEFINER, service role only. It is the Money lens's *Who owes us* in SQL:
   - the jobs that are ours as the board stages them (buyout and building, with closed read as building);
   - each pay application still open: its certificate (else what we asked) less the payments on its bill, paid on the day a payment closed it (`billMoney`);
   - its due day by the window's rule (the lead's call 4): the newest live promise made since the certificate, else the certificate's day (or the send's) plus the customer's median days to pay, else plus `owner_pay_days`. The median is inlined from `pay_speed_samples()`, since `get_billed_customer_pay_speeds` answers NULL to the service role;
   - days late, promises missed, and waiting on the architect; late first, then on time, then waiting on the architect, the biggest first;
   - last week's sends and certificates, Monday to Sunday, Central.
3. **`get_my_email_schedule` and `get_global_email_schedule`**, restated word for word from `20260915180000`, with `gc_money_monday` beside `crew_day`: the recipient's one-offs, and the dev's `gc_money_monday_requests`.
4. **The cron** `gc-money-monday-email` every 5 minutes on the :03 lane (`3-58/5`), unscheduled first if there, Vault `PROJECT_URL` and `CRON_SECRET`. Prod's `cron.job` on 2026-10-09 had one dispatcher on :03, two each on :01 and :02, four on :04, and the payroll anchor with the quarter-hour jobs on :00.

**A known gap, O5e's to close:** `get_billed_customer_pay_speeds` and `list_job_payment_promises` answer NULL to the controller, so Bill the customer and Money read no median and no promise for a controller. The email follows the full rule, so a controller's screen can disagree with the email until O5e widens those two readers.

## The lock note

`CREATE TABLE IF NOT EXISTS` takes no lock on another table. The policies and the block calls lock only the new table. `CREATE OR REPLACE FUNCTION` takes no table lock: a schedule read running at that moment finishes on the old body. `SET lock_timeout = '3s';` heads it as every migration's does.

## Verify after the push

1. **The table and its policies.** `SELECT count(*) FROM pg_policies WHERE tablename = 'gc_money_monday_email_requests';` gives at least `3`, with the read-only and twin blocks beside them.
2. **The payload is the service role's only.** `has_function_privilege('authenticated', 'public.get_gc_money_monday_payload()', 'EXECUTE')` is `false`, and the service role's is `true`.
3. **The cron.** `SELECT schedule FROM cron.job WHERE jobname = 'gc-money-monday-email';` gives `3-58/5 * * * *`.
4. **The payload against Money**: the lead's read-only check, before the first send. The first send waits on Grace's yes in Helper 15's chat.

## The SQL beds

`scripts/pgtest-gc-owner-billing.sh` re-applies this migration with Owner Billing's others, and `50_money_monday.sql` checks it on GitHub's runners. Days count from last week's Monday, so the readings hold on any day:
- the payload's rights and the cron's lane;
- a bill paid in full left out; a bill certified for less and paid in part, late past the newer of two promises, with one missed and a voided one ignored;
- a bill still with the architect, due by the customer's 20-day median and not the contract's 30;
- another customer's bill on the contract's 45 days; the order late, on time, waiting on the architect;
- last week's send and certificate;
- the requests' policies (an estimator, a wrong name, a client update), the owner's schedule and Email streams listing it, and the owner stopping it.

## Status

**Applied to prod 2026-10-09 at 12:19 UTC** by the lead (GC MODE) from a clean checkout at main's tip (9f3f555c8) with `scripts/db-push.sh` (`--include-all`); drift 823/823 after. `gc-money-monday-email` deployed the same minute with its `verify_jwt = false` entry, and `dev-mcp` with the catalog; edge drift 145/145. Verified through the management API: step 1, nine policies on `gc_money_monday_email_requests` (its three, the three twin fences, the three read-only blocks); step 2, the payload executable by the service role only; step 3, the cron `gc-money-monday-email` on `3-58/5 * * * *`, active; step 4, the payload read as the service role, rolled back, is empty today (no bills, sends or certificates; the week Sep 28 to Oct 4), which matches the Money lens, where no GC bill exists yet. The first send waits on Grace's yes in Helper 15's chat; the types ride PUNCHLIST's regeneration with 008000 and 010000.
