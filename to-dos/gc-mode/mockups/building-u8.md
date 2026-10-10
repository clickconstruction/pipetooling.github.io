---
name: "Building U8: our own crew from its Pipeline job"
rows: BUILDING_REAL_BUILD.md, The PRs in order, 8; decision 11; "U8: one column"; README.md, Where it plugs in (our own crew's percent done); SCHEDULE_REAL_BUILD.md, PR 16 (our crew, G-51) and the daily log's readers; GANTT_FEATURES.md G-51
branch: the plan on claude/gc-building-u8-plan (from origin/spike/gc-mode at afd58dbba), merged to the spike by the lead; U8a from origin/main after U7c and U3b-ii are cut; U8b after U8a's push and gc 7's types regen
status: plan 2026-10-10 by gc 4 (the Building lane) at the lead's ask. The count's shape agreed with gc 10 (holding Schedule) before it was written, with gc 10's four changes written in (calls 1 to 5). U8a's SQL ran on the real bed on main at 06ab01043: 23 assertions pass, and 19 of 19 planted bugs fail them. Amendment 1 (2026-10-10): the lead approved calls 6 to 9 and 11 to 13 and changed 10 to a guard on the column, now in U8a (28 assertions, 25 of 25 planted bugs); gc 10 signed off with call 12 made exact (the `board` variable itself) and a page test. Amendment 2 (2026-10-10), gc 5's asks, co-signed by gc 5: the percent read takes O9's gate (`canUseGcBuilding || canSeeGcMoney`), the link and its guard staying a dev's; Bill the customer's line for our crew says where its percent came from; a missing number never reads as a measured zero. Amendment 3 (2026-10-10), gc 5's O11a and the lead's call: one Pipeline job per crew trade; U8b's picker says so, and Building's door refuses it in SQL. U8a (#5285) stays as it is. U8b built, waiting on U8a's push and the regen.
---

# Building U8: our own crew from its Pipeline job

## What it is

A trade our own crew does (`gc_trade_packages.ours`) names the Pipeline job it runs on. From that job:

- **Its head count on the daily log** is the number of our people who clocked in on the job that day. It is read and
  never stored, and it shows on the log as our crew's row, read only. The schedule's people on site and crew projection
  read it with no change, since it lands where they already look (`DailyLog.crews`).
- **Its percent done** is the job's own stage progress, matched to our stages by their names, or the whole job's
  percent when the stages do not match. It lands in `selfPerform.pctByLine` and `pctDone`, which Draws, Closeout,
  Bill the owner and the Schedule's bars already read.

Two PRs, the lane's usual split:

- **U8a, the column, its guard and two functions** (one migration, no screen): `gc_trade_packages.job_ledger_id`,
  its guard trigger (call 10), `gc_link_crew_job` (SECURITY INVOKER) and `gc_crew_on_site` (SECURITY DEFINER, counts
  only). The SQL bed gains `90_crew.sql`.
- **U8b, the mapper, the io and the screens** (no migration): `withCrewClockIns` in `dailyLogRows.ts`,
  `withCrewPercents` in a new `crewJobRows.ts`, their io, the **Our own crew** card on Draws with the Pipeline-job
  picker, our crew's read-only row on the daily log, a guide and the docs.

Nothing in U8 writes a bar's real days (call 4) or touches payroll. The count never names anyone.

## The calls

**Agreed with gc 10, holding Schedule (2026-10-10), before the RPC was written:**

1. **The count as written.** Counts only: one row per trade our own crew does, per day, of distinct people. A punch
   (`origin = 'user_punch'`) counts while it waits for approval. A revoked or rejected session does not count. Neither
   does a salary day the app fills in itself (`'salary_schedule'`, no evidence anyone was there), a quick add (office
   minutes for an off-hours call, `quick_add_minutes`), a sample account or a digital twin. `work_date` is the
   company's day, as `DailyLog.date` is.
2. **The gate, and the 92-day cap that never stops the schedule's read.** A dev only while Building is built, never a
   twin. Building's door swaps it to the schedule's team (`gc_on_schedule_team`, PR 10) with the twin still refused;
   if PR 10 is not on main when the door cuts, the door uses its own gate and the swap waits on PR 10. The cap stays at
   92 days a call. The io reads in 92-day pages, so `finishOutlook`'s crew average still sees the whole job (call 13).
3. **The overlay goes in `DailyLog.crews`, through one shared function.**
   a. `withCrewClockIns(state, rows)` is pure, sits in `dailyLogRows.ts`, and is composed right after `withDailyLogs`
      wherever the logs are laid over the board, with its own tests. The page's log window uses it in U8b. PR 16's
      holds' io (as 9d's `loadScheduleWithHolds` does) calls the same function, so the log window and the chart never
      disagree.
   b. Clock-ins win only where there are any. A day with a log and clock-ins: our crew's workers are the count, read
      only. A day with a log and no clock-ins: the typed count stands and stays editable, since the crew may not punch
      yet. A day with clock-ins and no log stays unlogged, and the missing-log flag still asks for it.
4. **No real days from the percent, in U8 or at read time.** `withReportedActuals` at read would stamp today as a
   bar's real start whenever the percent is above 0 and no start is recorded, and the day would move every day it is
   read. Clock-ins are per job, not per stage, so they cannot place a stage's start either. Our crew's real days stay
   records: 9d's walk (*It started*, *It finished*) and 8b's form. A write when a stage crosses 0 or 100, at the place
   the Pipeline writes the stage's percent and with the day it happened, is PR 16's to plan.
5. **The percent from `list_job_stage_progress` by `stageRank`,** with the whole job's percent when the job has no
   stages.

**gc 4's picks, approved by the lead (2026-10-10) with 10 changed:**

6. **The log never stores our crew's count on a day with clock-ins.** Decision 11 says "read and never stored". The
   save leaves our crew's row off the payload on any day that has a count (`crewsToSave`), so a count that changes
   later (a punch approved, rejected or moved) changes the log with it. A day with no clock-ins saves the typed count
   as today. *Other way:* store the count as shown, which keeps a copy that is stale the moment a session changes.
7. **By stage only when every stage matches.** Each of our crew's scope lines (`Underground`, `Rough in`, `Top out`,
   `Trim`) takes the `stageRank` of its name. When every line finds a Pipeline stage of the same rank, each line reads
   its stage, and two Pipeline stages of one rank (`Rough In · Building A`, `Rough In · Building B`) average by their
   weight. When any line finds none, the whole trade reads the job's one percent. Mixing a line from its stage with a
   line from the whole job would add two different measures. *Other way:* match what matches and give the rest the
   job's percent.
