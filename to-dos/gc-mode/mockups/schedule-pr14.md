---
name: "The schedule's PR 14: the trade's side in its portal"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 14, decisions 9 and 10, Keeping it true (late notices, crew counts, look-ahead marks) and The trade's writes; PORTAL_REAL_BUILD.md, P5d and the schedule's seam; GANTT_FEATURES.md G-110, G-114, G-117, G-142, G-146
branch: the plan on claude/gc-schedule-pr14-plan (from origin/spike/gc-mode at 3d4c360cc); the code from origin/main in three cuts, one with a migration
status: plan 2026-10-10 by gc 4 at the lead's ask, for gc 10 (Schedule) and gc 3 (Portal, calls 1, 8 and 9) to co-sign. 14a's SQL ran on the real bed on main at d61ad6467. Nothing cut or claimed.
---

# The schedule's PR 14: the trade's side in its portal

## What it is

A trade partner works its own side of the schedule from its portal: it says a bar will be late, keeps its day after
the office pushes back, says how many people it sends a day, and marks its look-ahead done or not done, and it sees
its own chart. The office takes a late notice as a move or pushes it back, and our superintendent checks the marks.

What is on main already:

| Piece | On main | From |
|---|---|---|
| `gc_schedule_late_notices` (with `pushed_back_*` and `kept_on`), `gc_schedule_crew_counts`, `gc_schedule_lookahead_marks` | applied, dev-only policies; the first two append only, a column grant for the push back | PR 3 (`20261007220000`) |
| `gc_schedule_moves.late_notice_id`, and `gc_schedule_save_move` refusing a notice taken already | applied | PRs 3 and 5 |
| Their read into `ProjectSchedule.lateNotices`, `.lookAhead` and `GcProject.crewCounts` | built | PR 6 (`rows.ts`, `scheduleIo.ts`) |
| The kernels: `lateDoor`, `lateTarget`, `lateNoticeState`, `lateNoticeRows`, `lateNoticeMove`, `portalLateNotice`; `crewWeeks`, `crewCountAllowed`, `crewCountsNow`; `verifyList`, `lookAheadWeeks`; `portalLookAhead`, `lookAheadOwed`; `portalSchedule` | lifted | PR 1b, the Portal's P0 |
| The office's three writes, `pushBackLateNotice`, `verifyLookAhead`, `crewMarkLookAhead` | built, never called | PR 6 |
| The words in both languages (`late*`, `crewWhole`, `reason*`, `whyNot`) | built | the Portal's P0 |
| The chart's late tails (`lateNoticeTails`) and the counts' reasons (`counts.ts`, G-146) | built, empty | PRs 7 and 9 |

Nothing writes a notice, a count or a trade's mark, and no screen offers the office's three. Three cuts:

- **14a, the trade's four writes** (one migration): `gc_trade_say_late`, `gc_trade_keep_day`, `gc_trade_set_crew_count`
  and `gc_trade_mark_lookahead`, for the Portal's P5d-ii to call, with their bed and the new keys in `WAITING`. No screen.
- **14b, the trade's chart** (decision 10, its own plan with gc 3): the portal's read works out `portalSchedule` from
  the rows with a generated copy of the kernels, and returns only its answer.
- **14c, the office's side** (no migration, after 14a): the late notices card (Take, Push back, Call) and our
  superintendent's check (the trades' marks, our crew's own, the inspections), on the io already on main.

## The calls

**For gc 10 (Schedule) and gc 3 (Portal, calls 1, 8 and 9), each with the other way:**

1. **The verbs are this lane's, their kinds the Portal's P5d-ii** (gc 3's seam, as in 13a, U3b to U6 and P5c). Each is
   `SECURITY INVOKER`, granted to `service_role` only, with the link's company first and a key raised as `P0001` with
   its words as `DETAIL`. That is main's practice for every `gc_trade_*`; PORTAL_REAL_BUILD l.52 says `DEFINER`, which
   the service role does not need. *Other way:* `DEFINER`, which buys nothing.
2. **Every verb checks the company's own trade.** The trade is awarded to it (the RFI verb's join: `gc_trade_packages`
   to `gc_projects` and the awarded invite), it is not our own crew's, and the job is being built. A notice and a mark
   also need a trade's line, never an inspection or the job's own work. The prototype's reducer left the mark's checks
   to the portal's screen; the server makes them the rule. *Other way:* the reducer's checks only.
