---
name: "The schedule's PR 16: the readers (the daily log, our crew, change orders and the trades' percents on the schedule)"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 16, and 9d's three things for whoever picks the lane up; mockups/schedule-pr9d.md (Not done: Add the N lost days, the billing line); mockups/building-u8.md (calls 3a, 4 and 12); mockups/door-owner-billing.md (call C, the view; call D, Ask for the days); GANTT_FEATURES.md G-37, G-51, G-57, G-58, G-60, G-76, G-82, G-84, G-98, G-141
branch: the plan on claude/gc-schedule-pr16-plan (from origin/spike/gc-mode at 2cf5d92c5); the code from origin/main in four cuts, one with a migration
status: plan 2026-10-10 by gc 4 at the lead's ask, for gc 10 (holding Schedule while gc 1 is away) to co-sign. 16b-i's SQL ran on the real bed on main at 474486c9f: 16 assertions pass, and 6 of 6 planted bugs fail them. Amendment 1 (2026-10-10): gc 10 co-signed all seven calls at their picks, gc 5 co-signed 16b-i and 16c, and their notes are written in; the view's COMMENT says its words are shown as typed. Nothing cut or claimed.
---

# The schedule's PR 16: the readers

## What it is

The schedule's kernels for the daily log, our crew, change orders and the trades' percents are all on main, lifted
word for word, and none of them has its rows: the Schedule window reads the bare board (`state={board}`) and
`loadScheduleWithHolds` lays only submittals and RFIs over it. PR 16 gives each reader its rows, so what is already
drawn starts to say something. It ships behind the window's dev gate and `canMove`, as 9a to 9d did; no door opens.

What turns on, by row:

| Reader | On main | What it reads after PR 16 |
|---|---|---|
| G-60 the log against the chart (`logChartGaps`, `logChartNotes`) | bar notes, hover card, call list reasons; all empty | the job's logs |
| G-58 days lost (`weatherLostDays`, `lostDaysByLine`, `lostDaysUnanswered`) | stripes, the card's Lost row, the legend; all empty | the logs' weather delays and stops |
| The walk's **Add the N lost days** (9d) | dormant: `lostDaysUnanswered` finds no logs | the same, with no new write (`gc_schedule_move`) |
| G-57 the crew projection (`finishOutlook`) | "the log has no crews yet" | the logs' crews, our crew's from its clock-ins (U8) |
| G-84 people on site (`peopleOnSite`, `crewNumbers`, G-83 `crowdedWeeks`) | "No daily log this week", 3 assumed | the logs, our crew's clock-ins |
| G-51 our crew's percent | on since U8b (`withCrewPercents` on `board` itself) | unchanged |
| G-76 a change order's days (`changeOrderTails`, `contractDaysAdded`, the milestone card) | `tails` empty | the job's change orders, through `gc_change_orders_office` |
| G-98 the late-finish line (`lateFinish`) | `Measures` gets no `late` | the same change orders; its money line for the money team only |
| G-141 *Ask for the days* (`GcAskForDays`, `gc_draft_time_extension`) | never drawn | the press for the money team; words for anyone else |
| A hired trade's percent on its bar (`lineOf`: `pctReported`, `weSee`) | 0: the board's `sowOf` has no reports | `withDraws` for whoever passes the draws gate |
| 9d's billing line on Pull earlier and Days back (`planBillingShift`, `moveBillingShift`), the late fee's dollars and Days back's *saves $Y* | not drawn: the board carries no bills | the bills, for the money team only |

Four cuts:

- **16a, the log over the schedule** (no migration): the holds' io reads the job's logs and our crew's clock-ins and
  lays them with U8's `withDailyLogs` then `withCrewClockIns`. G-60, G-58, G-57, G-84 and the walk's lost days turn on.
- **16b-i, the view** (one migration): `gc_change_orders_office`, the door's call C as written, with its bed scenario
  and the test that it never carries `cost`, `price` or `pct_done`.