8. **The whole job's percent is the crew report's while it is the newest word, else the job's own.**
   `currentReportPctByJobId` (the report's percent unless the office set one by hand after it), then
   `jobs_ledger.pct_complete`, through `resolveJobSummaryPercentCompleteWithSource`. The paid-invoices rule is left
   out, since it reads the job's bills and Building's door is not money.
9. **The picker lives on Draws, on the Our own crew card** the prototype had there (`GcBuildingCrew.tsx`), moved now
   with its stages read only and the day each was reported. Draws is a dev's today and the money team's at the door, so
   linking is the office's job. It suggests first a Pipeline job on this project (`jobs_ledger.project_id`) or from our
   own bid (`jobs_ledger.bid_id = own_bid_id`), then searches with `search_jobs_ledger`, which leaves billing-only jobs
   out. The daily log only says where the count comes from.
10. **A guard on the column, in the award guard's shape** (the lead's change: a wrong link changes what the owner's
    bill reads for our crew). The board's own policy (door 1, `gc_office_team()`) lets the office team write
    `gc_trade_packages` with a plain UPDATE, so `gc_trade_packages_crew_job_guard` refuses any signed-in change to
    `job_ledger_id`, in words, unless `gc_link_crew_job` turned the transaction's `gc.crew_job_write` flag on for its
    UPDATE. The job's `ON DELETE SET NULL` passes (a cascade, `pg_trigger_depth() > 1`), and so does server code with
    no person (`auth.uid() IS NULL`). No role is named, so a dev's plain write is refused too, and the door inherits
    it, changing only the link's gate. Every other column writes as today.
11. **One Pipeline job per crew trade** (amendment 3: gc 5's O11a counts each linked job's spend as our crew's cost
    in Money's margin, so a job linked twice would count twice; the lead's call). The picker says so now: a job another
    crew trade holds, on this GC job or another the page read, shows below the free ones with **On Electrical
    already** (or **On Plumbing at Stone Oak already**), and its **Use this job** is off. Building's door migration,
    which re-makes `gc_link_crew_job` for the team, refuses it in SQL: *That Pipeline job is already Electrical's.* U8a's
    SQL in #5285 stays as it is, and gc 5's kernel counts a job once until the door.
12. **The percents are laid over the board itself on the page,** before any window reads it, so Draws, Closeout, Bill
    the owner, the money margin and the Schedule all read one percent. It is read with O9's gate,
    `canUseGcBuilding(role) || canSeeGcMoney(role)` (gc 5, amendment 2), so a master's or the controller's draft bill
    reads the same percent as a dev's. Every source admits the money team: `can_report_stage_progress` names
    master_technician and controller, `list_latest_report_completion_pct` reads under RLS, and `jobs_ledger` is the
    office's to read. The link press and its guard stay a dev's. gc 10's condition: it is the `board` variable itself that is laid, the one the Schedule mount reads
    (`GcScheduleWindow state={board}`), never a second memo beside it, so the chart and 9d's pull offers read our
    crew's `pctByLine` from the same read as Draws and the bill. A page test opens Schedule after a crew read.
13. **The count's days run from the job's first day to today.** `gc_projects.started_on` is the first day a log may
    have (the press refuses one before it), so pages from it to today cover every log and every new log's form. Read
    with the logs, for the building jobs that have a linked crew.

## U8a: the column and the two functions

One migration, `<stamp>_gc_crew_job.sql`, numbered from `origin/main`'s latest file at the cut and claimed once. No
table is created, so the three `apply_*` calls are not needed. The foreign key takes a brief lock on `jobs_ledger`,
so it is pushed in a quiet moment, as `20260921042405_clock_sessions_quick_add.sql` was.