3. **Days are the company's, weeks its ISO Mondays** (`app_today()`). A crew count is for this week or the next two
   (`crewWeeks`). A mark is for this week or last week (the portal's `canMark`), on a bar that runs that week.
4. **A late notice is the kernel's** (`lateDoor`, `lateTarget`, and `lateNoticeProblem`'s order):
   - its own line, not finished (no actual finish);
   - under way means an actual start, which a trade's report sets (U6a). Then it asks a new finish, and the start stays;
   - not started, it asks a new start, and the bar moves whole, keeping its length;
   - the day is after the one it changes, and not before today;
   - a reason from the five, and a sentence of eight letters or more;
   - `sent_by` is the company's contact, else its name.

   A second notice on the bar replaces the first. Its state is worked out (`lateNoticeState`), never stored.
5. **The day kept after a push back** is the company's own notice, pushed back and not kept, and still standing: not
   taken by a standing move, not replaced by a newer notice on the bar, and the bar where the notice found it. Else
   `noticeClosed`.
6. **A crew count is a whole number from 0 to 50** (`CREW_MAX`). The same as the count that stands keeps nothing new,
   as the reducer does. The table stays append only, and the newest for a trade and week counts (`crewCountsNow`).
7. **A mark changes in place until it is checked.** One per bar and week, set by the company
   (`marked_by_company_id`). A mark our superintendent checked is refused (`alreadyChecked`); the upsert's own `WHERE`
   holds it against a check made a moment before.
8. **The keys** (with gc 3):
   - reused, already mapped: `notFound`, `notOnTrade`, `notYours`, `jobNotBuilding`, `badRequest`, `dayPassed`,
     `alreadyAnswered`, `noteNeeded`, `tooLong`;
   - new, parked in `gcTradeSubmit.test.ts`'s `WAITING` as `'P5d'`: `workDone`, `lateLaterDay`, `pickWhy`,
     `notPushedBack`, `noticeClosed`, `weekClosed`, `crewWhole` and `alreadyChecked`.

   The `DETAIL` words are English, for the office's logs, and match the portal's words where it has them
   (`lateFromToday`, `lateLaterDay`, `latePickWhy`, `crewWhole`). P5d-ii adds the rest in both languages.
9. **The chart's bundle** (decision 10), tested on Supabase's edge runtime (v1.70.0, locally, 2026-10-10):
   - **A function cannot import `src/lib` as it is.** Its imports carry no `.ts`, and the runtime stops at the first
     (`Module not found ".../schedule". Maybe add a '.ts' extension`). Deno's `sloppy-imports` is not honored there.
   - **A copy with `.ts` on its relative imports loads** (`portalSchedule is a function`). Type-only imports of files
     outside the copy are fine, since Deno never loads them.
   - What the read needs, value imports only: `portalSchedule`, `boardStateFromRows`, `withDraws` and the schedule's
     `rows.ts` are 28 files and 8,301 lines, all pure, with no package import.

   So 14b generates the copy (`scripts/edge-kernels.mjs` into `supabase/functions/_shared/gcKernels/`), with a test
   that regenerates it and fails when it differs, as every generated file is kept. The read builds the board for the
   company's awarded jobs and returns `portalSchedule`'s answer. 14b gets its own plan with gc 3, who co-signs the
   slice. *Other way:* `.ts` extensions through `src/lib`, which touches every importer of 28 files and still leaves
   deploying files outside `supabase/` unproved.
10. **The office's side is 14c**, on the io already on main:
    - the late notices card (`lateNoticeRows`): **Take {day}** opens *Why it moved* filled in with the notice
      (`lateNoticeMove`, saved through `gc_schedule_move`); **Push back** with a sentence (`pushBackLateNotice`);
      **Call**;
    - our superintendent's check (`verifyList`): a trade's mark verified or corrected (`verifyLookAhead`), our crew's
      own marked (`crewMarkLookAhead`), the inspections listed;
    - for those who may move a bar, never in the what-if copy.

    No migration. *Other way:* the office's side in 14a, which puts a screen in the PR the Portal waits on.

