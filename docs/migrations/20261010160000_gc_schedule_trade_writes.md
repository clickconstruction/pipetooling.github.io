# 20261010160000_gc_schedule_trade_writes.sql (2026-10-10, v2.5196)

GC mode, the schedule's PR 14a (`to-dos/gc-mode/mockups/schedule-pr14.md` on branch `spike/gc-mode`, with amendment 1): a trade's four writes from its portal, on PR 3's tables (`gc_schedule_late_notices`, `gc_schedule_crew_counts`, `gc_schedule_lookahead_marks`, `20261007220000`). The Portal's P5d-ii adds their kinds to `submit-gc-trade-portal`, which calls each with the link's company first. No table is created, so the read-only and twin blocks already cover all three. Co-signed by the schedule's holder (gc 10) and, on the portal's half, the Portal (gc 3).

Each verb is `SECURITY INVOKER`, revoked from `PUBLIC`, `anon` and `authenticated`, and granted to `service_role` only. Each checks that the company owns the trade: awarded to it, not our own crew's, on a job being built (the RFI verb's join). Each raises the portal's keys as `P0001`, with its words as `DETAIL`. All four are records: none touches the plan or its version, and each day is the company's (`app_today()`).

- **`gc_trade_say_late(p_company_id, p_activity_id, p_day, p_reason, p_note)`** returns the notice's id (tradeSayLate, G-117).
  - It takes the company's own trade's line, not an inspection or the job's own work, that is not done.
  - Under way and done read as `lateDoor` reads them: the bar's actual days, or the line's percent as `lineOf` reads it. That is the open send-back's `we_see` on the line (the pay application sent back and not yet sent again), else the newest `gc_sow_line_reports` row (a trade's report or a pay application's claim, which sets no real day), else 0. A trade that reports only through its pay applications reads under way.
  - Under way, it asks a new finish, and the start stays. Not started, it asks a new start, and the bar moves whole, keeping its length (`lateTarget`).
  - The day is after the one it changes and not before today, with a reason from the five and a sentence of eight letters or more. `sent_by` is the company's contact, else its name.
- **`gc_trade_keep_day(p_company_id, p_notice_id)`** (tradeKeepDay): the company keeps its day after the office pushed its notice back. It needs the company's own notice, pushed back and not kept, and still standing: not taken by a standing move, not replaced by a newer notice on the bar, and the bar where the notice found it (`lateNoticeState`).
- **`gc_trade_set_crew_count(p_company_id, p_package_id, p_week_of, p_count)`** (tradeSetCrewCount, G-142): people a day for its own trade.
  - The week is this Monday or the next two (`crewWeeks`), and the count a whole number from 0 to 50 (`CREW_MAX`), on a job with a schedule.
  - The same as the count that stands keeps nothing new. The table stays append only, and the newest counts.
- **`gc_trade_mark_lookahead(p_company_id, p_activity_id, p_week_of, p_done, p_reason)`** (tradeMarkLookAhead, G-114): its own line, done or not done with a reason.
  - The week is this week or last week (the portal's `canMark`), on a bar that runs that week.
  - One mark per bar and week, changed in place until our superintendent checks it. The upsert's `WHERE` holds the check against a race.

The keys reused, already mapped: `notFound`, `notOnTrade`, `notYours`, `jobNotBuilding`, `badRequest`, `dayPassed`, `alreadyAnswered`, `noteNeeded` and `tooLong`. The eight new ones wait in `gcTradeSubmit.test.ts`'s `WAITING` for P5d-ii: `workDone`, `lateLaterDay`, `pickWhy`, `notPushedBack`, `noticeClosed`, `weekClosed`, `crewWhole` and `alreadyChecked`.

Apply order: after main's latest. It is four `CREATE OR REPLACE FUNCTION`s, comments and grants, with `lock_timeout 3s`. It locks no table, and it is idempotent.

**Before the push**, the SQL bed (`scripts/pgtest-gc-schedule.sh`, which applies this file a second time) plays `supabase/tests/gc_schedule/40_trade_writes.sql`: a job of its own, with every day read from today, and 53 assertions. They cover every refusal, and these:
- a notice not started moves the bar whole;
- one under way keeps its start;
- 30% by a pay application with no real days is under way;
- an open send-back seeing 0 on the line wins over its 30%;
- 100% by a pay application is done;
- the day kept, and refused once taken, replaced or moved;
- the same crew count twice kept once;
- a mark changed in place, then refused once checked;
- the grants.

On main at d61ad6467, 26 of 27 bugs planted one at a time failed them. The 27th, a late notice on an inspection with the kind's check taken out, is held by the table itself, since a bar that is not a line carries no trade (`gc_schedule_activities_line_or_label`).

## Verify after the push

1. **The four functions and their grants.**

   ```sql
   SELECT p.proname, p.prosecdef,
          has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
          has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
          has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ('gc_trade_say_late', 'gc_trade_keep_day', 'gc_trade_set_crew_count', 'gc_trade_mark_lookahead')
   ORDER BY p.proname;
   ```

   Expect four rows, each with `prosecdef` false, `authenticated` false, `anon` false and `service_role` true.

2. `npm run check:migration-drift` is clean.

Nothing calls them until the Portal's P5d-ii, so there is nothing to press on prod.

## Rollback

```sql
DROP FUNCTION IF EXISTS public.gc_trade_say_late(uuid, uuid, date, text, text);
DROP FUNCTION IF EXISTS public.gc_trade_keep_day(uuid, uuid);
DROP FUNCTION IF EXISTS public.gc_trade_set_crew_count(uuid, uuid, date, integer);
DROP FUNCTION IF EXISTS public.gc_trade_mark_lookahead(uuid, uuid, date, boolean, text);
```