- **16b-ii, the change orders on the schedule** (no migration, after 16b-i's push and the regen): G-76, G-98 and G-141.
- **16c, the trades' percents and the money lines** (no migration): `withDraws` for the draws gate; the bills, the late
  fee and the billing line for the money team.

## The calls

**Co-signed by gc 10, as Schedule's holder, at their picks (amendment 1); each with the other way:**

1. **The rows are read in the holds' io, not passed down as a laid board.** `loadScheduleWithHolds(state, projectId,
   reads)` reads the logs, the clock-ins, the change orders and the draws it may, and lays them before `loadSchedule`.
   Passing `boardWithLogs` as the window's `state` would redo all 22 schedule reads at every log save, since
   `GcSchedule`'s effect keys on `state`. It is U8's call 3a's shape: one function, `withCrewClockIns` right after
   `withDailyLogs`, for the log window and the chart. *Other way:* a laid board from the page.
2. **What each reader may read is the page's to say**, in one `reads` object it memoizes (`ScheduleReads`): `logs` for
   `canUseGcBuilding` (Building's tables), `draws` for `canUseGcBuilding || canSeeGcMoney` (the page's draws gate, O9),
   `money` for `canSeeGcMoney`, and `today`. Change orders through the view need no flag: the view gates itself on the
   office team and returns none to anyone else. A reader without a flag gets today's empty rows, never an error.
3. **Everyone reads change orders through the view, the money team too.** One read path for the chart, tested once. The
   money team's lines (16c) read the full table into a money state of their own, kept apart from the chart's.
   *Other way:* the money team reads the table for both, which puts two shapes of the same change order on one page.
4. **A view row becomes a `ChangeOrder` with its money hidden.** The kernels' `ChangeOrder` needs `cost`, `price` and
   `pctDone`, and no schedule reader reads them (`changeOrderDays.ts`, `lateFinish.ts`, `timeExtension.ts`,
   `customerSchedule.ts`, `baseline.ts`, `schedule.ts` read `id`, `number`, `description`, `packageId`, `status`,
   `sentOn`, `answeredOn`, `days` and `daysOnChart`). `changeOrderFromOfficeRow` sets the three to 0 and the chart's
   state never reaches a money reader: 16c's money lines read their own state. A test holds it. *Other way:* narrow
   every schedule kernel's parameter to a `Pick`, a lift-pinned change across six files.
5. **No real days from a percent, again.** gc 10's call 4 in U8 stands for the trades too: `withReportedActuals` is not
   applied at read. A trade's report sets its bar's real days in the same write (`gc_trade_sow_report`, U6a, already
   on main, which the Portal's P5c calls). Our crew's 0 and 100 crossing in the Pipeline (`record_stage_progress`) is
   not written into the schedule in PR 16: the walk's *It started* and *It finished* record them. *Other way:* a trigger
   on `jobs_ledger_fixtures` with a SQL `stageRank`, a cross-lane write into the Pipeline's own table.
6. **Ask for the days is the money team's press** (door call D, "hands a draft to the money team"). `gc_draft_time_extension`
   is under the money policy, so `onAsk` is passed only with `canSeeGcMoney`. Anyone else sees the days and the line
   "The money team asks the customer for these days on Bill the customer." with no press.
7. **The foreign key is already in.** `gc_schedule_moves.change_order_id` got its key in O1
   (`20261008010000_gc_owner_billing_tables.sql`, `ON DELETE SET NULL`). PR 16 adds none, and `SCHEDULE_REAL_BUILD.md`
   is amended to say so.

**Left out, each with its home:** G-118 the morning list and G-96 days lost by cause are drawn in Building's log on the
spike, not the schedule; they go with Building's own screens. G-93, the Friday report's schedule section, shipped with
U7c. New project's sets that push the schedule wait for New project's PR 6. A part's report (`tradeReportPart`) waits
for the Portal's parts.

## 16a: the log over the schedule

- **`scheduleIo.ts`**: `loadScheduleWithHolds(state, projectId, reads: ScheduleReads = {})` reads, beside the submittals
  and RFIs, `loadGcDailyLogs([projectId])` and, when the job has started, `loadGcCrewOnSite(projectId,
  project.startedOn, reads.today)` (U8's 92-day pages), both only with `reads.logs`. It lays
  `withCrewClockIns(withDailyLogs(state, logs), clockIns)` first, then the holds, then `loadSchedule`. Every write's
  reload keeps reading `read.state`, which carries them.
- **`GcSchedule.tsx`**: takes `reads` and passes it on; its effect keys on it, so the page memoizes it. `reads`
  defaults to `{}`, so 9d's mocks, which call the two-argument form, still read as before.
- **When the logs arrive**: the chart reads the logs when the window opens and whenever it reads again (a move, a walk,
  Undo). A log saved in the Daily log window reaches an open Schedule window on its next read, not live.
- **`GcProjects.tsx`**: the Schedule's mount passes `reads={scheduleReads}`, memoized on the role and today.
- Nothing else changes: every reader above already reads `project.dailyLogs`.

## 16b-i: the view

One migration, `<stamp>_gc_change_orders_office.sql`, numbered from `origin/main` at the cut and claimed once. No table
is created. It is Owner Billing's table, so gc 5 co-signs the view as the door wrote it. A simple view over one table
takes writes with its owner's rights, and Supabase's default privileges give a new view every verb, so the view
revokes them all and grants `SELECT` alone; the bed proves no one signed in writes through it.

```sql
SET lock_timeout = '3s';