```sql
SET lock_timeout = '3s';

-- GC mode, the Building lane's U8 (v2.NNNN): our own crew from its Pipeline job
-- (to-dos/gc-mode/mockups/building-u8.md on branch spike/gc-mode). A trade our own crew does names the
-- Pipeline job it runs on. Then the daily log reads how many of our people clocked in on that job each
-- day, and the stages read that job's percent. One column, its guard and two functions. No table is created.
--
-- PUSH IN A QUIET MOMENT: the foreign key takes a brief SHARE ROW EXCLUSIVE lock on jobs_ledger, which
-- holds the office's job writes for the instant it is added. The new column is null on every row, so
-- there is nothing to scan. The lock timeout above makes it fail fast rather than queue the office.

-- 1) The column: the Pipeline job our own crew's trade runs on. It lets go when the job is deleted.
ALTER TABLE public.gc_trade_packages
  ADD COLUMN IF NOT EXISTS job_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS gc_trade_packages_job_ledger_idx ON public.gc_trade_packages (job_ledger_id)
  WHERE job_ledger_id IS NOT NULL;
COMMENT ON COLUMN public.gc_trade_packages.job_ledger_id IS
  'GC mode (v2.NNNN, Building U8): the Pipeline job a trade our own crew does (ours) runs on. Its clock-ins are our crew''s head count on the daily log (gc_crew_on_site), and its stage progress is our crew''s percent, which Bill the owner bills from. A signed-in person changes it only through gc_link_crew_job (gc_trade_packages_crew_job_guard). Null: not linked yet. Every reader also asks for ours.';

-- 2) The guard. A wrong link changes what the owner's bill reads for our crew, so a signed-in person changes the
-- column only inside gc_link_crew_job, which turns this transaction's gc.crew_job_write flag on for its UPDATE and
-- off after it (the award guard's shape, 20261010025000). Two writes pass without it: the key letting go inside its
-- own trigger (the job's ON DELETE SET NULL), and server code with no person (auth.uid() IS NULL: the service
-- role, a migration, a bed's fixtures). No role is named, so a dev's plain UPDATE is refused too, and Building's
-- door changes only gc_link_crew_job's gate.
CREATE OR REPLACE FUNCTION public.gc_trade_packages_crew_job_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_changed := NEW.job_ledger_id IS NOT NULL;
  ELSE
    v_changed := NEW.job_ledger_id IS DISTINCT FROM OLD.job_ledger_id;
  END IF;
  IF v_changed AND current_setting('gc.crew_job_write', true) IS DISTINCT FROM 'on'
     AND pg_trigger_depth() < 2 AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Our crew''s Pipeline job changes only through Pick its Pipeline job on Draws.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.gc_trade_packages_crew_job_guard() IS
  'GC mode (v2.NNNN, Building U8): the trigger that lets a signed-in person change gc_trade_packages.job_ledger_id only inside gc_link_crew_job, which sets gc.crew_job_write for its UPDATE. A cascade passes (pg_trigger_depth() > 1), and so does server code with no person (auth.uid() IS NULL). No role is named.';

-- Every row of every INSERT and UPDATE, not UPDATE OF, so no other trigger's change slips past it.
CREATE OR REPLACE TRIGGER gc_trade_packages_crew_job_guard BEFORE INSERT OR UPDATE ON public.gc_trade_packages
  FOR EACH ROW EXECUTE FUNCTION public.gc_trade_packages_crew_job_guard();

-- 3) Link our crew's trade to its Pipeline job, or let go of it (p_job_ledger_id null). SECURITY
-- INVOKER, so the trade's own policy decides who may write it as well.
CREATE OR REPLACE FUNCTION public.gc_link_crew_job(p_package_id uuid, p_job_ledger_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ours boolean;
  v_billing_only boolean;
BEGIN
  -- The table's read-only blocks and the twin fence refuse the write too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot link a Pipeline job.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot link a Pipeline job.' USING ERRCODE = '42501';
  END IF;
  -- Building is a dev's while it is built. Its door changes this gate.
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev links our crew''s Pipeline job while Building is built.' USING ERRCODE = '42501';
  END IF;

  SELECT k.ours INTO v_ours FROM public.gc_trade_packages k WHERE k.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No trade with that id.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_ours THEN
    RAISE EXCEPTION 'Only a trade our own crew does has a Pipeline job.' USING ERRCODE = '22023';
  END IF;

  IF p_job_ledger_id IS NOT NULL THEN
    SELECT j.billing_only INTO v_billing_only FROM public.jobs_ledger j WHERE j.id = p_job_ledger_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No Pipeline job with that id.' USING ERRCODE = 'P0002';
    END IF;
    -- Nobody clocks in on a billing-only job (20261009130000), so it would never count anyone.
    IF v_billing_only THEN
      RAISE EXCEPTION 'That job is for billing only. Nobody clocks in on it. Pick the job our crew works on.' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM set_config('gc.crew_job_write', 'on', true);
  UPDATE public.gc_trade_packages SET job_ledger_id = p_job_ledger_id WHERE id = p_package_id;
  PERFORM set_config('gc.crew_job_write', '', true);
END;
$$;

REVOKE ALL ON FUNCTION public.gc_link_crew_job(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_link_crew_job(uuid, uuid) TO authenticated;
COMMENT ON FUNCTION public.gc_link_crew_job(uuid, uuid) IS
  'GC mode (v2.NNNN, Building U8): names the Pipeline job a trade our own crew does runs on, or lets go of it (null). Refuses a training account, a digital twin, anyone but a dev while Building is built, a trade we hire, a job that does not exist and a billing-only job. Writes under gc.crew_job_write, the flag gc_trade_packages_crew_job_guard reads. SECURITY INVOKER: the trade''s own policy applies too.';

-- 4) How many of our people clocked in on our crew's Pipeline job, a trade and a day at a time. Counts
-- only, never a name, an hour or pay, so its door can open wider than clock_sessions' own policy.
-- A person counts once a day however many times they punched. A punch counts while it waits for
-- approval. A revoked or rejected session does not count, nor a salary day the app fills in itself
-- (origin 'salary_schedule'), nor a quick add (office minutes for an off-hours call, not time on
-- site), nor a sample account or a digital twin. work_date is the company's day, as the log's is.
CREATE OR REPLACE FUNCTION public.gc_crew_on_site(p_project_id uuid, p_from date, p_to date)
RETURNS TABLE (package_id uuid, work_date date, people integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Building is a dev's while it is built. Its door changes this gate and keeps the twin out.
  IF NOT public.is_dev() OR public.is_digital_twin() THEN
    RAISE EXCEPTION 'Only a dev reads our crew''s clock-ins on a GC job while Building is built.' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'Say the first and the last day to count.' USING ERRCODE = '22023';
  END IF;
  -- A long job reads in pages (the io's 92-day pages), so no one call scans a year of punches.
  IF p_to - p_from > 91 THEN
    RAISE EXCEPTION 'Count at most 92 days at a time.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT k.id, s.work_date, count(DISTINCT s.user_id)::integer
  FROM public.gc_trade_packages k
  JOIN public.clock_sessions s ON s.job_ledger_id = k.job_ledger_id
  JOIN public.users u ON u.id = s.user_id
  WHERE k.project_id = p_project_id
    AND k.ours
    AND s.work_date BETWEEN p_from AND p_to
    AND s.revoked_at IS NULL
    AND s.rejected_at IS NULL
    AND s.origin = 'user_punch'
    AND s.quick_add_minutes IS NULL
    AND NOT COALESCE(u.is_sample, false)
    AND NOT COALESCE(u.is_digital_twin, false)
  GROUP BY k.id, s.work_date
  ORDER BY s.work_date, k.id;
END;
$$;

REVOKE ALL ON FUNCTION public.gc_crew_on_site(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_crew_on_site(uuid, date, date) TO authenticated;
COMMENT ON FUNCTION public.gc_crew_on_site(uuid, date, date) IS
  'GC mode (v2.NNNN, Building U8): for each trade our own crew does on a GC project, how many people clocked in on its Pipeline job each day from p_from to p_to (at most 92 days). Counts only: no names, hours or pay. Counts a punch waiting for approval; leaves out revoked and rejected sessions, salary days, quick adds, sample accounts and digital twins. A dev only while Building is built, never a twin. SECURITY DEFINER: it reads clock_sessions past its own policy, which is why it returns counts and nothing else.';
```

### The SQL tests

`supabase/tests/gc_building/90_crew.sql`, and `scripts/pgtest-gc-building.sh`'s PRESSES gains
`supabase/migrations/*_gc_crew_job.sql`, as every Building migration's line does. On main at 06ab01043 the bed ran
every scenario with this file, and its 28 assertions passed. Then each of these 25 bugs, planted one at a time in the
migration, failed them: a hired trade counts, another project counts, a person counts twice a day, a revoked, rejected,
salary or quick-add session counts, a sample or twin person counts, a twin dev or an estimator reads the counts, 93 days
in one call, the days the wrong way round, anon runs the count, a training account or an estimator links, a hired trade
or a billing-only job is linked, the guard is off, a new trade may name a job, the link never turns its flag on or
leaves it on, the job's delete or server code is refused, and a missing job says the wrong words. The deleted job
letting go is the column's `ON DELETE SET NULL`, checked once (with someone signed in, so the guard's cascade rule is
on the path) and not mutated.