## 14a: the trade's four writes

The migration, byte for byte but for the `v2.NNNN` swap and its stamp, claimed past every open claim at the cut:

```sql
SET lock_timeout = '3s';

-- GC mode, the schedule's PR 14a (v2.NNNN): a trade's four writes from its portal (to-dos/gc-mode/mockups/schedule-pr14.md
-- on branch spike/gc-mode), on PR 3's tables: a late notice and the day kept after the office's push back
-- (gc_schedule_late_notices), a crew count (gc_schedule_crew_counts) and a look-ahead mark (gc_schedule_lookahead_marks).
-- The Portal's P5d-ii adds their kinds to submit-gc-trade-portal, which calls each with the link's company first. Each
-- checks what the prototype's reducer and the portal's screen check, raises the portal's keys with their words as
-- DETAIL, and runs only as the service role. All are records: none touches the plan or its version, and each day is the
-- company's (app_today()). No table is created.

-- A late notice from the company (tradeSayLate, G-117): its own trade's line, awarded to it, on a job being built, not
-- finished. Under way (an actual start: a trade's report sets one), it asks a new finish; not started, a new start, the
-- bar moving whole and keeping its length. The day is after the one it changes and not before today, with a reason and
-- a sentence. A second notice on the same bar replaces the first (lateNoticeState). Returns the notice's id.
CREATE OR REPLACE FUNCTION public.gc_trade_say_late(p_company_id uuid, p_activity_id uuid, p_day date, p_reason text, p_note text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_bar public.gc_schedule_activities%ROWTYPE;
  v_ours boolean;
  v_stage text;
  v_company uuid;
  v_started boolean;
  v_day date;
  v_note text := btrim(coalesce(p_note, ''));
  v_by text;
  v_id uuid;
BEGIN
  SELECT * INTO v_bar FROM public.gc_schedule_activities WHERE id = p_activity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No bar with that id.';
  END IF;
  SELECT k.ours, g.stage, i.company_id INTO v_ours, v_stage, v_company
  FROM public.gc_trade_packages k
  JOIN public.gc_projects g ON g.project_id = k.project_id
  LEFT JOIN public.gc_invites i ON i.id = k.awarded_invite_id
  WHERE k.id = v_bar.package_id;
  IF v_bar.kind <> 'line' OR v_ours IS DISTINCT FROM false OR v_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company we awarded this trade can say its work will be late.';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'jobNotBuilding' USING ERRCODE = 'P0001', DETAIL = 'A late notice opens once we are building the job.';
  END IF;
  IF v_bar.actual_finish IS NOT NULL THEN
    RAISE EXCEPTION 'workDone' USING ERRCODE = 'P0001', DETAIL = 'That work is done.';
  END IF;
  v_started := v_bar.actual_start IS NOT NULL;
  v_day := CASE WHEN v_started THEN v_bar.finish ELSE v_bar.start END;
  IF p_day IS NULL THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'Pick the day.';
  END IF;
  IF p_day <= v_day THEN
    RAISE EXCEPTION 'lateLaterDay' USING ERRCODE = 'P0001', DETAIL = format('Pick a day after %s.', to_char(v_day, 'FMMon FMDD'));
  END IF;
  IF p_day < public.app_today() THEN
    RAISE EXCEPTION 'dayPassed' USING ERRCODE = 'P0001', DETAIL = 'Pick today or a later day.';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('weather', 'trade before', 'materials', 'crew', 'other') THEN
    RAISE EXCEPTION 'pickWhy' USING ERRCODE = 'P0001', DETAIL = 'Pick why.';
  END IF;
  IF char_length(v_note) < 8 THEN
    RAISE EXCEPTION 'noteNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say what happened, in a sentence.';
  END IF;
  IF char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the note under 2,000 characters.';
  END IF;
  SELECT coalesce(nullif(btrim(contact_name), ''), name) INTO v_by FROM public.gc_companies WHERE id = p_company_id;
  INSERT INTO public.gc_schedule_late_notices
    (project_id, company_id, activity_id, sent_on, sent_by, started, was_start, was_finish, to_start, to_finish, reason, note)
  VALUES (
    v_bar.project_id, p_company_id, v_bar.id, public.app_today(), coalesce(v_by, 'The company'), v_started,
    v_bar.start, v_bar.finish,
    CASE WHEN v_started THEN v_bar.start ELSE p_day END,
    CASE WHEN v_started THEN p_day ELSE p_day + (v_bar.finish - v_bar.start) END,
    p_reason, v_note
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- The company keeps its day after the office pushed its notice back (tradeKeepDay): its own notice, pushed back and not
-- kept, and still standing: not taken by a move, not replaced by a newer notice on the bar, and the bar where the notice
-- found it (lateNoticeState). The office's push back sets its three columns through its own column grant.
CREATE OR REPLACE FUNCTION public.gc_trade_keep_day(p_company_id uuid, p_notice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_schedule_late_notices%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.gc_schedule_late_notices WHERE id = p_notice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No notice with that id.';
  END IF;
  IF v.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notYours' USING ERRCODE = 'P0001', DETAIL = 'That notice is another company''s.';
  END IF;
  IF v.kept_on IS NOT NULL THEN
    RAISE EXCEPTION 'alreadyAnswered' USING ERRCODE = 'P0001', DETAIL = 'You said you will make the day already.';
  END IF;
  IF v.pushed_back_on IS NULL THEN
    RAISE EXCEPTION 'notPushedBack' USING ERRCODE = 'P0001', DETAIL = 'The office has not answered that notice yet.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_schedule_moves WHERE late_notice_id = v.id AND undone_on IS NULL)
     OR EXISTS (
       SELECT 1 FROM public.gc_schedule_late_notices n
       WHERE n.company_id = v.company_id AND n.activity_id = v.activity_id AND n.created_at > v.created_at
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.gc_schedule_activities a WHERE a.id = v.activity_id AND a.start = v.was_start AND a.finish = v.was_finish
     ) THEN
    RAISE EXCEPTION 'noticeClosed' USING ERRCODE = 'P0001', DETAIL = 'That notice is closed. The schedule moved since.';
  END IF;
  UPDATE public.gc_schedule_late_notices SET kept_on = public.app_today() WHERE id = v.id;
END;
$$;

-- A crew count from the company (tradeSetCrewCount, G-142): how many people its own trade sends a day in one of the
-- look-ahead's weeks (this Monday and the next two, crewWeeks), a whole number from 0 to 50 (CREW_MAX). On a job being
-- built that has a schedule. The same as the count that stands keeps nothing new; the newest for a trade and week counts.
CREATE OR REPLACE FUNCTION public.gc_trade_set_crew_count(p_company_id uuid, p_package_id uuid, p_week_of date, p_count integer)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_project uuid;
  v_ours boolean;
  v_stage text;
  v_company uuid;
  v_monday date := public.app_today() - (extract(isodow FROM public.app_today())::integer - 1);
BEGIN
  SELECT k.project_id, k.ours, g.stage, i.company_id INTO v_project, v_ours, v_stage, v_company
  FROM public.gc_trade_packages k
  JOIN public.gc_projects g ON g.project_id = k.project_id
  LEFT JOIN public.gc_invites i ON i.id = k.awarded_invite_id
  WHERE k.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No trade with that id.';
  END IF;
  IF v_ours OR v_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company we awarded this trade can give its crew.';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'jobNotBuilding' USING ERRCODE = 'P0001', DETAIL = 'Crew counts open once we are building the job.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_schedules WHERE project_id = v_project) THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'This job has no schedule yet.';
  END IF;
  IF p_week_of IS NULL OR extract(isodow FROM p_week_of) <> 1 THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'A week starts on a Monday.';
  END IF;
  IF p_week_of NOT IN (v_monday, v_monday + 7, v_monday + 14) THEN
    RAISE EXCEPTION 'weekClosed' USING ERRCODE = 'P0001', DETAIL = 'Give a count for this week or the next two.';
  END IF;
  IF p_count IS NULL OR p_count < 0 OR p_count > 50 THEN
    RAISE EXCEPTION 'crewWhole' USING ERRCODE = 'P0001', DETAIL = 'A whole number, 0 to 50.';
  END IF;
  -- The same as the count that stands: nothing new to keep.
  IF (
    SELECT c.count FROM public.gc_schedule_crew_counts c
    WHERE c.package_id = p_package_id AND c.week_of = p_week_of
    ORDER BY c.said_on DESC, c.created_at DESC LIMIT 1
  ) IS NOT DISTINCT FROM p_count THEN
    RETURN;
  END IF;
  INSERT INTO public.gc_schedule_crew_counts (project_id, package_id, company_id, week_of, count, said_on)
  VALUES (v_project, p_package_id, p_company_id, p_week_of, p_count, public.app_today());
END;
$$;

-- A look-ahead mark from the company (tradeMarkLookAhead, G-114): its own trade's line, awarded to it, on a job being
-- built, for this week or last week (the portal's canMark), a Monday the bar runs in. Done, or not done with one of the
-- reasons. It changes until our superintendent checks it; then it stays. One mark per bar and week.
CREATE OR REPLACE FUNCTION public.gc_trade_mark_lookahead(p_company_id uuid, p_activity_id uuid, p_week_of date, p_done boolean, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_bar public.gc_schedule_activities%ROWTYPE;
  v_ours boolean;
  v_stage text;
  v_company uuid;
  v_monday date := public.app_today() - (extract(isodow FROM public.app_today())::integer - 1);
BEGIN
  SELECT * INTO v_bar FROM public.gc_schedule_activities WHERE id = p_activity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No bar with that id.';
  END IF;
  SELECT k.ours, g.stage, i.company_id INTO v_ours, v_stage, v_company
  FROM public.gc_trade_packages k
  JOIN public.gc_projects g ON g.project_id = k.project_id
  LEFT JOIN public.gc_invites i ON i.id = k.awarded_invite_id
  WHERE k.id = v_bar.package_id;
  IF v_bar.kind <> 'line' OR v_ours IS DISTINCT FROM false OR v_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company we awarded this trade can mark its work.';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'jobNotBuilding' USING ERRCODE = 'P0001', DETAIL = 'The look-ahead opens once we are building the job.';
  END IF;
  IF p_week_of IS NULL OR extract(isodow FROM p_week_of) <> 1 THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'A week starts on a Monday.';
  END IF;
  IF p_week_of NOT IN (v_monday, v_monday - 7) THEN
    RAISE EXCEPTION 'weekClosed' USING ERRCODE = 'P0001', DETAIL = 'Mark this week or last week.';
  END IF;
  IF v_bar.start > p_week_of + 6 OR v_bar.finish < p_week_of THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'That work does not run that week.';
  END IF;
  IF p_done IS NULL OR (p_done AND p_reason IS NOT NULL) THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'Say done, or not done and why.';
  END IF;
  IF NOT p_done AND (p_reason IS NULL OR p_reason NOT IN ('weather', 'trade before', 'materials', 'crew', 'other')) THEN
    RAISE EXCEPTION 'pickWhy' USING ERRCODE = 'P0001', DETAIL = 'Pick why.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_schedule_lookahead_marks WHERE activity_id = p_activity_id AND week_of = p_week_of AND verified_on IS NOT NULL) THEN
    RAISE EXCEPTION 'alreadyChecked' USING ERRCODE = 'P0001', DETAIL = 'Our superintendent checked it already.';
  END IF;
  INSERT INTO public.gc_schedule_lookahead_marks (activity_id, week_of, done, reason, marked_on, marked_by_company_id)
  VALUES (p_activity_id, p_week_of, p_done, p_reason, public.app_today(), p_company_id)
  ON CONFLICT (activity_id, week_of) DO UPDATE
    SET done = EXCLUDED.done, reason = EXCLUDED.reason, marked_on = EXCLUDED.marked_on,
        marked_by_company_id = EXCLUDED.marked_by_company_id, marked_by = NULL
    WHERE public.gc_schedule_lookahead_marks.verified_on IS NULL;
  -- Checked between the look and the write: the check stands.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'alreadyChecked' USING ERRCODE = 'P0001', DETAIL = 'Our superintendent checked it already.';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.gc_trade_say_late(uuid, uuid, date, text, text) IS
  'GC mode (v2.NNNN): a late notice from the trade''s portal (tradeSayLate, G-117) on its own line, awarded to it, on a job being built, not finished; a new finish under way, a new start not started; the day after the one it changes and not before today; a reason and a sentence. Returns the notice''s id. Service role only.';
COMMENT ON FUNCTION public.gc_trade_keep_day(uuid, uuid) IS
  'GC mode (v2.NNNN): the company keeps its day after the office pushed its notice back (tradeKeepDay): its own notice, pushed back, not kept, not taken, replaced or moved. Service role only.';
COMMENT ON FUNCTION public.gc_trade_set_crew_count(uuid, uuid, date, integer) IS
  'GC mode (v2.NNNN): a crew count from the trade''s portal (tradeSetCrewCount, G-142) for its own trade, this week or the next two, 0 to 50; the same as the count that stands keeps nothing. Service role only.';
COMMENT ON FUNCTION public.gc_trade_mark_lookahead(uuid, uuid, date, boolean, text) IS
  'GC mode (v2.NNNN): a look-ahead mark from the trade''s portal (tradeMarkLookAhead, G-114) on its own line, this week or last week, done or not done with a reason, until our superintendent checks it. Service role only.';

-- Only the service role: the portal's submit function, after it has turned a link into its company.
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.gc_trade_say_late(uuid, uuid, date, text, text)',
    'public.gc_trade_keep_day(uuid, uuid)',
    'public.gc_trade_set_crew_count(uuid, uuid, date, integer)',
    'public.gc_trade_mark_lookahead(uuid, uuid, date, boolean, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END;
$$;
```

