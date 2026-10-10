# 20261010110000_gc_schedule_tells.sql (2026-10-10, v2.5173)

GC mode, the schedule's PR 13a (`to-dos/gc-mode/mockups/schedule-pr13.md` on branch `spike/gc-mode`, with amendments 1 and 2): Tell the trades and their answers. The tables are PR 3's, `gc_schedule_move_tells` and `gc_schedule_move_answers` (`20261007220000`), dev only and append only. This adds their two writes. No table is created, so the read-only and twin blocks already cover both. Co-signed by the schedule's holder (gc 10) and, on the answer's half, the Portal (gc 3).

- **`gc_schedule_record_tells(p_project_id, p_company_id, p_email_send_log_id, p_tells jsonb)`**, `SECURITY INVOKER`, the office's record of who it told:
  - one row per move and company, `told_on` the company's day (`app_today()`), with that company's lines the move changed and the dates the message gave (`shown`), and the send's log row;
  - called by the office's screen after `gc-trade-email` sent the company its dates (13b), so the email's once-per-key and this function's `ON CONFLICT DO NOTHING` together make a press again record a send that went but was not recorded, and send nothing;
  - a move undone, or on another job, is refused whole; the company is not checked here, since `gc-trade-email` checked its invite a moment before, so it reads no Board table;
  - granted to `authenticated`, revoked from `PUBLIC` and `anon`. The tells' dev policy is its gate until the schedule's PR 10.
- **`gc_trade_answer_dates(p_company_id, p_move_id, p_ok, p_day, p_note)`**, `SECURITY INVOKER`, a company's answer from its portal (tradeAnswerDates, G-113):
  - the dates work, or another day asked for, today or later, with a note trimmed (empty is null);
  - only for a move the company was told of, while the move stands, and once;
  - its refusals are the portal's keys, `P0001` with the words as `DETAIL`: `notFound`, `notYours`, `datesTakenBack` (new), `alreadyAnswered` (a race too, caught as `unique_violation`), `badRequest`, `dayNeeded` (new), `dayPassed` and `tooLong`. The two new keys wait in `gcTradeSubmit.test.ts`'s `WAITING` for the Portal's P5d, which maps them;
  - granted to `service_role` only, for `submit-gc-trade-portal` (P5d).

Both are records: neither touches the plan's version or its log of changes.

Apply order: after main's latest. It is two `CREATE OR REPLACE FUNCTION`s, comments and grants, with `lock_timeout 3s`. It locks no table, and it is idempotent.

**Before the push**, the SQL bed (`scripts/pgtest-gc-schedule.sh`, which applies this file a second time) plays `supabase/tests/gc_schedule/30_tells.sql`, a job of its own with its days read from today. Its 23 assertions are:
- a tell of nothing, of another job's move, and of an undone move refused whole;
- a tell's row with today and the dates shown;
- the same tell again adds nothing, and the first stays;
- the version stays;
- the answer refused to a signed-in user, for a move not there, from a company not told, on a move undone since, with a day on a yes, with neither, with no day on a no, with a day before today, and with a long note;
- another day asked, with its note trimmed, and a second answer refused;
- the grants.

On main at e5e11fef4, nine of eleven bugs planted one at a time failed them: a tell of an undone move, of another job's move, a tell that overwrites the first, an answer from any company, on an undone move, a yes with a day, a no with no day, a no with a day before today, and the answer granted to signed-in users. The other two are no hole: the race's handler gives the same `alreadyAnswered` when the check before the insert is taken out, and the bed's Postgres grants no function to `anon` by default, so it cannot tell the revoke from no grant (the grants check pins the result).

## Verify after the push

1. **The two functions and their grants.**

   ```sql
   SELECT p.proname, p.prosecdef,
          has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
          has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
          has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ('gc_schedule_record_tells', 'gc_trade_answer_dates') ORDER BY p.proname;
   ```

   Expect `gc_schedule_record_tells`: `prosecdef` false, `authenticated` true, `anon` false; `gc_trade_answer_dates`: `prosecdef` false, `authenticated` false, `anon` false, `service_role` true.

2. `npm run check:migration-drift` is clean.

Nothing calls either function until the schedule's PR 13b (the tell) and the Portal's P5d (the answer), so there is nothing to press on prod.

## Rollback

```sql
DROP FUNCTION IF EXISTS public.gc_schedule_record_tells(uuid, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.gc_trade_answer_dates(uuid, uuid, boolean, date, text);
```

## Status

Merged in #5328 and pushed to prod 2026-10-10 ~12:4x UTC (`supabase db push` took it with 20261010100000; drift check 858/858). Verified read-only through the management API (`to-dos/gc-mode/scripts/verify/verify-110000.mjs` on `spike/gc-mode`): `gc_schedule_record_tells` is INVOKER, executes for `authenticated`, not `anon`; `gc_trade_answer_dates` is INVOKER, executes for `service_role` alone; both carry the v2.5173 comment. Nothing calls either until 13b and P5d.