```sql
-- Our own crew from its Pipeline job (v2.NNNN, the Building lane's U8): gc_link_crew_job names the job a
-- trade our own crew does runs on, and refuses in words a training account, a digital twin, anyone but a
-- dev, a trade we hire, a job that does not exist and a billing-only job, and its guard refuses any other
-- signed-in write to the column while letting the job's delete and server code through. gc_crew_on_site counts the
-- people who clocked in on that job, a trade and a day at a time: a person once a day, a punch waiting
-- for approval in, and a revoked or rejected session, a salary day, a quick add, a sample account, a
-- twin, another job and a hired trade out. Counts only, a dev's, never a twin's, 92 days at most. Presses
-- run through RLS, the fixture made as postgres; everything runs inside one transaction that rolls
-- back. Raises on the first failed assertion; ends with "gc_building PASSED". See
-- scripts/pgtest-gc-building.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: a dev, a dev in training mode, a dev who is a digital twin, an estimator, and five people who
-- clock in: three on the crew, a sample account and a twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@crew.test'),
  ('00000000-0000-0000-0000-0000000009d2', 'trainee@crew.test'),
  ('00000000-0000-0000-0000-0000000009d3', 'twin@crew.test'),
  ('00000000-0000-0000-0000-0000000009d4', 'estimator@crew.test'),
  ('00000000-0000-0000-0000-0000000009e1', 'ana@crew.test'),
  ('00000000-0000-0000-0000-0000000009e2', 'ben@crew.test'),
  ('00000000-0000-0000-0000-0000000009e3', 'cal@crew.test'),
  ('00000000-0000-0000-0000-0000000009e4', 'sample@crew.test'),
  ('00000000-0000-0000-0000-0000000009e5', 'crewtwin@crew.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@crew.test', 'Crew Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000009d2', 'trainee@crew.test', 'Crew Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000009d3', 'twin@crew.test', 'Crew Twin', 'dev'),
  ('00000000-0000-0000-0000-0000000009d4', 'estimator@crew.test', 'Crew Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000009e1', 'ana@crew.test', 'Ana Crew', 'assistant'),
  ('00000000-0000-0000-0000-0000000009e2', 'ben@crew.test', 'Ben Crew', 'assistant'),
  ('00000000-0000-0000-0000-0000000009e3', 'cal@crew.test', 'Cal Crew', 'assistant'),
  ('00000000-0000-0000-0000-0000000009e4', 'sample@crew.test', 'Sample Crew', 'assistant'),
  ('00000000-0000-0000-0000-0000000009e5', 'crewtwin@crew.test', 'Twin Crew', 'assistant')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000009d2';
UPDATE public.users SET is_digital_twin = true WHERE id IN ('00000000-0000-0000-0000-0000000009d3', '00000000-0000-0000-0000-0000000009e5');
UPDATE public.users SET is_sample = true WHERE id = '00000000-0000-0000-0000-0000000009e4';

-- Two GC jobs: A with Concrete (hired) and our own Plumbing; B with our own Plumbing too.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000009c1', 'Crew Test Owner', '00000000-0000-0000-0000-0000000009d1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000009a1', 'Crew test A', '00000000-0000-0000-0000-0000000009c1'),
  ('00000000-0000-0000-0000-0000000009a2', 'Crew test B', '00000000-0000-0000-0000-0000000009c1');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES
  ('00000000-0000-0000-0000-0000000009a1', 'building', current_date - 30),
  ('00000000-0000-0000-0000-0000000009a2', 'building', current_date - 30);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009a1', 'Concrete', 0, false),
  ('00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-0000000009a1', 'Plumbing', 1, true),
  ('00000000-0000-0000-0000-0000000009b3', '00000000-0000-0000-0000-0000000009a2', 'Plumbing', 0, true);

-- Pipeline jobs: our crew's, a billing-only one, another job, and one to delete.
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000009f1', 'Crew Bed Plumbing');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name) VALUES
  ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009f1', 'Crew test plumbing'),
  ('00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009f1', 'Crew test billing'),
  ('00000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009f1', 'Crew test other job'),
  ('00000000-0000-0000-0000-000000000904', '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009f1', 'Crew test gone');
UPDATE public.jobs_ledger SET billing_only = true WHERE id = '00000000-0000-0000-0000-000000000902';

CREATE SCHEMA gbt;
CREATE FUNCTION gbt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION gbt.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- Sign in as someone (the claims auth.uid() reads).
CREATE FUNCTION gbt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
GRANT USAGE ON SCHEMA gbt TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbt TO authenticated, anon;
-- A trade by its id's last two digits, and each trade's job as the table holds it.
CREATE FUNCTION gbt.k(n text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000000009' || n)::uuid $$;
CREATE FUNCTION gbt.jobs() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(k.trade || ':' || coalesce(right(k.job_ledger_id::text, 3), '-'), ' ' ORDER BY k.project_id, k.position)
  FROM public.gc_trade_packages k WHERE k.project_id IN ('00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009a2') $$;
-- What gc_crew_on_site says for job A from `f` to `t` days from today: each row's day, trade and count.
CREATE FUNCTION gbt.counts(f integer, t integer, p_project uuid DEFAULT '00000000-0000-0000-0000-0000000009a1') RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg((c.work_date - current_date) || ' ' || k.trade || ':' || c.people, ', ' ORDER BY c.work_date, k.position), 'none')
  FROM public.gc_crew_on_site(p_project, current_date + f, current_date + t) c
  JOIN public.gc_trade_packages k ON k.id = c.package_id $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbt TO authenticated, anon;

-- A punch on job `job` by person `who` on the day `d` days from today, its other columns in `extra`.
CREATE FUNCTION gbt.punch(who text, job text, d integer, note text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date, notes, job_ledger_id)
  VALUES (('00000000-0000-0000-0000-0000000009' || who)::uuid, (current_date + d) + time '08:00', (current_date + d) + time '12:00', current_date + d, note,
    ('00000000-0000-0000-0000-000000000' || job)::uuid) $$;

-- 1) The link: refused in words before the trade is touched.
SET LOCAL ROLE authenticated;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d2');
SELECT gbt.refused('a training account', $s$SELECT public.gc_link_crew_job(gbt.k('b2'), '00000000-0000-0000-0000-000000000901')$s$, 'A training account cannot link a Pipeline job.');
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d3');
SELECT gbt.refused('a digital twin', $s$SELECT public.gc_link_crew_job(gbt.k('b2'), '00000000-0000-0000-0000-000000000901')$s$, 'A digital twin cannot link a Pipeline job.');
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d4');
SELECT gbt.refused('an estimator, while Building is built', $s$SELECT public.gc_link_crew_job(gbt.k('b2'), '00000000-0000-0000-0000-000000000901')$s$, 'Only a dev links our crew''s Pipeline job while Building is built.');
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SELECT gbt.refused('a trade that is not there', $s$SELECT public.gc_link_crew_job('00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-000000000901')$s$, 'No trade with that id.');
SELECT gbt.refused('a trade we hire', $s$SELECT public.gc_link_crew_job(gbt.k('b1'), '00000000-0000-0000-0000-000000000901')$s$, 'Only a trade our own crew does has a Pipeline job.');
SELECT gbt.refused('a job that is not there', $s$SELECT public.gc_link_crew_job(gbt.k('b2'), '00000000-0000-0000-0000-0000000009ff')$s$, 'No Pipeline job with that id.');
SELECT gbt.refused('a billing-only job', $s$SELECT public.gc_link_crew_job(gbt.k('b2'), '00000000-0000-0000-0000-000000000902')$s$, 'That job is for billing only. Nobody clocks in on it. Pick the job our crew works on.');
SELECT gbt.same('nothing linked after the refusals', gbt.jobs(), 'Concrete:- Plumbing:- Plumbing:-');

-- 2) A dev links it, lets go and links it again; B's crew names the same job.
SELECT public.gc_link_crew_job(gbt.k('b2'), '00000000-0000-0000-0000-000000000901');
SELECT gbt.same('A''s plumbing names its job', gbt.jobs(), 'Concrete:- Plumbing:901 Plumbing:-');
SELECT public.gc_link_crew_job(gbt.k('b2'), NULL);
SELECT gbt.same('null lets go', gbt.jobs(), 'Concrete:- Plumbing:- Plumbing:-');
SELECT public.gc_link_crew_job(gbt.k('b2'), '00000000-0000-0000-0000-000000000901');
SELECT public.gc_link_crew_job(gbt.k('b3'), '00000000-0000-0000-0000-000000000901');
SELECT gbt.same('linked again, and B''s too', gbt.jobs(), 'Concrete:- Plumbing:901 Plumbing:901');

-- The guard: only the link changes the column, and its flag is off again once it returns.
SELECT gbt.same('the link turns its flag off before it returns', coalesce(current_setting('gc.crew_job_write', true), ''), '');
SELECT gbt.refused('a dev''s plain write to the column', $s$UPDATE public.gc_trade_packages SET job_ledger_id = '00000000-0000-0000-0000-000000000903' WHERE id = gbt.k('b2')$s$, 'Our crew''s Pipeline job changes only through Pick its Pipeline job on Draws.');
SELECT gbt.refused('a new trade that names a job', $s$INSERT INTO public.gc_trade_packages (project_id, trade, position, ours, job_ledger_id) VALUES ('00000000-0000-0000-0000-0000000009a1', 'Gas', 2, true, '00000000-0000-0000-0000-000000000903')$s$, 'Our crew''s Pipeline job changes only through');
UPDATE public.gc_trade_packages SET budget = 26000 WHERE id = gbt.k('b2');
SELECT gbt.same('a plain write to another column passes, the job kept', gbt.jobs(), 'Concrete:- Plumbing:901 Plumbing:901');
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d4');
SELECT gbt.refused('the office team''s plain write, which its policy allows', $s$UPDATE public.gc_trade_packages SET job_ledger_id = NULL WHERE id = gbt.k('b2')$s$, 'Our crew''s Pipeline job changes only through');
RESET ROLE;

-- The fixture's punches are made by no one signed in, as server code would.
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true);

-- 3) The punches. Two days ago: Ana twice and Ben once. Yesterday: Ana approved and Cal waiting. Today:
-- none that counts (Ana revoked, Ben rejected, Cal's salary day, the sample and the twin, Ana's quick
-- add, Ben on another job). Three days ago, Ana: outside the range asked.
SELECT gbt.punch('e1', '901', -2, 'a'), gbt.punch('e1', '901', -2, 'a again'), gbt.punch('e2', '901', -2, 'b');
SELECT gbt.punch('e1', '901', -1, 'a approved'), gbt.punch('e3', '901', -1, 'c waiting');
UPDATE public.clock_sessions SET approved_at = now() WHERE notes = 'a approved';
SELECT gbt.punch('e1', '901', 0, 'revoked'), gbt.punch('e2', '901', 0, 'rejected'), gbt.punch('e3', '901', 0, 'salary'),
  gbt.punch('e4', '901', 0, 'sample'), gbt.punch('e5', '901', 0, 'twin'), gbt.punch('e2', '903', 0, 'other job');
UPDATE public.clock_sessions SET revoked_at = now(), revoked_by = '00000000-0000-0000-0000-0000000009d1' WHERE notes = 'revoked';
UPDATE public.clock_sessions SET rejected_at = now(), rejected_by = '00000000-0000-0000-0000-0000000009d1' WHERE notes = 'rejected';
UPDATE public.clock_sessions SET origin = 'salary_schedule' WHERE notes = 'salary';
INSERT INTO public.clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date, notes, job_ledger_id, quick_add_minutes)
  VALUES ('00000000-0000-0000-0000-0000000009e1', current_date + time '19:00', current_date + time '19:15', current_date, 'quick', '00000000-0000-0000-0000-000000000901', 15);
SELECT gbt.punch('e1', '901', -3, 'before the range');
-- A trade we hire with a job set past the function (server code, no one signed in, which the guard lets
-- through): it never counts.
UPDATE public.gc_trade_packages SET job_ledger_id = '00000000-0000-0000-0000-000000000901' WHERE id = gbt.k('b1');

-- 4) The counts.
SET LOCAL ROLE authenticated;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SELECT gbt.same('a person once a day, a waiting punch in, and only what counts', gbt.counts(-2, 0), '-2 Plumbing:2, -1 Plumbing:2');
SELECT gbt.same('the days asked only', gbt.counts(-3, -3), '-3 Plumbing:1');
SELECT gbt.same('B''s crew reads the same job, as its own trade', gbt.counts(-2, -2, '00000000-0000-0000-0000-0000000009a2'), '-2 Plumbing:2');
SELECT gbt.same('92 days is allowed', gbt.counts(-91, 0), '-3 Plumbing:1, -2 Plumbing:2, -1 Plumbing:2');
SELECT gbt.refused('93 days', $s$SELECT gbt.counts(-92, 0)$s$, 'Count at most 92 days at a time.');
SELECT gbt.refused('the days the wrong way round', $s$SELECT gbt.counts(0, -1)$s$, 'Say the first and the last day to count.');
SELECT gbt.refused('no first day', $s$SELECT * FROM public.gc_crew_on_site('00000000-0000-0000-0000-0000000009a1', NULL, current_date)$s$, 'Say the first and the last day to count.');
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d2');
SELECT gbt.same('a dev in training reads it', gbt.counts(-1, -1), '-1 Plumbing:2');
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d3');
SELECT gbt.refused('a twin, even a dev', $s$SELECT gbt.counts(-2, 0)$s$, 'Only a dev reads our crew''s clock-ins on a GC job while Building is built.');
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d4');
SELECT gbt.refused('an estimator', $s$SELECT gbt.counts(-2, 0)$s$, 'Only a dev reads our crew''s clock-ins on a GC job while Building is built.');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT gbt.refused('anon', $s$SELECT * FROM public.gc_crew_on_site('00000000-0000-0000-0000-0000000009a1', current_date, current_date)$s$, 'permission denied');
RESET ROLE;

-- 5) A job deleted lets go of the trade, with someone signed in: the guard lets its own key go.
SET LOCAL ROLE authenticated;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SELECT public.gc_link_crew_job(gbt.k('b3'), '00000000-0000-0000-0000-000000000904');
RESET ROLE;
DELETE FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-000000000904';
SELECT gbt.same('the deleted job let go of B''s crew', gbt.jobs(), 'Concrete:901 Plumbing:901 Plumbing:-');

DO $$ BEGIN RAISE NOTICE 'gc_building PASSED'; END $$;
ROLLBACK;
```