### The SQL test

`supabase/tests/gc_schedule/40_trade_writes.sql`, a job of its own with every day read from today, run by
`scripts/pgtest-gc-schedule.sh` after `30_tells.sql`; the script applies the migration a second time too. On main at
d61ad6467 its 50 assertions passed:
- nothing before we build;
- **the late notice:**
  - a bar not there, another company's trade, our crew's line (its trade still carrying an old award) and an
    inspection refused;
  - no day, a day not after the one it changes, a past day, no reason, an unknown reason, no sentence and a long
    note refused;
  - a notice not started moves the bar whole, keeping its length, sent by the contact, today;
  - one under way keeps its start;
  - the dates it was sent against, kept;
  - the version stays;
- **the day kept:**
  - a notice not there refused, and one the office has not answered;
  - another company's refused;
  - the day kept, today, and kept twice refused;
  - one a newer notice replaced, one whose bar moved, and one a move took, each refused;
  - done work takes no notice;
- **the crew count:**
  - a trade not there, another company's and our crew's refused;
  - a week not a Monday, last week and three weeks out refused;
  - over 50 and under 0 refused;
  - the same count twice kept once, 0 allowed, the newest last;
- **the mark:**
  - a bar not there, another company's line and our crew's refused;
  - a week not a Monday, next week and two weeks back refused;
  - a week the work does not run refused;
  - done with a reason refused, not done with none refused;
  - one mark per bar and week, changed in place, the company's, today;
  - a checked mark refused, and it stays as it was;
