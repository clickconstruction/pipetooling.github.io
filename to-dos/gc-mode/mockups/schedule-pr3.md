---
name: "The schedule's PR 3: moves and the records, as tables"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 3; The tables (Moves, and the records a move carries, and Keeping it true)
branch: the plan on spike/schedule-pr3-plan (from origin/spike/gc-mode at 0931222ba); the migration from origin/main when the PR is cut, after PR 2 (#4814) is on main
status: plan 2026-10-07 by Helper 1 at the lead's ask. Nothing is applied. The stamp and the version are claimed when the PR is cut, after main's newest and after any claim not yet merged. Helper 1 never applies it; the lead pushes it after PR 2's, from a clean checkout, and opens the types PR.
---

# The schedule's PR 3: moves and the records, as tables

## What it is

- **One migration**, `<stamp>_gc_schedule_moves_records.sql`, with eleven tables:
  - `gc_schedule_moves`, with `gc_schedule_move_pushes`, `gc_schedule_move_tells` and
    `gc_schedule_move_answers`;
  - `gc_schedule_walks` and `gc_schedule_lookahead_marks`;
  - `gc_schedule_waits` with `gc_schedule_wait_holds`;
  - `gc_schedule_late_notices`, `gc_schedule_crew_counts` and `gc_schedule_sends`.
- **The house rules, as PR 2:**
  - `SET lock_timeout = '3s';` first.
  - `IF NOT EXISTS` and `DROP POLICY IF EXISTS` throughout.
  - One `FOR ALL` dev policy per table, in the `(SELECT public.is_dev())` form, with `anon` revoked.
  - The three sweep calls at the end.
  - Every table with a `project_id` hangs off `gc_schedules(project_id)`.
- **The records that never change** keep PR 2's append-only pattern: privileges, not a missing
  policy. Two of them keep one door: Undo's pair on a move, and the office's push back on a late
  notice. Call 1 has the list.
- **With it:** the migration doc, a release note and its fragment. No client change and no types;
  the types PR follows the push.
- **It needs PR 2's tables.** It references `gc_schedules`, `gc_schedule_activities` and
  `gc_schedule_changes`, so it is cut after #4814 is on main and pushed after PR 2's migration.
- **Nothing reads or writes these tables yet.** The RPCs are PR 5. The trades' writes come
  through their portal's function in PR 14: a late notice, a kept day, a crew count, an answer and
  a trade's mark.

## Four calls for the lead

1. **Which tables are append only.** This is the prototype's reducer, case by case
   (`gcReducer.ts` on the spike):

   | Table | Append only? | What the prototype does to a kept one |
   |---|---|---|
   | `gc_schedule_moves` | **Yes, but Undo's pair** | Undo sets `undoneOn` and `undoneBy`, and Redo clears them (`undoMove`, `redoMove`). Nothing else changes on a saved move: its tells and answers are rows of their own, and a part's own move is in the same save. |
   | `gc_schedule_move_pushes` | **Yes** | Kept with the move, never changed. |
   | `gc_schedule_move_tells` | **Yes** | Told once (`tellTradesMoves` refuses a move told already). |
   | `gc_schedule_move_answers` | **Yes** | One answer per company, refused a second time (`tradeAnswerDates`). |
   | `gc_schedule_late_notices` | **Yes, but the office's push back** | `pushBackLateNotice` sets `pushedBack` once, and `tradeKeepDay` sets `kept` once. A newer notice replaces an open one without touching it. |
   | `gc_schedule_crew_counts` | **Yes** | Only added, newest first; the newest counts (`crewCountsNow`). |
   | `gc_schedule_sends` | **Yes** | Only added, as the letter went. |
   | `gc_schedule_walks` | **Yes** (my pick; see call 2) | Only added (`recordScheduleWalk`), once, at the walk's end. |
   | `gc_schedule_lookahead_marks` | No | A trade's mark is replaced until it is checked (`tradeMarkLookAhead`), and checking sets the verified columns (`verifyLookAhead`). |
   | `gc_schedule_waits` | No | Its steps and expected day change (`setScheduleWaitStep`), and Remove takes it off (`removeScheduleWait`). |
   | `gc_schedule_wait_holds` | No | Its bars go with the wait's edits. |

   Append only means `authenticated` has no UPDATE, DELETE or TRUNCATE. Two column grants are the
   doors: `UPDATE (undone_on, undone_by)` on moves, and `UPDATE (pushed_back_on, pushed_back_by,
   pushed_back_note)` on late notices. A notice's `kept_on` is the company's own word, from its
   portal's function with the service role (PR 14), so the office has no grant on it. A row still
   goes when its schedule, its bar or its move goes, by cascade, which runs as the table's owner.

2. **A walk keeps its moves, as the prototype does.** *The tables* puts `walk_id` on a move, and
   the lead reads a walk as something that may be edited. But the prototype never edits a walk.
   Its moves are saved as they are made, during the walk. The walk is recorded once, at its end,
   with their ids (`ScheduleWalk.moveIds`, `recordScheduleWalk`).
   - Pointing a move at a walk that does not exist yet needs one of two things. Either an update
     to a move, which never changes otherwise, or a walk row made at the start. A walk row made at
     the start would read as walked if the walk were left half done (`walkStanding`).
   - **My pick** is `gc_schedule_walks.move_ids uuid[]`, the prototype's own shape, with walks
     append only. Moves are never deleted, so the ids cannot go stale.
   - The other way is `walk_id` on the move, with walks editable. That costs a `finished` column,
     so a walk left half done does not count, and the update to the move.
3. **`company_id`, not `partner_id`.** Main's GC tables name the Board's company record
   `company_id`, with no foreign key until that table exists (`gc_plan_questions`,
   `gc_plan_set_sends`). These tables do the same: tells, answers, late notices, crew counts, and
   a trade's mark (`marked_by_company_id`). *The tables* says `partner_id`, the prototype's word.
4. **The plan writes' words tie a move to its version.** `gc_schedule_moves.schedule_version` is
   the version the move made (decision 5), and every plan write makes a line in
   `gc_schedule_changes`. A foreign key (`project_id`, `schedule_version`) to that line makes
   sure every move has its words. It is `DEFERRABLE INITIALLY DEFERRED`, so the writer may insert
   the move and the line in either order in one transaction. *The tables* does not have it. My
   pick is to add it; leaving it out loses nothing the kernels need.

## The tables

| Table | One row per | The prototype's | Append only |
|---|---|---|---|
| `gc_schedule_late_notices` | trade's late notice | `LateNotice` | yes, but the office's push back |
| `gc_schedule_walks` | weekly walk | `ScheduleWalk` | yes |
| `gc_schedule_moves` | move | `ScheduleMove` | yes, but Undo's pair |
| `gc_schedule_move_pushes` | bar a move pushed | `ScheduleMove.pushed` | yes |
| `gc_schedule_move_tells` | company told of a move | `toldOn`, `toldTo` | yes |
| `gc_schedule_move_answers` | company's answer | `ScheduleMove.answers` | yes |
| `gc_schedule_lookahead_marks` | bar and week | `LookAheadMark` | no |
| `gc_schedule_waits` | wait from outside the trades | `ScheduleWait` | no |
| `gc_schedule_wait_holds` | wait and bar it holds | `ScheduleWait.lineIds` | no |
| `gc_schedule_crew_counts` | trade's count for a week | `CrewCount` | yes |
| `gc_schedule_sends` | customer's schedule sent | `ScheduleSend` | yes |

They are created in that order, so each key's table exists first.

## The SQL as it will be

```sql
SET lock_timeout = '3s';

-- GC mode, the real build, the schedule's PR 3 (v2.NNNN): moves and the records, from the
-- prototype's model (to-dos/gc-mode/SCHEDULE_REAL_BUILD.md on branch spike/gc-mode, "The tables":
-- Moves, and the records a move carries, and Keeping it true). A move with what it pushed, the
-- companies told and their answers; the weekly walks; a week's look-ahead marks; what the work
-- waits on from outside the trades and the bars it holds; a trade's late notice and crew count;
-- and the customer's schedule as sent. The records that never change once kept are append only
-- (privileges below). Who sees them: dev only while it is built (decision 4); the schedule's PR 10
-- opens them to the job's team. Nothing reads or writes these yet: the RPCs are the schedule's PR
-- 5, and the trades' writes come through their portal's function (PR 14).

-- A trade's word that it will be late (LateNotice, G-117), from its portal. Where it stands (open,
-- taken, replaced, moved, pushed back, kept) is worked out each time (lateNoticeState), never
-- stored. Append only, but for the office's push back. Made before the moves, which name the one
-- they take.
CREATE TABLE IF NOT EXISTS public.gc_schedule_late_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_schedules(project_id) ON DELETE CASCADE,
  -- The company that sent it: the Board's company record, which gains its foreign key when that
  -- table exists.
  company_id uuid NOT NULL,
  activity_id uuid NOT NULL,
  sent_on date NOT NULL,
  -- The company's contact, by name, as its portal had it.
  sent_by text NOT NULL,
  -- Under way when sent: the day asked for is a new finish. Not started: a new start.
  started boolean NOT NULL,
  was_start date NOT NULL,
  was_finish date NOT NULL,
  to_start date NOT NULL,
  to_finish date NOT NULL,
  reason text NOT NULL
    CONSTRAINT gc_schedule_late_notices_reason_known CHECK (reason IN ('weather', 'trade before', 'materials', 'crew', 'other')),
  note text NOT NULL
    CONSTRAINT gc_schedule_late_notices_said CHECK (btrim(note) <> ''),
  -- The office's push back, and after it the company's word, from its portal, that it will make
  -- the day.
  pushed_back_on date,
  pushed_back_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  pushed_back_note text,
  kept_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Its bar is a bar of this job.
  CONSTRAINT gc_schedule_late_notices_bar_fkey FOREIGN KEY (project_id, activity_id)
    REFERENCES public.gc_schedule_activities(project_id, id) ON DELETE CASCADE,
  CONSTRAINT gc_schedule_late_notices_dates_in_order CHECK (was_finish >= was_start AND to_finish >= to_start),
  CONSTRAINT gc_schedule_late_notices_pushed_back_whole CHECK (
    (pushed_back_on IS NULL) = (pushed_back_note IS NULL) AND (pushed_back_note IS NULL OR btrim(pushed_back_note) <> '')
  ),
  CONSTRAINT gc_schedule_late_notices_kept_after_push_back CHECK (kept_on IS NULL OR pushed_back_on IS NOT NULL)
);

COMMENT ON TABLE public.gc_schedule_late_notices IS
  'GC mode (v2.NNNN): a trade''s word, from its portal, that it will be late on its bar (LateNotice, G-117): the company, when, the dates it was sent against and the dates it asks for, why, its words; the office''s push back and the company''s answer that it will make the day. Where it stands is worked out (lateNoticeState). Append only, but the office''s push back (column grants below); the company''s kept_on comes through its portal''s function.';

CREATE INDEX IF NOT EXISTS gc_schedule_late_notices_project_idx ON public.gc_schedule_late_notices (project_id, created_at);
CREATE INDEX IF NOT EXISTS gc_schedule_late_notices_bar_idx ON public.gc_schedule_late_notices (project_id, activity_id);

-- One per weekly walk (ScheduleWalk, G-52), recorded once at its end with the moves made during it,
-- as the prototype does. Moves are never deleted, so the ids it keeps stay good. Append only.
CREATE TABLE IF NOT EXISTS public.gc_schedule_walks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_schedules(project_id) ON DELETE CASCADE,
  walked_on date NOT NULL,
  walked_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  -- The bars looked at and left as drawn.
  kept uuid[] NOT NULL DEFAULT '{}',
  -- The moves made during it (gc_schedule_moves.id), the prototype's moveIds.
  move_ids uuid[] NOT NULL DEFAULT '{}',
  -- The bars it listed and nobody looked at.
  skipped integer NOT NULL DEFAULT 0
    CONSTRAINT gc_schedule_walks_skipped_counted CHECK (skipped >= 0),
  -- The early finishes it answered with Keep the dates (G-37).
  kept_early uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  -- A walk that looked at nothing is not recorded.
  CONSTRAINT gc_schedule_walks_looked CHECK (cardinality(kept) + cardinality(move_ids) > 0)
);

COMMENT ON TABLE public.gc_schedule_walks IS
  'GC mode (v2.NNNN): one weekly walk of a GC project''s schedule (ScheduleWalk, G-52), recorded once at its end: the day, who, the bars kept as drawn, the moves made during it (move_ids), the bars listed and not looked at, and the early finishes answered with Keep the dates. Append only.';

CREATE INDEX IF NOT EXISTS gc_schedule_walks_project_idx ON public.gc_schedule_walks (project_id, walked_on);

-- One row per move (ScheduleMove; the owner, 2026-10-05: "when a bar is moved an explanation should
-- be given and recorded"). Who, when, the bar's dates before and after, the reason and the words,
-- what it did to the finish, and what kind of move it was. Append only, but Undo's pair, which Undo
-- sets and Redo clears (G-40).
CREATE TABLE IF NOT EXISTS public.gc_schedule_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_schedules(project_id) ON DELETE CASCADE,
  -- The bar moved, and its name that day, so the history still reads once a bar is removed.
  activity_id uuid REFERENCES public.gc_schedule_activities(id) ON DELETE SET NULL,
  activity_name text NOT NULL,
  -- The company day it was made, and the moment, which orders moves and names one in a refusal
  -- (decision 8).
  made_on date NOT NULL,
  made_at timestamptz NOT NULL DEFAULT now(),
  made_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  made_by_name text NOT NULL,
  from_start date NOT NULL,
  from_finish date NOT NULL,
  to_start date NOT NULL,
  to_finish date NOT NULL,
  reason text NOT NULL
    CONSTRAINT gc_schedule_moves_reason_known CHECK (reason IN ('weather', 'trade before', 'materials', 'crew', 'customer', 'plans', 'inspection', 'us', 'change order', 'other', 'early', 'recovery')),
  note text NOT NULL
    CONSTRAINT gc_schedule_moves_said CHECK (btrim(note) <> ''),
  -- What it waits on changed with it.
  links_changed boolean NOT NULL DEFAULT false,
  -- The job's last finish before and after.
  finish_from date NOT NULL,
  finish_to date NOT NULL,
  -- Undo sets these, Redo clears them: the only columns a move ever changes.
  undone_on date,
  undone_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- The signed change order whose days it put on the chart (G-76). It gains its foreign key when
  -- Owner Billing's change orders are a table.
  change_order_id uuid,
  -- The trade's late notice it took (G-117).
  late_notice_id uuid REFERENCES public.gc_schedule_late_notices(id) ON DELETE SET NULL,
  -- A pull (G-37): the lines that finished early.
  pull_finished uuid[],
  -- Days got back (G-82): side by side after a bar, with its gap before and after, or a second crew.
  recovery_how text
    CONSTRAINT gc_schedule_moves_recovery_known CHECK (recovery_how IS NULL OR recovery_how IN ('side', 'crew')),
  recovery_after_activity_id uuid REFERENCES public.gc_schedule_activities(id) ON DELETE SET NULL,
  recovery_gap_was integer,
  recovery_gap integer,
  -- Kept from a what-if copy made that day (G-81).
  from_what_if_on date,
  -- A part's own move (G-39): the part, and every part's days before and after, which Undo and
  -- Redo put back.
  parts jsonb,
  -- The version this move made (decision 5), whose words are its line in gc_schedule_changes.
  schedule_version integer NOT NULL
    CONSTRAINT gc_schedule_moves_version_counted CHECK (schedule_version >= 1),
  CONSTRAINT gc_schedule_moves_dates_in_order CHECK (from_finish >= from_start AND to_finish >= to_start),
  CONSTRAINT gc_schedule_moves_undone_whole CHECK (undone_by IS NULL OR undone_on IS NOT NULL),
  CONSTRAINT gc_schedule_moves_change_fkey FOREIGN KEY (project_id, schedule_version)
    REFERENCES public.gc_schedule_changes(project_id, version) ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE public.gc_schedule_moves IS
  'GC mode (v2.NNNN): one move on a GC project''s schedule (ScheduleMove): the bar and its name that day, who and when, its dates before and after, the reason and the words, what it did to the job''s finish, the version it made (its words in gc_schedule_changes), and what kind of move it was (a change order''s days, a late notice taken, a pull, days got back, a what-if kept, a part''s own move). Append only, but Undo''s pair: authenticated may update undone_on and undone_by and nothing else, and never delete.';

CREATE INDEX IF NOT EXISTS gc_schedule_moves_project_idx ON public.gc_schedule_moves (project_id, made_at);
CREATE INDEX IF NOT EXISTS gc_schedule_moves_bar_idx ON public.gc_schedule_moves (activity_id) WHERE activity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gc_schedule_moves_late_notice_idx ON public.gc_schedule_moves (late_notice_id) WHERE late_notice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gc_schedule_moves_recovery_after_idx ON public.gc_schedule_moves (recovery_after_activity_id) WHERE recovery_after_activity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gc_schedule_moves_version_idx ON public.gc_schedule_moves (project_id, schedule_version);

-- What came after a move and moved with it (ScheduleMove.pushed), its dates before and after.
-- Append only.
CREATE TABLE IF NOT EXISTS public.gc_schedule_move_pushes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id uuid NOT NULL REFERENCES public.gc_schedule_moves(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.gc_schedule_activities(id) ON DELETE SET NULL,
  from_start date NOT NULL,
  from_finish date NOT NULL,
  to_start date NOT NULL,
  to_finish date NOT NULL,
  CONSTRAINT gc_schedule_move_pushes_dates_in_order CHECK (from_finish >= from_start AND to_finish >= to_start),
  CONSTRAINT gc_schedule_move_pushes_once UNIQUE (move_id, activity_id)
);

COMMENT ON TABLE public.gc_schedule_move_pushes IS
  'GC mode (v2.NNNN): a bar that came after a move and moved with it (ScheduleMove.pushed), with its dates before and after. Undo and Redo put it back. Append only.';

CREATE INDEX IF NOT EXISTS gc_schedule_move_pushes_bar_idx ON public.gc_schedule_move_pushes (activity_id) WHERE activity_id IS NOT NULL;

-- The companies told of a move (toldOn, toldTo, G-132): one row per move and company, with each of
-- its bars the move changed and the dates the message gave. Append only.
CREATE TABLE IF NOT EXISTS public.gc_schedule_move_tells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id uuid NOT NULL REFERENCES public.gc_schedule_moves(id) ON DELETE CASCADE,
  -- The Board's company record, which gains its foreign key when that table exists.
  company_id uuid NOT NULL,
  told_on date NOT NULL,
  shown jsonb NOT NULL DEFAULT '[]',
  email_send_log_id uuid REFERENCES public.email_send_log(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_schedule_move_tells_once UNIQUE (move_id, company_id)
);

COMMENT ON TABLE public.gc_schedule_move_tells IS
  'GC mode (v2.NNNN): a company told that a move changed its dates (G-132): when, what the message showed (each of its bars with the new dates) and the email it went in. One per move and company. Append only.';

-- A company's answer from its portal (ScheduleMove.answers): the dates work, or another day asked
-- for (G-113). One per company, and only from a company told. Append only.
CREATE TABLE IF NOT EXISTS public.gc_schedule_move_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id uuid NOT NULL,
  company_id uuid NOT NULL,
  answered_on date NOT NULL,
  ok boolean NOT NULL,
  day date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_schedule_move_answers_told_fkey FOREIGN KEY (move_id, company_id)
    REFERENCES public.gc_schedule_move_tells(move_id, company_id) ON DELETE CASCADE,
  CONSTRAINT gc_schedule_move_answers_once UNIQUE (move_id, company_id),
  -- The dates work: no other day.
  CONSTRAINT gc_schedule_move_answers_day_asked CHECK (NOT ok OR day IS NULL)
);

COMMENT ON TABLE public.gc_schedule_move_answers IS
  'GC mode (v2.NNNN): a company''s answer, from its portal, to a move it was told of: the dates work (ok), or another day asked for with its words (G-113). One per company, and only from a company told (the key to gc_schedule_move_tells). Append only.';

-- A week's done or not done on a bar (LookAheadMark): a trade's, from its portal, until our
-- superintendent checks it; our own crew's, which counts as checked at once (crewMarkLookAhead).
CREATE TABLE IF NOT EXISTS public.gc_schedule_lookahead_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.gc_schedule_activities(id) ON DELETE CASCADE,
  -- The Monday of the week.
  week_of date NOT NULL
    CONSTRAINT gc_schedule_lookahead_marks_monday CHECK (extract(isodow FROM week_of) = 1),
  done boolean NOT NULL,
  reason text
    CONSTRAINT gc_schedule_lookahead_marks_reason_known CHECK (reason IS NULL OR reason IN ('weather', 'trade before', 'materials', 'crew', 'other')),
  marked_on date NOT NULL,
  -- A trade's mark: the Board's company record (its foreign key comes with that table). Our own
  -- crew's: who on our team.
  marked_by_company_id uuid,
  marked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- Our superintendent's check. Corrected: the mark as it should read, and why not done.
  verified_on date,
  verified_done boolean,
  verified_reason text
    CONSTRAINT gc_schedule_lookahead_marks_verified_reason_known CHECK (verified_reason IS NULL OR verified_reason IN ('weather', 'trade before', 'materials', 'crew', 'other')),
  verified_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_schedule_lookahead_marks_done_has_no_reason CHECK (NOT done OR reason IS NULL),
  CONSTRAINT gc_schedule_lookahead_marks_one_marker CHECK (marked_by_company_id IS NULL OR marked_by IS NULL),
  CONSTRAINT gc_schedule_lookahead_marks_verified_whole CHECK (verified_on IS NOT NULL OR (verified_done IS NULL AND verified_reason IS NULL AND verified_by IS NULL)),
  CONSTRAINT gc_schedule_lookahead_marks_corrected_reason CHECK (verified_reason IS NULL OR verified_done = false),
  CONSTRAINT gc_schedule_lookahead_marks_once UNIQUE (activity_id, week_of)
);

COMMENT ON TABLE public.gc_schedule_lookahead_marks IS
  'GC mode (v2.NNNN): a bar''s done or not done for a week of the look-ahead (LookAheadMark): the mark and why, who marked it (a company from its portal, or our own crew), and our superintendent''s check with any correction. A trade''s mark changes until it is checked. One per bar and week.';

-- What the work waits on from outside the trades (ScheduleWait, G-73 to G-75): a delivery, a
-- decision the customer owes, a permit, the utility's work.
CREATE TABLE IF NOT EXISTS public.gc_schedule_waits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_schedules(project_id) ON DELETE CASCADE,
  kind text NOT NULL
    CONSTRAINT gc_schedule_waits_kind_known CHECK (kind IN ('delivery', 'decision', 'permit', 'utility')),
  title text NOT NULL
    CONSTRAINT gc_schedule_waits_titled CHECK (btrim(title) <> ''),
  -- The trade whose work needs it. Null: the job's own.
  package_id uuid REFERENCES public.gc_trade_packages(id) ON DELETE SET NULL,
  -- Who we wait on, by name. Empty: the kind's own (the supplier, the customer, the city, the utility).
  who text NOT NULL DEFAULT '',
  asked_on date,
  expected_on date NOT NULL,
  shipped_on date,
  done_on date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_schedule_waits_shipped_delivery CHECK (shipped_on IS NULL OR kind = 'delivery'),
  -- So the bars it holds are bars of one job (gc_schedule_wait_holds).
  CONSTRAINT gc_schedule_waits_in_project UNIQUE (project_id, id)
);

COMMENT ON TABLE public.gc_schedule_waits IS
  'GC mode (v2.NNNN): something a GC project''s work waits on from outside the trades (ScheduleWait, G-73 to G-75): a delivery, a decision the customer owes, a permit or the utility''s work, with who, when asked, expected, shipped (a delivery) and done. The bars it holds are gc_schedule_wait_holds.';

CREATE INDEX IF NOT EXISTS gc_schedule_waits_package_idx ON public.gc_schedule_waits (package_id) WHERE package_id IS NOT NULL;

-- The bars a wait holds until it is in (ScheduleWait.lineIds). Both ends are of one job.
CREATE TABLE IF NOT EXISTS public.gc_schedule_wait_holds (
  project_id uuid NOT NULL,
  wait_id uuid NOT NULL,
  activity_id uuid NOT NULL,
  PRIMARY KEY (wait_id, activity_id),
  CONSTRAINT gc_schedule_wait_holds_wait_fkey FOREIGN KEY (project_id, wait_id)
    REFERENCES public.gc_schedule_waits(project_id, id) ON DELETE CASCADE,
  CONSTRAINT gc_schedule_wait_holds_bar_fkey FOREIGN KEY (project_id, activity_id)
    REFERENCES public.gc_schedule_activities(project_id, id) ON DELETE CASCADE
);

COMMENT ON TABLE public.gc_schedule_wait_holds IS
  'GC mode (v2.NNNN): a bar a wait holds until it is in (ScheduleWait.lineIds). Both are of one job.';

CREATE INDEX IF NOT EXISTS gc_schedule_wait_holds_bar_idx ON public.gc_schedule_wait_holds (project_id, activity_id);

-- A trade's own word on its people a day for a week (CrewCount, G-142), from its portal. The
-- newest for a trade and week is the one that counts (crewCountsNow); the ones before stay, so a
-- cut reads. Append only.
CREATE TABLE IF NOT EXISTS public.gc_schedule_crew_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_schedules(project_id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  -- The Board's company record, which gains its foreign key when that table exists.
  company_id uuid NOT NULL,
  -- The Monday of the week.
  week_of date NOT NULL
    CONSTRAINT gc_schedule_crew_counts_monday CHECK (extract(isodow FROM week_of) = 1),
  count integer NOT NULL
    CONSTRAINT gc_schedule_crew_counts_counted CHECK (count >= 0 AND count <= 50),
  said_on date NOT NULL,
  -- Orders two said on one day.
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_schedule_crew_counts IS
  'GC mode (v2.NNNN): a trade''s own word, from its portal, on how many people a day it will have on a GC project in a week (CrewCount, G-142): 0 to 50. The newest for a trade and week counts (crewCountsNow); the ones before stay, so a cut reads. Append only.';

CREATE INDEX IF NOT EXISTS gc_schedule_crew_counts_project_idx ON public.gc_schedule_crew_counts (project_id, package_id, week_of, created_at);

-- The customer's schedule, sent on its own and kept as it went (ScheduleSend, G-94). Append only.
CREATE TABLE IF NOT EXISTS public.gc_schedule_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_schedules(project_id) ON DELETE CASCADE,
  sent_on date NOT NULL,
  sent_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  -- The customer's contact and company, as the letter named them.
  sent_to text NOT NULL,
  subject text NOT NULL
    CONSTRAINT gc_schedule_sends_subject_said CHECK (btrim(subject) <> ''),
  -- The letter as it went, a paragraph a line.
  lines text[] NOT NULL,
  email_send_log_id uuid REFERENCES public.email_send_log(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_schedule_sends IS
  'GC mode (v2.NNNN): the customer''s schedule for a GC project, sent on its own (ScheduleSend, G-94): when, who, to whom, the subject and the letter as it went, and the email it went in. Append only.';

CREATE INDEX IF NOT EXISTS gc_schedule_sends_project_idx ON public.gc_schedule_sends (project_id, created_at);

-- Who sees them (decision 4): dev only while it is built. One policy a table, for every verb, the
-- check made once a statement. The schedule's PR 10 swaps each for the job's team.
ALTER TABLE public.gc_schedule_late_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_walks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_move_pushes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_move_tells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_move_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_lookahead_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_waits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_wait_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_crew_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_schedule_late_notices_dev ON public.gc_schedule_late_notices;
CREATE POLICY gc_schedule_late_notices_dev ON public.gc_schedule_late_notices FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_walks_dev ON public.gc_schedule_walks;
CREATE POLICY gc_schedule_walks_dev ON public.gc_schedule_walks FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_moves_dev ON public.gc_schedule_moves;
CREATE POLICY gc_schedule_moves_dev ON public.gc_schedule_moves FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_move_pushes_dev ON public.gc_schedule_move_pushes;
CREATE POLICY gc_schedule_move_pushes_dev ON public.gc_schedule_move_pushes FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_move_tells_dev ON public.gc_schedule_move_tells;
CREATE POLICY gc_schedule_move_tells_dev ON public.gc_schedule_move_tells FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_move_answers_dev ON public.gc_schedule_move_answers;
CREATE POLICY gc_schedule_move_answers_dev ON public.gc_schedule_move_answers FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_lookahead_marks_dev ON public.gc_schedule_lookahead_marks;
CREATE POLICY gc_schedule_lookahead_marks_dev ON public.gc_schedule_lookahead_marks FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_waits_dev ON public.gc_schedule_waits;
CREATE POLICY gc_schedule_waits_dev ON public.gc_schedule_waits FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_wait_holds_dev ON public.gc_schedule_wait_holds;
CREATE POLICY gc_schedule_wait_holds_dev ON public.gc_schedule_wait_holds FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_crew_counts_dev ON public.gc_schedule_crew_counts;
CREATE POLICY gc_schedule_crew_counts_dev ON public.gc_schedule_crew_counts FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_sends_dev ON public.gc_schedule_sends;
CREATE POLICY gc_schedule_sends_dev ON public.gc_schedule_sends FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));

-- Nobody signed out reaches them.
REVOKE ALL ON TABLE public.gc_schedule_late_notices, public.gc_schedule_walks, public.gc_schedule_moves,
  public.gc_schedule_move_pushes, public.gc_schedule_move_tells, public.gc_schedule_move_answers,
  public.gc_schedule_lookahead_marks, public.gc_schedule_waits, public.gc_schedule_wait_holds,
  public.gc_schedule_crew_counts, public.gc_schedule_sends FROM anon;

-- The records that never change once kept: no update, delete or truncate. Two doors stay: Undo's
-- pair on a move, and the office's push back on a late notice. The company's kept_on comes through
-- its portal's function, with the service role. A row still goes with its schedule, its bar or its
-- move, by cascade, which runs as the table's owner.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.gc_schedule_moves, public.gc_schedule_move_pushes,
  public.gc_schedule_move_tells, public.gc_schedule_move_answers, public.gc_schedule_late_notices,
  public.gc_schedule_walks, public.gc_schedule_crew_counts, public.gc_schedule_sends FROM authenticated;
GRANT UPDATE (undone_on, undone_by) ON TABLE public.gc_schedule_moves TO authenticated;
GRANT UPDATE (pushed_back_on, pushed_back_by, pushed_back_note) ON TABLE public.gc_schedule_late_notices TO authenticated;

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
```

## The migration doc as it will be

````markdown
# <stamp>_gc_schedule_moves_records.sql (2026-10-07, v2.NNNN)

GC mode, the real build, the schedule's PR 3: moves and the records as tables, from the prototype's model (`to-dos/gc-mode/SCHEDULE_REAL_BUILD.md` → *The tables*, on branch `spike/gc-mode`), after PR 2's `<PR 2's stamp>_gc_schedule_tables.sql`. Eleven tables. Nothing reads or writes them yet: the RPCs are the schedule's PR 5, and the trades' writes come through their portal's function in PR 14.

- **`gc_schedule_moves`**, one row per move.
  - The bar (`activity_id`, set null if the bar is removed) and its name that day (`activity_name`).
  - Who and when: `made_on`, `made_at`, `made_by` and `made_by_name`.
  - The dates before and after, the `reason` (one of twelve) and the `note` (never blank).
  - `links_changed`, and `finish_from` and `finish_to`.
  - Undo's pair, `undone_on` and `undone_by`.
  - What kind of move it was: `change_order_id` (its key comes with Owner Billing), `late_notice_id`, `pull_finished`, the `recovery_*` columns, `from_what_if_on` and `parts`.
  - `schedule_version`, keyed (deferred) to its line in `gc_schedule_changes`.
- **`gc_schedule_move_pushes`**: what each move pushed, with its dates before and after.
- **`gc_schedule_move_tells`** and **`gc_schedule_move_answers`**: the companies told of a move, with what the message showed and its email, and each one's answer. There is one answer per company, and only from a company told.
- **`gc_schedule_walks`**: one per weekly walk, recorded at its end. It holds the bars `kept`, the `move_ids` made during it, `skipped` and `kept_early`.
- **`gc_schedule_lookahead_marks`**: a bar's done or not done for a week (a Monday). It records who marked it (a company, or our own crew) and our superintendent's check, and there is one per bar and week.
- **`gc_schedule_waits`** and **`gc_schedule_wait_holds`**: what the work waits on from outside the trades, and the bars each holds. Both ends are of one job.
- **`gc_schedule_late_notices`**: a trade's late notice, with the office's push back and the company's kept day. Its bar is of the same job.
- **`gc_schedule_crew_counts`**: a trade's people a day for a week, 0 to 50. The newest counts.
- **`gc_schedule_sends`**: the customer's schedule as it was sent.

**Append only:** moves, their pushes, tells and answers, walks, late notices, crew counts and sends. `authenticated` has no UPDATE, DELETE or TRUNCATE on them, except two column grants: `UPDATE (undone_on, undone_by)` on moves, which Undo sets and Redo clears, and `UPDATE (pushed_back_on, pushed_back_by, pushed_back_note)` on late notices, for the office's push back. A notice's `kept_on` is the company's, from its portal's function with the service role. Marks, waits and wait holds change as the prototype changes them.

RLS: each table has one `FOR ALL` policy for `(SELECT public.is_dev())`, dev only while it is built (decision 4). The schedule's PR 10 opens them to the job's team. `anon` has no privilege on them.

It ends with `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()` and `apply_digital_twin_write_blocks()`.

Apply order: after PR 2's migration, whose `gc_schedules`, `gc_schedule_activities` and `gc_schedule_changes` these reference. No screen reads them until the schedule's PR 7. It is additive and idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`). Each foreign key takes a short lock on the table it names: PR 2's three, `gc_trade_packages`, `email_send_log` and `users`. In a busy moment the push stops at the 3-second lock timeout; run it again later.