### The migration doc as it will be

`docs/migrations/<stamp>_gc_crew_job.md`: what it adds (the column, its guard, the two functions), the lock note, who may call each,
the bed's numbers, and the checks after the push (below). Its first line is `# <stamp>_gc_crew_job.sql (<date>, v2.NNNN)`.

### Verify after the push (the lead)

- `gc_trade_packages.job_ledger_id` exists, `uuid`, null on every row, with its foreign key to `jobs_ledger` (`ON
  DELETE SET NULL`) and `gc_trade_packages_job_ledger_idx`.
- `gc_crew_on_site` is `SECURITY DEFINER` and `STABLE`; `gc_link_crew_job` is `SECURITY INVOKER`. For both,
  `has_function_privilege('anon', …, 'execute')` is false and `authenticated` is true.
- `gc_trade_packages` carries `gc_trade_packages_crew_job_guard` (BEFORE INSERT OR UPDATE, each row) beside
  `gc_trade_packages_award_guard`.
- As a dev, `SELECT * FROM gc_crew_on_site('<the test project>', app_today() - 7, app_today())` returns no rows (nothing
  linked), and `app_today() - 92` to `app_today()` is refused with "Count at most 92 days at a time."
- `npm run check:migration-drift` is clean.

### Rollback

`DROP FUNCTION public.gc_crew_on_site(uuid, date, date); DROP FUNCTION public.gc_link_crew_job(uuid, uuid);
DROP TRIGGER gc_trade_packages_crew_job_guard ON public.gc_trade_packages; DROP FUNCTION
public.gc_trade_packages_crew_job_guard(); ALTER TABLE public.gc_trade_packages DROP COLUMN job_ledger_id;` The last
line forgets every link, which a dev makes again on Draws. Nothing else reads the column until U8b.

