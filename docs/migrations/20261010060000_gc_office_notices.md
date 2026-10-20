# 20261010060000_gc_office_notices.sql

GC mode, Owner Billing's O10a: the office's notices, their record and what is due (v2.5137). The plan is `to-dos/gc-mode/mockups/owner-billing-o10.md` on branch `spike/gc-mode` (92ce022d0), whose first SQL block is this file byte for byte but for the version. The sender, `gc-office-notices`, and its cron are O10b.

**Why:** three emails the README's *Billing the owner's events* promised the office, which nobody presses: the project manager two days before bill day (the 25th), the architect three days after a pay application went with no certificate, and the project manager at five (the owner's call 6's defaults). The lead approved the plan 2026-10-09 with its five defaults and one rule of the lead's own: no notice on a pay application sent before the switch went on, so turning it on never fires a backlog.

## What it does

1. **`gc_office_notices`**: one row per notice sent (`bill_day`, `certify_reminder`, `certify_late`), about a bill day or a pay application, with who heard it and the address it went to. `gc_office_notices_bill_day_once` (per project and bill day) and `gc_office_notices_pay_app_once` (per pay application and kind) make the sender's insert before each send a no-op the second time, so each notice goes at most once. The money team reads the rows (`gc_office_notices_money_read`); nobody signed in writes one (only the service role). The three fences.
2. **`get_gc_office_notices_due(p_today date DEFAULT NULL, p_since date DEFAULT NULL)`**, `SECURITY DEFINER`, the service role's only. What is due on a day and not sent yet, with what the words need:
   - `bill_day` on the 23rd and 24th: a job being built, its contract signed, no pay application whose period runs to this bill day or later and no final one. With the next number and the trades we paid that still owe an unconditional waiver (a paid draw with only the conditional one in).
   - `certify_reminder` from the third day after a pay application went uncertified, to the architect (`architect_customer_id`), Reply-To the project manager.
   - `certify_late` from the fifth, with the day the architect was reminded.
   - **Who hears ours**: the project manager when a real account on the money team (dev, master, controller; not a sample, a twin or archived), else the company's owner (`company_owner_user_id()`); neither, nobody. The role list is held to `GC_MONEY_TEAM` by `access.test.ts`, the 25 to `OWNER_BILL_DAY` by `ownerBillingNotices.test.ts`.
   - **The on-date**: a pay application's notices only for one sent since `p_since`, else since the switch's day; none while it is off. `p_today` and `p_since` are for the bed and Preview; the cron passes neither.
3. **The switch** `app_settings.gc_office_notices_on_v1` = `'false'`. On, it holds the day it went on (an ISO date, which the Settings toggle writes); anything that is not a real date is off. The owner and dev flip it through `master_or_dev_update_gc_office_notices_on`, O8c's pattern (`20261010042000`). Holding the day in the value takes no new column on `app_settings`, which every page reads.

## The lock note

`CREATE TABLE` takes no lock on another table but its foreign keys' (`gc_projects`, `gc_owner_pay_apps`, `users`, `customers`, `email_send_log`), briefly. `CREATE POLICY` on `app_settings` takes a brief lock on a table many reads touch. `SET lock_timeout = '3s';` heads it, so a busy moment fails the push fast.

## Verify after the push

Read only:
1. **The switch, off.** `SELECT value_text FROM public.app_settings WHERE key = 'gc_office_notices_on_v1'` gives `false`.
2. **The record, empty, and its doors.** `SELECT count(*) FROM public.gc_office_notices` gives 0; `pg_policies` has `gc_office_notices_money_read` (`SELECT`) and no other permissive policy; `pg_indexes` has the two `_once` indexes.
3. **What is due**, as the service role (psql as `postgres` is the same reader): `SELECT public.get_gc_office_notices_due()` answers today, the bill day and its notices. With the switch off, only bill day can show, and only on the 23rd or 24th.
4. **Who may read it**: in `BEGIN … ROLLBACK` as the controller, `SELECT public.get_gc_office_notices_due()` is refused (permission denied).

Nothing sends until O10b's function and cron are deployed and the owner turns the switch on, after the live walk on Grace's yes.

## The SQL beds

`scripts/pgtest-gc-owner-billing.sh` re-applies this migration right after it runs and plays `93_office_notices.sql`, 32 checks, on eight GC jobs in a fixed October 2026 (the payload read for a named day, so the bed never depends on the day it runs):
- the shape: the two once-each indexes, the money read policy and no write, the payload the service role's alone;
- day by day, the switch on since Oct 10: no bill day notice on the 22nd or the 25th; the 23rd and the 24th the same, once; never a job bidding, in buyout, unsigned, sent already or finished; the architect from the third day and the project manager from the fifth, never before;
- the words' facts: the next number, who hears, the waivers owed by company and draw, the amount and day, the project manager to reply to, no architect and no reminder;
- once each: a written notice is gone, a second insert skipped, each pay application its own; a notice that says what it is about, and no more;
- the on-date: a pay application sent before it hears nothing, one after it does; `'false'`, `'true'` and a day that never was are off; `p_since` reads as given;
- who hears ours: the money-team project manager, else the owner, else no one;
- the record read by the money team and not an estimator, written by no one signed in; the payload refused to the controller;
- the switch flipped by the owner and a dev, not the controller, an estimator or a trainee.

It ran on a local Docker copy of the whole schema with every migration applied; all eleven Owner Billing files passed. Six mutants of the migration were each caught by the check meant for it: the on-date dropped (the backlog fired), the bill-day window from 0 (bill day itself reminded), the architect at 2 days, the money team's role check dropped from the project manager (an estimator heard), the once-each index per project instead of per pay application (a second pay application's reminder could not go), and the read policy on the office team (an estimator read the record).

## Status

Cut 2026-10-09 by Helper 5 (the Owner Billing lane). Merged 2026-10-10 at about 05:12 UTC (#5269). Pushed to prod at 05:16 UTC by the GC MODE lead with `bash scripts/db-push.sh`, plain, the only pending file (drift 848 local / 848 remote, fully applied). Verified the same minute with the spike's `to-dos/gc-mode/scripts/verify/verify-060000.mjs`, writes rolled back: 1 `gc_office_notices_on_v1` reads `false`; 2 `gc_office_notices` has zero rows, one permissive policy `gc_office_notices_money_read` (SELECT) beside the six fence policies, and its two `_once` indexes; 3 as the service role `get_gc_office_notices_due()` answers today 2026-10-09, bill day 2026-10-25 and an empty notices list while the switch is off; 4 the controller is refused with *permission denied for function get_gc_office_notices_due*. A types regen (the table and the function) follows as its own PR; O10b cuts on it, then the function deploys and the cron migration pushes.
