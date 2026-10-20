# 20261010130000_gc_customer_due_notices.sql

GC mode, Owner Billing's O12a: the customer's notice 3 days before a bill is due, its record and what is due (v2.5184). The plan is `to-dos/gc-mode/mockups/owner-billing-o12.md` on branch `spike/gc-mode` (f4ff25309), whose SQL block is this file byte for byte but for the version and the stamp, and for the two checks put on `NOT VALID` and then validated (the lead's call at the cut; the plan is amended to match).

**Why:** the owner's word on 2026-10-10, "Yes, build it": an email nobody presses tells the customer three days before a certified bill is due, behind a switch he turns on after a test copy. It is O10's call 5 and the plan's *Bills that chase themselves*.

## What it does

1. **`gc_office_notices.due_on`** (date, nullable): on a `pay_soon` notice, the due day it told the customer.
2. **Its checks**: `gc_office_notices_kind_known` gains `pay_soon`; `gc_office_notices_due_said` holds that only a `pay_soon` row names a due day. Each is dropped and added `NOT VALID`, then validated. The table's index on a pay application and kind (`gc_office_notices_pay_app_once`, O10a) makes the notice go once per pay application.
3. **`get_gc_customer_due_notices(p_today date DEFAULT NULL, p_since date DEFAULT NULL)`**, `SECURITY DEFINER`, the service role's only. Each certified pay application still open whose due day is 1 to 3 days off, certified before that day and since the switch's day, not on the card page or on card, and not told yet. The due day is `get_gc_money_monday_payload()`'s `dueOn`, the one rule Bill the customer, Money and the Monday email read: the newest promise, else the certificate's day plus their usual days to pay, else the contract's days to pay. To the project's customer, Reply-To the project manager when a real account, else the company's owner. `p_today` and `p_since` are for the bed and Preview; the cron passes neither.
4. **The switch** `app_settings.gc_customer_due_notices_on_v1` = `'false'`. On, it holds the day it went on; anything that is not a real date is off. The owner and dev flip it through `master_or_dev_update_gc_customer_due_notices_on`.

## The lock note

No table is created, so no fence calls. The `ALTER TABLE` takes `gc_office_notices`' lock for an instant: the column is metadata only and the two checks go on `NOT VALID`, with no scan. Each `VALIDATE CONSTRAINT` scans the table (a few rows) under the lighter lock, which lets reads and writes go on. `CREATE POLICY` on `app_settings` takes a brief lock on a table many reads touch, as O10a's did. `SET lock_timeout = '3s'` makes a wait fail fast; the cron touches the table at :13 past the hour, so push away from it.

## Verify after the push

Read only:
1. **The switch, off.** `SELECT value_text FROM public.app_settings WHERE key = 'gc_customer_due_notices_on_v1'` gives `false`.
2. **The column and the checks.** `information_schema.columns` has `gc_office_notices.due_on` (date, nullable); `pg_constraint` has `gc_office_notices_kind_known` naming `pay_soon` and `gc_office_notices_due_said`, both `convalidated = true`.
3. **What is due**, as the service role (psql as `postgres` is the same reader): `SELECT public.get_gc_customer_due_notices()` answers today, `since` null and no notices while the switch is off. `SELECT public.get_gc_customer_due_notices(NULL, current_date - 30)` reads as if on for 30 days.
4. **Who may read it**: in `BEGIN … ROLLBACK` as the controller, `SELECT public.get_gc_customer_due_notices()` is refused (permission denied).

Nothing sends until O12b's sender is deployed and the owner turns the switch on, after his test copy on Grace's yes.

## The SQL beds

`scripts/pgtest-gc-owner-billing.sh` re-applies this migration right after it runs and plays `96_customer_due_notices.sql`, 24 checks, on eight GC jobs of one customer in a fixed October 2026, the list read for a named day:
- the shape: both checks validated, the switch off, and nobody hears while it is;
- day by day, on since Oct 10: never on the certificate's own day; a 2-day bill only on the day before; nobody on the due day; a bill certified before the switch's day never, unless `p_since` reaches back; a promise sets the day; part paid says what is open; not with the architect, paid, or on the card page; put back to a check bill, yes;
- what a notice carries: the customer, the billing job, Reply-To the project manager, or the owner when the manager is a sample account; a promised day says so;
- once: the row written before the send takes the bill off the list, a second `pay_soon` row is refused, a `pay_soon` row must name its due day and an office kind may not;
- who: the list is the service role's; the switch flipped by a dev and the owner, not the controller or an estimator.

Mutants of the plan's SQL in a local bed, each caught: the window from the due day itself, or 4 days out; the certificate's own day; the since gate; pending card bills let through; undone ones kept out; the once check; a sample manager as Reply-To; O10's switch read for this one; the grant left to `authenticated`. One survives by being the same rule: the filter for bills with the architect repeats the certificate-day test.

## Status

Cut 2026-10-10 by Helper 5 (the Owner Billing lane), v2.5184. Open for the lead's read-back; the push follows the merge, then gc 7's types regen.

## Status

Merged in #5342 and pushed to prod 2026-10-10 ~14:45 UTC (`supabase db push` took it alone; drift check 860/860). Verified read-only through the management API (`to-dos/gc-mode/scripts/verify/verify-130000.mjs` on `spike/gc-mode`): the switch reads `false`; `due_on` is a nullable date; `gc_office_notices_kind_known` and `gc_office_notices_due_said` are validated and name `pay_soon`; `get_gc_customer_due_notices()` answers today with `since` null and no notices, and the 30-day read answers no notices too (no certified bill on prod); the controller is refused and only `service_role` may execute. Nothing sends until O12b is deployed and the owner turns the switch on. The types regen rides #5345 with 120000's.