## U8b: the mapper, the io and the screens

No migration. It is cut after U8a is pushed and gc 7's regen puts `job_ledger_id`, `gc_link_crew_job` and
`gc_crew_on_site` in `src/types/database.ts`. A type stand-in is never committed.

### The head count (`dailyLogRows.ts`, `dailyLogIo.ts`)

```ts
/** One row of gc_crew_on_site: how many of our people clocked in on a trade's Pipeline job that day. */
export type CrewOnSiteRow = Database['public']['Functions']['gc_crew_on_site']['Returns'][number]

/** The count for our crew's trade on a day, or null when nobody clocked in. */
export function crewOnSiteOn(rows: CrewOnSiteRow[], packageId: string, date: string): number | null

/** A log with our crew's clock-ins laid in: each trade our own crew does with a count that day has it as its workers. */
export function logWithClockIns<T extends Pick<DailyLog, 'date' | 'crews'>>(log: T, project: Pick<GcProject, 'packages'>, rows: CrewOnSiteRow[]): T

/** gc 10's 3a: the board's logs with our crew's clock-ins laid in. Composed right after withDailyLogs. */
export function withCrewClockIns(state: GcState, rows: CrewOnSiteRow[]): GcState

/** Call 6: the crews a save sends. Our crew's row is left off on a day that has a count. */
export function crewsToSave(crews: DailyLog['crews'], rows: CrewOnSiteRow[], date: string): DailyLog['crews']

/** The 92-day pages from one day to another, oldest first. Empty when `to` is before `from`. */
export function crewCountPages(from: string, to: string): { from: string; to: string }[]
```

- `logWithClockIns` reads only the trades with `selfPerform`, so a row for any other trade is ignored. A count replaces
  that trade's typed workers, or adds the trade when the log has none, keeping the crews in the job's order of trades
  as `dailyLogFromRow` does. A log with no count that day comes back as it was (the same object).
- `withCrewClockIns` touches only logs that exist (call 3b) and returns the same state when there are no rows.
- `loadGcCrewOnSite(projectId, from, to)` in `dailyLogIo.ts` calls `gc_crew_on_site` once a page, oldest first, and
  joins the rows. A page that fails throws, and the page shows the problem the way the logs' load does.

### The percent (`crewJobRows.ts`, `crewJobIo.ts`, both new)

```ts
export type CrewStageRow = Database['public']['Functions']['list_job_stage_progress']['Returns'][number]

/** What the page read for one linked trade. */
export interface CrewJobRead {
  packageId: string
  jobId: string
  /** The job's number as the Pipeline shows it (`jobNumberLabel`). */
  label: string
  name: string
  stages: CrewStageRow[]
  /** The crew report's percent while it is the newest word on the job (`currentReportPctByJobId`), and its day. */
  reportPct: number | null
  reportedOn: string | null
  /** The job's own percent, `jobs_ledger.pct_complete`. */
  pctComplete: number | null
}

export interface CrewPercent {
  /** 'report': the crew report's percent, the newest word on the job. 'job': `pct_complete`. 'none': nothing to read. */
  from: 'stages' | 'report' | 'job' | 'none'
  /** Each scope line's percent, when `from` is 'stages'. */
  pctByLine?: Record<string, number>
  /** The whole trade's percent: from the stages, the report or the job's. */
  pctDone?: number
  /** The day each line's stage was last reported, in the company's time zone. */
  reportedByLine: Record<string, string | null>
  /** The newest day any of it was reported. */
  reportedOn: string | null
}

/** Calls 5, 7 and 8: our crew's percent from its Pipeline job. */
export function crewPercentOf(pkg: TradePackage, read: CrewJobRead): CrewPercent

/** The board with each linked crew's percent laid into `selfPerform` (`pctByLine`, `pctDone`, `source`). 'none' leaves it. */
export function withCrewPercents(state: GcState, reads: CrewJobRead[]): GcState
```