-- GC mode, the schedule's PR 16b (v2.NNNN): a change order's non-money half for the office, the view the Owner Billing
-- door planned (to-dos/gc-mode/mockups/door-owner-billing.md, call C), added by its first reader, the schedule
-- (to-dos/gc-mode/mockups/schedule-pr16.md, both on branch spike/gc-mode). gc_change_orders is the money team's alone.
-- The schedule reads a change order's number, words, trade, status, days and days on the chart, never its cost, its
-- price or its percent done. The view keeps its owner's rights, so it reads past the table's money policy, and holds
-- the office team at its own WHERE behind a security barrier. No table is created.
CREATE OR REPLACE VIEW public.gc_change_orders_office WITH (security_barrier = true) AS
  SELECT c.id, c.project_id, c.number, c.description, c.reason, c.schedule_words, c.package_id,
         c.status, c.sent_on, c.answered_on, c.days, c.days_on_chart
  FROM public.gc_change_orders c
  WHERE (SELECT public.gc_office_team());

-- Read only. Supabase's default privileges give a new view every verb, and a simple view over one table takes writes
-- with its owner's rights, so every grant goes first and SELECT alone comes back.
REVOKE ALL ON public.gc_change_orders_office FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.gc_change_orders_office TO authenticated;

COMMENT ON VIEW public.gc_change_orders_office IS
  'GC mode (v2.NNNN, the schedule''s PR 16b; Owner Billing''s door, call C): a change order''s non-money half, for the office team (gc_office_team()): its number, words, reason, trade, status, sent and answered days, days and days on the chart. Never cost, price or pct_done. Its description and schedule_words are the money team''s words, shown as they typed them. Owner''s rights with a security barrier; read only for authenticated, nothing for anon.';