- **the grants:** a signed-in user refused, and each verb the service role's alone.

Twenty-four bugs were planted one at a time, and twenty-three failed it:
- **the late notice:** any company, our crew's line (its trade still carrying an old award, so `ours` is what refuses),
  before we build, done work, a day not after the one it changes, a past day, any reason, no sentence, and work under
  way read as not started;
- **the day kept:** any company, before the push back, a notice a move took, one a newer notice replaced, and one
  whose bar moved;
- **the crew count:** last week, over 50 (the table's check refuses it too), the same count twice kept, and another
  company;
- **the mark:** a checked mark changed, next week (the bar runs that week, so the week is what refuses), a week the
  work does not run, and done with a reason (the table's check refuses it too);
- the verbs granted to signed-in users.

The one that did not: *the late notice on an inspection with the kind's check taken out.* The table holds it on its
own, since a bar that is not a line carries no trade (`gc_schedule_activities_line_or_label`). The check stays, to say
it in the verb.

### Also in 14a

- `src/lib/gc/gcTradeSubmit.test.ts`: the eight new keys go in `WAITING` as `'P5d'`.
- `docs/migrations/<stamp>_gc_schedule_trade_writes.md`, with the verify steps below.
- `docs/ACCESS_CONTROL.md`'s Schedule bullet.
- The release note and its fragment.

**Verify after the push (the lead):** the four functions are `INVOKER`, granted to `service_role` alone, and
`npm run check:migration-drift` is clean. **Rollback:** drop the four. Nothing calls them until P5d-ii.

## 14c: the office's side (no migration)

- **`GcLateNotices.tsx`** (new), the prototype's card on real presses: *Trades say they will be late*, each row from
  `lateNoticeRows` with **Take {day}** (`lateNoticeMove` into `GcMoveExplain`, saved with its `lateNoticeId`), **Push
  back** (a sentence of eight letters or more, `pushBackLateNotice`) and **Call {first}**.
- **`GcVerifyCard.tsx`** (new), the prototype's *To verify*: `verifyList`'s waiting marks (`verifyLookAhead`), our
  crew's items this week (`crewMarkLookAhead`), and the inspections.
- **`GcSchedule.tsx`**: both cards for `moves`, on a job being built, never in the copy.
- **Tests:** the cards' render tests (Take into the move's window with the notice, Push back's sentence, a mark
  verified and corrected, our crew's mark), and the window's: the cards for `moves` only, not in the copy.
- **Docs:** the guide *answer a trade that says it will be late*; `PROJECT_DOCUMENTATION.md`'s Schedule paragraph;
  `GLOSSARY.md`'s *late notice*, *crew count* and *look-ahead mark*.

## Seams

- **gc 3, P5d-ii:** the four kinds (`say_late`, `keep_day`, `crew_count`, `mark_lookahead`) in
  `submit-gc-trade-portal`, the eight keys' statuses and words, `say_late` among the hourly free-text kinds, and the
  blocks (the late notice on each bar, the look-ahead, the crew counts). The slice carries the rows the blocks read.
- **14b with gc 3:** the chart and the copy of the kernels (call 9).
- **PR 10 (#5231):** opens these tables' policies to the team. The office's side follows its gate.
- **The Board:** a first day nobody confirmed (G-114) is the Board's promise of kind `start` (SCHEDULE_REAL_BUILD
  l.276), not this PR's.

## Drift from `SCHEDULE_REAL_BUILD.md`

- PR 14's item names the start reminders (G-114): they are the Board's promise, and the portal's
  `startReminders` reads them.
- *First, prove that the portal's function can import the kernels*: it cannot as `src/lib` stands. The copy can
  (call 9).

## The check (14a, 14c and P5d-ii on, on "GC test project, delete me")

From the test company's link: say its bar will be late by two days with a reason. On the Schedule window the card
reads it, and **Take** makes it a move with the notice. Send another, **Push back** with a sentence, and keep the day
from the portal. Give a crew count for next week, and mark this week not done for weather. Verify the mark as done
on the window, and see the portal's mark locked.

## Is this the best we can do?

- Every rule was already lifted and tested. The verbs make the reducer's checks the server's, and add the ones the
  portal's screen only gated.
- Each verb is a record. None touches the plan or its version.
- What it does not do: the start reminders (the Board's), the counts' new readers beyond what reads them now, or the
  chart before 14b.

## Status

Plan 2026-10-10, gc 4, for gc 10's and gc 3's co-signs and the lead's read-back. 14a's SQL bed-tested on main at
d61ad6467. Nothing cut or claimed.