`TradePackage.selfPerform` on main gains one optional field, which only `withCrewPercents` sets:

```ts
    /** Where the percent came from (Building U8): the Pipeline job's stages, its crew report or its own percent. Absent: not linked, or nothing read. */
    source?: { from: 'stages' | 'report' | 'job'; job: string; on: string | null }
```

- A line's percent is the weighted mean of its rank's stages' `progress_pct` (null reads 0), by `weight_pct`, or the
  plain mean when every weight is 0. `pctDone` with stages is `crewPctFromStages`, so it is the same number
  `ownCrewWork` shows.
- The stages count only when at least one matched stage was reported (`progress_at`). When none was, the whole job's
  percent stands in: 'report' while the crew report is the newest word, else 'job' from `pct_complete`. A job with no
  stage reported, no current report and no `pct_complete` is 'none', and the trade keeps today's empty percent and
  words, so a missing number never reads as a measured zero (gc 5).
- `progress_at` becomes a day with `isoToPlainDateInAppTz`.
- `crewJobIo.ts`:
  - `loadCrewJobs(links)` reads `jobs_ledger` (id, numbers, name, `pct_complete`) for the linked jobs in one select,
    `list_latest_report_completion_pct` once for all of them, and `list_job_stage_progress` once a job.
  - `linkCrewJob(packageId, jobId | null)` calls `gc_link_crew_job`.
  - `searchCrewJobs(text)` calls `search_jobs_ledger`, which leaves billing-only jobs out by default.
  - `suggestCrewJobs(projectId, ownBidId)` reads the jobs on this project or from our own bid.
- `projectRows.ts`: the trade row reads `job_ledger_id` beside `own_bid_id`.

### The page (`GcProjects.tsx`)

- **The percents**: once the board loads, for a dev (`canUseGcBuilding`), `loadCrewJobs` reads every linked trade
  our own crew does, and the `board` variable itself becomes `withCrewPercents(loadedBoard, reads)` (call 12): every
  window, the Schedule mount among them, reads that one value, and no second memo stands beside it. A failed read
  leaves the board as it was and says so once.
- **The counts**: `loadDailyLogs` also reads `loadGcCrewOnSite` for each building job with a linked crew, from its
  `startedOn` to today (call 13). `boardWithLogs` becomes `withCrewClockIns(withDailyLogs(board, logRows), crewRows)`.
- **Linking**: `onLink` calls `linkCrewJob`, then reads the board's trades and the crew again, so the card, the log and
  the schedule move together.

### Our own crew on Draws (`GcOwnCrew.tsx`, new; `GcDrawsWindow.tsx`)

The prototype's `GcBuildingCrewCard`, on Draws under the trades' draws, one card for each trade our own crew does. The
stage pickers are gone: each stage reads from the Pipeline, with the day it was reported.

```
Plumbing · our own crew   [Pipeline job J 1071]  Change          Our number $26,000   Done $10,400   Left $15,600
  Underground · $5,200    [██████████]  100% · Sep 28
  Rough in · $9,100       [████      ]   40% · Oct 6
  Top out · $6,500        [          ]    0%
  Trim · $5,200           [          ]    0%
  The whole trade         [████      ]   40% done
  Each stage reads its percent from Pipeline job J 1071. The whole trade follows from the stages.
  We pay our own crew through payroll. There are no draws, retainage or waivers here.
```

- Not linked: the chip reads **No Pipeline job yet** (amber) with **Pick its Pipeline job**, and the words say "Pick
  the job our crew works on. Its stages give our percent. Its clock-ins give the daily log's count."
- The picker opens under the card: **Suggested** (this project's or our own bid's job) first, then a search box
  ("Job number, name or address") with up to 8 results, each **Use this job**. **Unlink it** lets go. A refusal shows
  the function's words above the card. A job another crew trade holds comes last, with **On Electrical already** and
  **Use this job** off (call 11; `crewJobsHeld` and `heldByOthers` in `crewJobRows.ts`, from the trades the page read).
  A job O11b's general conditions holds (`generalConditionsJobId`) reads **On general conditions already** once
  O11b-2 is on main: in U8b if it lands first, else a follow-up.
- The stages do not match: "Pipeline job J 1071's stages do not match ours. The whole trade reads the job's percent,
  reported Oct 6." Nothing reported: "Nothing is reported on Pipeline job J 1071 yet."
- `GcDrawsWindow` gains an optional `ownCrew` prop (the reads and the link's three calls). Without it, Draws is as
  today.

### Our crew on the daily log (`GcDailyLog.tsx`)

`GcDailyLogWindow` gains an optional `ourCrew` prop: the count rows and each linked trade's job label.

- A day with a count: our crew's row shows the number with **clocked in**, and no box to type in. Under the crews:
  "Our crew's count is who clocked in on Pipeline job J 1071 that day. It changes only in the Pipeline."
- Linked, no count that day: the box as today, and "Nobody clocked in on Pipeline job J 1071 that day. Type the count
  if they were here."
- Not linked: the box as today, and "Our crew's count is typed here until Draws names its Pipeline job."
- A new day's form starts from `logWithClockIns(newDailyLog(project, day), project, rows)`. The save sends
  `crewsToSave` (call 6).

### Our crew's line on Bill the customer (`ownerBilling.ts`, co-signed by gc 5)

`tradeLine`'s `source` for a trade our own crew does reads `selfPerform.source`, and `GcBillCustomer`'s draft lines
show it as they show every line's source. No component changes.

- From the stages: "Our own crew is 40% done, from Pipeline job J 1071's stages."
- From the crew report: "Our own crew is 40% done, from the crew report of Oct 8."
- From the job's own percent: "Our own crew is 40% done, from Pipeline job J 1071's percent."
- No `source` (not linked, or 'none'): today's words, "Our own crew reported 40% done." or "Our own crew has not
  reported any work yet."

gc 5's O10b touches `GcBillCustomer.tsx` (the architect's reminder beside a sent bill), apart from these words.
Whichever lands second rebases.

### The guide and the docs

- **New guide** `link-our-own-crew-to-its-pipeline-job.md` (title `link our own crew to its Pipeline job`, roles dev,
  Bids & Estimating): what the link gives, picking the job on Draws, what the log and the stages then show, and
  unlinking. The guide `write-the-daily-log-for-a-job-we-are-building` gains a short section on our crew's count, and
  `bill-the-customer-on-a-gc-job` one sentence: "A trade our own crew does reads its percent from its Pipeline job. The
  line says where it came from."