## Verify after the push

1. **Each table is there, with RLS on, its own policy and the house rules.** This is PR 2's query, with these eleven names in its `IN (...)` list. Expect eleven rows. Each should read: `rls_on` true, `dev_policy` 1, `read_only_blocks` 3, `twin_fences` 3 and `stmt_trigger` 1.

2. **Each is empty.** This is PR 2's count query, with these eleven tables. Expect zeros.

3. **A read-only user's insert is refused.** Run it as PR 2's step 3. The statement trigger refuses before any row or key is looked at, so the made-up schedule id is fine:

   ```sql
   BEGIN;
   SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
     FROM public.users WHERE read_only LIMIT 1;
   SET LOCAL ROLE authenticated;
   INSERT INTO public.gc_schedule_sends (project_id, sent_on, sent_to, subject, lines)
     VALUES (gen_random_uuid(), DATE '2026-10-07', 'A check', 'A check, rolled back', '{}');
   ROLLBACK;
   ```

   Expect `ERROR: Read-only (training) mode: changes are blocked.`

4. **The records stay as they were kept, even for a dev, but for their two doors.** Each line runs in its own transaction as a dev who is not read-only. Use PR 2's step 4 opening, then the statement, then `ROLLBACK`.
   - `DELETE FROM public.gc_schedule_moves;` gives `ERROR: permission denied for table gc_schedule_moves`. This is the build doc's own check.
   - `UPDATE public.gc_schedule_moves SET note = note;` is refused the same way.
   - `UPDATE public.gc_schedule_moves SET undone_on = undone_on;` gives `UPDATE 0`: Undo's door is open.
   - `UPDATE public.gc_schedule_late_notices SET kept_on = kept_on;` gives `permission denied`: the kept day is the company's.
   - `UPDATE public.gc_schedule_late_notices SET pushed_back_on = pushed_back_on;` gives `UPDATE 0`.
   - `DELETE FROM public.gc_schedule_crew_counts;` gives `permission denied`.
   - `DELETE FROM public.gc_schedule_waits;` gives `DELETE 0`: a wait can be taken off.

