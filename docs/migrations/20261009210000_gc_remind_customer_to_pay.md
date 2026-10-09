# 20261009210000_gc_remind_customer_to_pay.sql

GC mode, Owner Billing's O5b: our reminder to pay a late bill (v2.5000). The plan is `to-dos/gc-mode/mockups/owner-billing-o5.md` → *O5b*, and the SQL is that mockup's, byte for byte, on branch `spike/gc-mode` as amended at b96f3fd0d (*O5b as built*). It needs O1's `gc_owner_pay_reminders` (`20261008010000`), O4a-1's `invoice_id` on the pay applications (`20261009200000`) and the Pipeline's `add_payment_chase_touch` (`20260822000000`).

It is additive and idempotent: one function, no table, no lock on a table.

## What it does

**`gc_remind_customer_to_pay(pay_app, on, pay_by, note, subject, lines)`**, SECURITY INVOKER.

It refuses, in words:
- a pay application that is not there, or one the caller's RLS hides;
- one still waiting on the architect;
- one certified at nothing, which has no bill;
- one paid in full, read from its bill's status through `invoice_id`;
- a day other than `app_today()`;
- a pay-by day before today;
- an email with no subject, or no lines;
- a project with no customer.

It writes the `gc_owner_pay_reminders` row: the day, `sent_by` the caller, the pay-by day, the office's line, and the subject and lines trimmed, with blank lines dropped.

It puts one note on the Pipeline's Payment Chase queue through `add_payment_chase_touch(customer, billing job, 'note', '<subject> · pay by <Dy Mon D>', NULL, NULL)`: the project's customer, pinned to its billing job. Never a promise: the day the bill was due stays.

It returns the reminder's id. `gc-customer-email` sends it in the words it was filed with, then writes `email_send_log_id` back through O1's one door on a sent reminder.

The money team's policy on the reminders is its gate (`gc_money_team()`), and O1's read-only and twin blocks hold, so a training account is refused at the insert. `add_payment_chase_touch` is SECURITY DEFINER and lets in dev, master and assistant-like roles; `is_assistant()` counts the controller, so the whole money team passes. An estimator finds no pay application.

## The lock note

`CREATE OR REPLACE FUNCTION` and its grants take no lock on a table. `SET lock_timeout = '3s';` heads it as every migration's does. It goes in the lead's morning batch with the award's.

## Verify after the push

1. **The function is there once, SECURITY INVOKER, for the signed in only.**
   `SELECT count(*), bool_and(NOT prosecdef) FROM pg_proc WHERE proname = 'gc_remind_customer_to_pay';` gives `1, true`. `has_function_privilege('anon', 'public.gc_remind_customer_to_pay(uuid, date, date, text, text, text[])', 'EXECUTE')` is false.
2. **It refuses in words.** As a dev, in one transaction that rolls back (`BEGIN;`, then `set_config('request.jwt.claims', …)` BEFORE `SET LOCAL ROLE authenticated`, then `ROLLBACK;`), a reminder on a made-up id is refused with *That pay application is not there.* Nothing is written.
3. **The check to the inbox** waits for Grace's yes in Helper 15's chat: a real reminder on the test project's certified test bill, held late, emailed to bids@clickplumbing.com only. Its row, its chase touch and its sent copy are then all there.

## The SQL beds

`scripts/pgtest-gc-owner-billing.sh` applies it a second time, which must change nothing. `supabase/tests/gc_owner_billing/20_scenario.sql` presses it as the controller, an estimator and a dev in training mode:
- each refusal in its words;
- the reminder as it went;
- its one chase touch on the billing job;
- a refusal once the Pipeline marks the bill paid in full.

## Status

**Applied to prod 2026-10-09 at 09:13 UTC** by the lead (GC MODE) in the morning batch (`scripts/db-push.sh`, `--include-all`, with 140000 and 220000); drift 813/813. Verified through the management API, rolled back: step 1, the function once, SECURITY INVOKER, not executable by `anon`; step 2, a reminder on a made-up id as a dev gave *That pay application is not there.* and wrote nothing (0 reminders after). Step 3, the check to the inbox, waits on Grace's yes in Helper 15's chat.