- `PROJECT_DOCUMENTATION.md` (Draws' Our own crew card, the log's clocked-in row), `docs/ACCESS_CONTROL.md` (the
  counts-only definer and its door), `GLOSSARY.md` (**Our own crew**, amended in place if it is there).

### The tests

- `dailyLogRows.test.ts`: a log with clock-ins reads the count, one with none keeps the typed count, clock-ins with no
  log make no log, a hired trade's row is ignored, the crews keep the job's order, another project's rows change
  nothing, `crewsToSave` leaves only the counted crew off, and the pages split at 92 days.
- `crewJobRows.test.ts`: the four stages matched by rank (`Rough In`, `Top Out`, `Trim Set`, `Underground`), two stages
  of one rank averaged by weight, one line unmatched (the whole job), no stages (the report's percent), stages matched
  but none reported (the whole job), a report older than the office's hand-set (`pct_complete`, 'job'), nothing
  (`none`, the trade's percent and `source` left empty, gc 5), `withCrewPercents` leaving an unlinked trade, and the
  held jobs named on this GC job and on another, a trade's own job left out (call 11).
- `ownerBilling.test.ts`: our crew's line says each of the three sources, and an unlinked trade's line keeps today's
  words.
- `GcOwnCrew.render.test.tsx`: the stages read only with their days, the words in plain words, the suggested job
  first, a search and **Use this job** calling the link, **Unlink it**, a refusal shown, and a held job last with its
  **Use this job** off (call 11).
- `GcDailyLog.render.test.tsx`: the counted row has no box, the save leaves it off, the linked and the unlinked notes.
- `GcProjects.render.test.tsx`: the page reads the counts in pages for a building job with a linked crew, the
  board's percent reaches Draws, and Schedule opened after a crew read shows the stage's percent on its bar (gc 10).

## Drift from `BUILDING_REAL_BUILD.md`

- **Decision 11** says each stage reads the job's newest percent report by stage name (`currentReportPctByJobId`,
  `newestPercentEvent`). The crew's report stamps each stage's own progress (`record_stage_progress`), and
  `list_job_stage_progress` reads it back, so U8 reads that, matched by `stageRank`. `currentReportPctByJobId` is used
  only for the whole job's percent. `newestPercentEvent` is not used.
- **"Read and never stored"** is kept, through call 6.
- **"U8: one column"** gains a partial index on it, for the job's delete that sets it null.
- **The schedule's PR 16, our crew (G-51)**: the head count and the percent land in U8 as shared functions. PR 16
  composes them into the Schedule's io and plans any write of real days (call 4).

## The check (U8b, on "GC test project, delete me", as a dev)

Link the test project's plumbing to a Working Pipeline job that has clock-ins today and stage progress. This is a read
of that job, and the link writes only the test project's trade. The daily log shows our crew's count, read only, and
the Schedule's people on site reads it. Draws shows the stages with the days reported, and Bill the owner's line for
our crew reads the same percent. **Unlink it**: the log's box comes back. Leave the test project unlinked.

## When it is cut

After U7c and U3b-ii (the lead's order). U8a: number from `origin/main`, claim once, the bed, the PR, then the lead's
`supabase db push` in a quiet moment and gc 7's regen. U8b after the regen. Neither deploys a function.

## Docs each PR touches

- **U8a**: `docs/migrations/<stamp>_gc_crew_job.md`, the release note `v2.NNNN.ts` and its fragment
  ("GC mode: our own crew's Pipeline job and its clock-ins, behind the scenes").
- **U8b**: the guide and the amended one, `PROJECT_DOCUMENTATION.md`, `docs/ACCESS_CONTROL.md`, `GLOSSARY.md`, the
  release note and its fragment ("GC mode: our own crew from its Pipeline job").

## Seams

- **gc 10, Schedule**: `withCrewClockIns`, `loadGcCrewOnSite`, `withCrewPercents` and `loadCrewJobs` are the shared
  pieces PR 16 composes. U8 writes no bar's days.
- **gc 5, Owner Billing** (co-signed amendment 2): Bill the owner's line for our own crew reads `selfPerform`
  (`billingForecast.ts`, `tradeLine`). On a linked trade it now reads the Pipeline's percent, for the money team as for
  a dev, and says where it came from. An unlinked trade bills as today. O10's notices carry no percents, so O10 needs
  nothing from U8. O11a reads `selfPerform.pctDone` and `source` as our crew's percent, and counts each linked job's
  spend once (call 11). O11b's general conditions picker marks a job a crew trade holds (*On Plumbing already*).
- **The Board and money lane**: "our own crew at its Pipeline cost in jobMargin" (LEDGER, after Building's U8) can read
  `job_ledger_id`.
- **Building's door**: both functions' gates (call 2, call 9). The column's guard comes with U8a, and the door
  inherits it (call 10). The door's `gc_link_crew_job` refuses a job another crew trade holds, on any GC job (call 11),
  and `90_crew.sql`'s *linked again, and B's too* case turns into that refusal. The percents read for a dev and the money team (amendment 2), so after the schedule's PR 10
  an office user outside them sees our crew's bars at 0% on the chart, and its pull offers never see our crew finish (gc 10, the class of 9d's call 1). The read half
  of Building's door closes it, with the submittals and the RFIs.

## Is this the best we can do?

- The count is a number with no names, and it reads clock_sessions past its own policy only for that. A superintendent
  at the door gets how many, never who or how long.
- One shared overlay for the log and the chart, so the two cannot disagree (gc 10's 3a).
- Nothing is copied: the count and the percent are read each time from the records that own them, and a change in the
  Pipeline shows on the GC job at the next read.
- What it does not do: place a stage's real start or finish (call 4), count a crew that does not punch (the typed box
  stays), or split one Pipeline job's crew between two crew trades (call 11: one job, one trade).

## Status

Plan 2026-10-10, gc 4. The count's shape agreed with gc 10, whose four changes are calls 1 to 5. U8a's SQL bed-tested
on main at 06ab01043. The screen's and the refusals' words above pass `plainWordsFailures`. Amendment 1
(2026-10-10): the lead approved calls 6 to 9 and 11 to 13 and changed 10 to the column's guard, now in U8a and
bed-tested (28 assertions, 25 of 25 planted bugs). gc 10 signed off, with call 12 made exact and a page test added.
Amendment 2 (2026-10-10): gc 5's two asks, co-signed: the percent read takes O9's gate, and Bill the customer's line
for our crew names its source, a missing number never reading as a measured zero. Its words pass `plainWordsFailures`.
Amendment 3 (2026-10-10): call 11 is one Pipeline job per crew trade, the picker saying so in U8b and Building's door
refusing it in SQL. U8b is built on claude/gc-building-u8b-crew-screens, waiting on U8a's push, the regen and U7c.