```

### The SQL test

`supabase/tests/gc_owner_billing/95_office_view.sql`, with its block in `scripts/pgtest-gc-owner-billing.sh` (that bed
names each scenario) and the migration among the presses it applies a second time. On main at 474486c9f, its 16
assertions passed. Each of these 6 bugs, planted one at a time in the view, failed them: the price rides along, no
security barrier, no office gate, writes left to `authenticated`, anon reads it, the money team only.

```sql
-- A change order's non-money half for the office (v2.NNNN, the schedule's PR 16b; Owner Billing's door, call C): the
-- view gc_change_orders_office carries twelve columns and never cost, price or pct_done; it is a security barrier; the
-- office team reads every change order through it while the table itself stays the money team's; anyone outside the
-- office reads none; nobody signed in writes through it; anon reads nothing. The fixture is made as postgres; the reads
-- run through RLS; everything runs inside one transaction that rolls back. Raises on the first failed assertion; ends
-- with "gc_owner_billing_office_view PASSED". See scripts/pgtest-gc-owner-billing.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000bd1', 'dev@officeview.test'),
  ('00000000-0000-0000-0000-000000000bd2', 'estimator@officeview.test'),
  ('00000000-0000-0000-0000-000000000bd3', 'assistant@officeview.test'),
  ('00000000-0000-0000-0000-000000000bd4', 'super@officeview.test'),
  ('00000000-0000-0000-0000-000000000bd5', 'sub@officeview.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-000000000bd1', 'dev@officeview.test', 'View Dev', 'dev'),
  ('00000000-0000-0000-0000-000000000bd2', 'estimator@officeview.test', 'View Estimator', 'estimator'),
  ('00000000-0000-0000-0000-000000000bd3', 'assistant@officeview.test', 'View Assistant', 'assistant'),
  ('00000000-0000-0000-0000-000000000bd4', 'super@officeview.test', 'View Super', 'superintendent'),
  ('00000000-0000-0000-0000-000000000bd5', 'sub@officeview.test', 'View Sub', 'subcontractor')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- A GC job being built with two change orders on Concrete: a signed one with money, and a time extension of 4 days.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-000000000bc1', 'Office View Owner', '00000000-0000-0000-0000-000000000bd1');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-000000000ba1', 'Office view test', '00000000-0000-0000-0000-000000000bc1');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES ('00000000-0000-0000-0000-000000000ba1', 'building', public.app_today() - 40);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-000000000ba1', 'Concrete', 0, false);
INSERT INTO public.gc_change_orders (id, project_id, number, description, reason, package_id, cost, price, status, sent_on, answered_on, answered_how, pct_done, days) VALUES
  ('00000000-0000-0000-0000-00000000b301', '00000000-0000-0000-0000-000000000ba1', 1, 'Thicker slab at grid C', 'plans', '00000000-0000-0000-0000-000000000bb1', 500, 550, 'signed', public.app_today() - 6, public.app_today() - 4, 'office', 40, 2),
  ('00000000-0000-0000-0000-00000000b302', '00000000-0000-0000-0000-000000000ba1', 2, 'Four days for the rain', 'field', NULL, 0, 0, 'sent', public.app_today() - 1, NULL, NULL, 0, 4);

CREATE SCHEMA gvt;
CREATE FUNCTION gvt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION gvt.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION gvt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- What a reader sees of the job's change orders through the view, and in the table itself.
CREATE FUNCTION gvt.seen() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(number || ':' || status || ':' || days, ' ' ORDER BY number), 'none')
  FROM public.gc_change_orders_office WHERE project_id = '00000000-0000-0000-0000-000000000ba1' $$;
CREATE FUNCTION gvt.table_rows() RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text FROM public.gc_change_orders WHERE project_id = '00000000-0000-0000-0000-000000000ba1' $$;
GRANT USAGE ON SCHEMA gvt TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gvt TO authenticated, anon;