5. **Nobody signed out reaches them.** Run `BEGIN; SET LOCAL ROLE anon; SELECT count(*) FROM public.gc_schedule_moves; ROLLBACK;` and expect `ERROR: permission denied for table gc_schedule_moves`.

Then `npm run check:migration-drift`, and the types PR (`npm run gen-types:linked`).

## Rollback

Nothing reads these tables yet. Going back is a new migration that drops them with `DROP TABLE IF EXISTS`, in this order: `gc_schedule_sends`, `gc_schedule_crew_counts`, `gc_schedule_wait_holds`, `gc_schedule_waits`, `gc_schedule_lookahead_marks`, `gc_schedule_move_answers`, `gc_schedule_move_tells`, `gc_schedule_move_pushes`, `gc_schedule_moves`, `gc_schedule_walks`, `gc_schedule_late_notices`.

## Status

Written 2026-10-07 for the schedule's PR 3; not applied. The lead pushes it after PR 2's, and records here what steps 1 to 5 said.
````

## Drift from `SCHEDULE_REAL_BUILD.md`'s table section

These are what the SQL above does that *The tables* does not say, or says another way. PR 3's own commit on the spike amends *The tables* to match, line by line, once the lead agrees.

- **The append-only list** (call 1). *The tables* names moves (with Undo's pair) and crew counts.
  It now also names the pushes, tells, answers, walks, late notices (with the office's push back)
  and sends. Marks, waits and holds stay editable.
- **Walks keep their moves' ids** (`move_ids`), and moves have no `walk_id` (call 2).
- **`company_id` for the Board's company record**, in place of `partner_id` (call 3). That covers
  tells, answers, late notices, crew counts and `marked_by_company_id`.
- **A move's version is keyed to its words** (call 4), with a deferred foreign key to
  `gc_schedule_changes`.
- **Keys that keep a record on one job:**
  - a late notice's bar is `(project_id, activity_id)`;
  - a wait hold's two ends are `(project_id, wait_id)` and `(project_id, activity_id)`, which a
    unique (`project_id`, `id`) on the waits allows;
  - an answer is keyed to its tell `(move_id, company_id)`, so only a company told can answer.
- **Who did it is a user id**, with the name read from `users`: a walk's `walked_by`, a send's
  `sent_by`, a push back's `pushed_back_by`, a mark's `marked_by` and `verified_by`, and a move's
  `undone_by`. The prototype keeps a name. A move also keeps `made_by_name`, as *The tables* says.
  A late notice's `sent_by` stays a name, since it is the company's contact, not our user.
- **Checks *The tables* leaves unsaid:**
  - every pair of dates in order;
  - the move reasons are the twelve, and the look-ahead reasons the five;
  - a note is never blank;
  - a push back is whole, and a kept day comes only after one;
  - Undo's pair is together;
  - a week is a Monday;
  - a done mark has no reason, a mark has one marker, its check's columns are together, and a
    corrected reason only goes with not done;
  - an answer that says the dates work asks no other day;
  - a crew count is 0 to 50 (`CREW_MAX`);
  - only a delivery ships;
  - a walk that looked at nothing is refused.

  Each follows what the prototype's reducer already refuses.
- **`created_at` on the records**, which orders two kept on one day: the newest crew count counts,
  and the newest notice replaces the one before.
- **`gc_schedule_move_tells.shown` defaults to `'[]'`**, and **`gc_schedule_waits.who` to `''`**.
  The prototype reads an empty `who` as the kind's own: the supplier, the customer, the city, the
  utility.

## The check

- **Before the merge (CI):** `scripts/check-migrations.sh` (the lock timeout and unique stamps) and
  `src/lib/releaseNotes.test.ts`.
- **By hand before opening the PR,** as for PR 2, since there is no local Postgres:
  - Read it against PR 2's migration.
  - Grep that every name it references exists on main: PR 2's three tables,
    `gc_trade_packages(id)`, `email_send_log(id)`, `users(id)`, `is_dev()` and the sweeps.
  - Every constraint and index name begins with its own table's name.
- **After the push (the lead):** the doc's *Verify after the push*, steps 1 to 5. Steps 1, 2 and 5
  run from the read seat, and steps 3 and 4 from the app's dev login. Step 4 holds the build doc's
  own check (*a delete from `gc_schedule_moves` is refused*), plus each door open and each other
  update shut.
- **Then** `npm run check:migration-drift` and the types PR.

## When it is cut

1. After #4814 (PR 2) is on main, branch from `origin/main`.
2. Take the next stamp after main's newest and after any claim not yet merged
   (`.claude/sessions/claims/` in the main checkout). Claim it from the PR's own branch:
   `npm run claim -- --migration supabase/migrations/<stamp>_gc_schedule_moves_records.sql`.
3. Claim the version with `npm run claim -- --branch <branch>`. Fill it into the twelve `v2.NNNN`
   (the header's and each table's comment) and the doc's first line. Fill in PR 2's stamp where the
   doc names it.
4. Add the migration, its doc, the release note (infra, dev, two bullets) and the fragment.
5. Open the PR with auto-merge, and put the amendment to *The tables* on a spike branch beside it.
   The lead pushes it after PR 2's from a clean checkout and opens the types PR. I never apply it.