-- 1) The view's shape: twelve columns, none of the three money ones, behind a security barrier.
SELECT gvt.same('the view carries its twelve columns', (SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gc_change_orders_office'),
  'id,project_id,number,description,reason,schedule_words,package_id,status,sent_on,answered_on,days,days_on_chart');
SELECT gvt.same('never cost, price or pct_done', (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gc_change_orders_office' AND column_name IN ('cost', 'price', 'pct_done')), '0');
SELECT gvt.same('a security barrier', (SELECT coalesce(array_to_string(reloptions, ','), '') FROM pg_class WHERE oid = 'public.gc_change_orders_office'::regclass), 'security_barrier=true');
SELECT gvt.same('authenticated may only read it', (SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'gc_change_orders_office' AND grantee = 'authenticated'), 'SELECT');
SELECT gvt.same('anon may do nothing with it', (SELECT count(*)::text FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'gc_change_orders_office' AND grantee IN ('anon', 'PUBLIC')), '0');

-- 2) The reads.
SET LOCAL ROLE authenticated;
SELECT gvt.as_user('00000000-0000-0000-0000-000000000bd2');
SELECT gvt.same('an estimator reads both through the view', gvt.seen(), '1:signed:2 2:sent:4');
SELECT gvt.same('and none from the money team''s table', gvt.table_rows(), '0');
SELECT gvt.as_user('00000000-0000-0000-0000-000000000bd3');
SELECT gvt.same('an assistant reads both through the view', gvt.seen(), '1:signed:2 2:sent:4');
SELECT gvt.as_user('00000000-0000-0000-0000-000000000bd1');
SELECT gvt.same('a dev reads the view and the table', gvt.seen() || ' / ' || gvt.table_rows(), '1:signed:2 2:sent:4 / 2');
SELECT gvt.as_user('00000000-0000-0000-0000-000000000bd4');
SELECT gvt.same('a superintendent outside the office reads none', gvt.seen(), 'none');
SELECT gvt.as_user('00000000-0000-0000-0000-000000000bd5');
SELECT gvt.same('a subcontractor reads none', gvt.seen(), 'none');

-- 3) Nobody signed in writes through it, not even the office team.
SELECT gvt.as_user('00000000-0000-0000-0000-000000000bd2');
SELECT gvt.refused('an estimator''s update through the view', $s$UPDATE public.gc_change_orders_office SET days = 9 WHERE number = 1$s$, 'permission denied');
SELECT gvt.refused('an estimator''s delete through the view', $s$DELETE FROM public.gc_change_orders_office WHERE number = 2$s$, 'permission denied');
SELECT gvt.refused('an estimator''s insert through the view', $s$INSERT INTO public.gc_change_orders_office (project_id, number, description, reason, status, days) VALUES ('00000000-0000-0000-0000-000000000ba1', 3, 'x', 'field', 'draft', 1)$s$, 'permission denied');
RESET ROLE;
SELECT gvt.same('the change orders are as they were', (SELECT string_agg(number || ':' || days || ':' || price, ' ' ORDER BY number) FROM public.gc_change_orders WHERE project_id = '00000000-0000-0000-0000-000000000ba1'), '1:2:550 2:4:0');
SET LOCAL ROLE anon;
SELECT gvt.refused('anon reads nothing', $s$SELECT gvt.seen()$s$, 'permission denied');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'gc_owner_billing_office_view PASSED'; END $$;
ROLLBACK;
```

**The client's test that the view never carries the three** (16b-ii, once the regen has the view in
`src/types/database.ts`): `changeOrderOfficeRows.test.ts` holds, at the type level, that
`Database['public']['Views']['gc_change_orders_office']['Row']` has none of `cost`, `price` and `pct_done`
(`expectTypeOf<keyof Row>().toEqualTypeOf<…the twelve…>()`), and that the io selects from the view and never from
`gc_change_orders`.

**Verify after the push (the lead)**: the view's twelve columns, `security_barrier=true` in its options, `SELECT` the
only grant to `authenticated` and none to `anon`; as an estimator, the test project's change orders read through the
view and none from the table; `npm run check:migration-drift` clean. **Rollback**: `DROP VIEW
public.gc_change_orders_office;`. Nothing else reads it until 16b-ii.

## 16b-ii: the change orders on the schedule

- **`changeOrderOfficeRows.ts`** (new): `ChangeOrderOfficeRow` (the view's row), `changeOrderFromOfficeRow` (call 4:
  `cost`, `price` and `pctDone` 0, `answeredInPortal` false, `declinedNote` null), and `withOfficeChangeOrders(state,
  rows)`, which lays them as `withChangeOrders` does.
- **`changeOrderOfficeIo.ts`** (new): `loadGcChangeOrdersOffice(projectIds)` reads the view.
- **`scheduleIo.ts`**: the holds' io reads them always (call 2) and lays them before `loadSchedule`.
- **`GcSchedule.tsx`**: `tails` fills by itself. `Measures` gets `late={lateFinish(state, project)}` when the job is
  late (G-98). Its money line stays empty, since the chart's state has no late fee (16c gives the money team theirs).
  `onAsk` for `canSeeGcMoney` (call 6) calls `gc_draft_time_extension` through `timeExtensionAsk` and says what it did
  in `GcAskForDays`'s own words; without it, the line *The money team asks the customer for these days on Bill the
  customer.*
- **Tests**: the type-level test above; `changeOrderOfficeRows.test.ts` (the mapper, money hidden, `withOfficeChangeOrders`);
  `GcSchedule.render.test.tsx` (a signed change order's tail on its bar, the late-finish line, the Ask press for the
  money team calling the draft, the words without it); `scheduleIo.test.ts` (the view read, never the table).

## 16c: the trades' percents and the money lines

- **The trades' percents** (`reads.draws`): the holds' io reads `loadGcDraws` for the job's packages and lays
  `withTradeChanges(withDraws(state, tables), tables)`, so a hired trade's reported percent and our sent-back `weSee`
  reach its bars (`lineOf`). Building's door moves the four draw tables to the money team, so after it the office reads
  0 on a hired trade's bar; a money-free read of the line percents is the door's to add (see Seams).
- **The money lines** (`reads.money`): the holds' io also reads `loadGcBillingRows([projectId])` and the full
  `loadGcChangeOrders([projectId])`, and builds a money state apart from the chart's (call 3):
  `billingStateFor(withChangeOrders(withDraws(...), full), projectId, bills)`, with the schedule laid over it. It
  returns it beside the chart's as `ScheduleRead.money`. From it:
  - the late fee's dollars on the late-finish line and Days back's *At $X a day, that saves $Y* (`lateFinish`,
    `recovery.ts`), through `Measures`' `late` and `best` and `GcRecovery`;
  - 9d's billing line on Pull earlier and Days back, `Billing: {shiftWords(planBillingShift(...), 'will')}`, and the
    *did* line on each standing move (`moveBillingShift`), as the prototype draws them (`GcPullEarlier.proto.tsx:163`,
    `GcRecovery.proto.tsx:180`, `GcScheduleMoves.proto.tsx:371-374`).
  None of them draws without `money`.
- **Tests**: `scheduleIo.test.ts` (the draws laid for the gate, the money state for the money team and absent
  otherwise); render tests for a hired trade's percent on its bar, the billing line on Pull earlier with `money` and
  absent without, the late fee's dollars for the money team only.

## Drift from `SCHEDULE_REAL_BUILD.md`

- PR 16's change-order bullet says `gc_schedule_moves.change_order_id` gets its foreign key here. O1 added it (call 7).
- PR 16's draws bullet says a trade's report sets the real days in the same write (`withReportedActuals`). The SQL does,
  in `gc_trade_sow_report` (U6a); nothing is derived at read (call 5).
- PR 16's daily-log bullet lists G-118. The morning list is Building's screen, not the schedule's.
- The Friday report's schedule section (G-93) shipped with U7c, which lays the schedule over the report's own state.

## The check (16c on, on "GC test project, delete me", as a dev)

A day's log with a rain delay on the test project's plumbing: its bar takes a stripe and a Lost row, and the walk offers
*Add the 1 lost day*. A signed change order of 3 days on it: its tail shows on the bar and the finish moves on the
milestone card. A trade's report through its portal moves its bar's percent. As the money team: the late fee in dollars
and Pull earlier's billing line. Then read the same window as a dev without the money flags (a test, not prod) and see
no dollars.

## When it is cut

16a first (no migration), then 16b-i (the migration: the lead pushes, gc 7 regenerates), 16b-ii after the regen, then
16c. Each its own claim, release note and fragment. None deploys a function.

## Docs each PR touches

- **16a**: `PROJECT_DOCUMENTATION.md` (the Schedule reads the daily log); the guide *walk the schedule each week* gains
  the lost days' line.
- **16b-i**: `docs/migrations/<stamp>_gc_change_orders_office.md`, with the revoke-then-grant finding in its words (the
  lead's ask) and that the view shows `description` and `schedule_words` as the money team typed them (gc 5);
  `docs/ACCESS_CONTROL.md`, the Owner Billing door's sentence about the view amended where it stands (gc 5's): it exists
  since 16b-i, with its version and stamp, read only for `authenticated` (in the Owner Billing bullet once #5302 is on
  main); `scripts/pgtest-gc-owner-billing.sh` runs `95_office_view.sql` after `94_gc_job.sql`, re-applies the view
  beside `$GCJOB`, and its header's count of files moves with it.
- **16b-ii**: `PROJECT_DOCUMENTATION.md` (change orders on the schedule, Ask for the days); `GLOSSARY.md` if *time
  extension* has no entry.
- **16c**: `PROJECT_DOCUMENTATION.md` (the trades' percents, the money lines). `SCHEDULE_REAL_BUILD.md`'s PR 16 marked
  done item by item.

## Seams

- **gc 10 (Schedule)**: the four cuts touch `scheduleIo.ts`, `GcSchedule.tsx` and `GcScheduleMeasures.tsx`. PR 10's
  draft (#5231) meets them in `GcScheduleWindow.tsx`'s props; whichever lands second rebases.
- **gc 5 (Owner Billing)**: co-signs the view (16b-i) and the money lines' reads (16c). The view is theirs to keep.
- **Building's door (gc 10's plan, gc 4 co-signing)**: after the door, the office reads the logs (its team policies),
  the change orders (the view), but not the draws (money). A money-free `gc_team_line_percents(project)`, each line's
  newest reported percent and nothing else, would bring the trades' percents to every member's chart. gc 10 takes it
  into the door's D1 as call 12 (amendment 1): each line's kernel id, its newest reported percent and our open
  send-back's `we_see`, team-gated in call 9's family; D1 then moves `reads.draws` to `canSeeGcMoney`. D1 also replaces
  the view's `WHERE` with `gc_on_schedule_team(c.project_id)`, so a superintendent on the job keeps the tails and the
  late-finish line.
- **Our crew**: U8b's `board` carries the percents; 16a adds the clock-ins. Nothing else from U8.

## Is this the best we can do?

- Every reader was already lifted and tested; PR 16 adds rows, not rules. The prototype's numbers on the same made-up
  rows are the check, as `SCHEDULE_REAL_BUILD.md` asks.
- One read path per kind of row, in one io, so the log window, the chart and Bill the customer cannot disagree.
- No money reaches a chart that is not the money team's: the view carries none, and the money state is separate.
- What it does not do: derive a real day from a percent (call 5), show the trades' percents to the office after the
  door without a money-free read (Seams), or draw the morning list.

## Status

Plan 2026-10-10, gc 4. The lead approved its shape; gc 10 co-signed all seven calls and gc 5 co-signed 16b-i and 16c
(amendment 1, their notes written in). 16a cuts first, then 16b-i on gc 5's co-sign, stamped past every open claim. 16b-i's SQL bed-tested on main at 474486c9f (16
assertions, 6 of 6 planted bugs). Nothing cut or claimed.
