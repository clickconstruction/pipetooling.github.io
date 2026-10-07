SET lock_timeout = '3s';

-- GC mode, the real build, the schedule's PR 3 (v2.4809): moves and the records, from the
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
  'GC mode (v2.4809): a trade''s word, from its portal, that it will be late on its bar (LateNotice, G-117): the company, when, the dates it was sent against and the dates it asks for, why, its words; the office''s push back and the company''s answer that it will make the day. Where it stands is worked out (lateNoticeState). Append only, but the office''s push back (column grants below); the company''s kept_on comes through its portal''s function.';

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
  'GC mode (v2.4809): one weekly walk of a GC project''s schedule (ScheduleWalk, G-52), recorded once at its end: the day, who, the bars kept as drawn, the moves made during it (move_ids), the bars listed and not looked at, and the early finishes answered with Keep the dates. Append only.';

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
  'GC mode (v2.4809): one move on a GC project''s schedule (ScheduleMove): the bar and its name that day, who and when, its dates before and after, the reason and the words, what it did to the job''s finish, the version it made (its words in gc_schedule_changes), and what kind of move it was (a change order''s days, a late notice taken, a pull, days got back, a what-if kept, a part''s own move). Append only, but Undo''s pair: authenticated may update undone_on and undone_by and nothing else, and never delete.';

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
  'GC mode (v2.4809): a bar that came after a move and moved with it (ScheduleMove.pushed), with its dates before and after. Undo and Redo put it back. Append only.';

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
  'GC mode (v2.4809): a company told that a move changed its dates (G-132): when, what the message showed (each of its bars with the new dates) and the email it went in. One per move and company. Append only.';

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
  'GC mode (v2.4809): a company''s answer, from its portal, to a move it was told of: the dates work (ok), or another day asked for with its words (G-113). One per company, and only from a company told (the key to gc_schedule_move_tells). Append only.';

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
  'GC mode (v2.4809): a bar''s done or not done for a week of the look-ahead (LookAheadMark): the mark and why, who marked it (a company from its portal, or our own crew), and our superintendent''s check with any correction. A trade''s mark changes until it is checked. One per bar and week.';

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
  'GC mode (v2.4809): something a GC project''s work waits on from outside the trades (ScheduleWait, G-73 to G-75): a delivery, a decision the customer owes, a permit or the utility''s work, with who, when asked, expected, shipped (a delivery) and done. The bars it holds are gc_schedule_wait_holds.';

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
  'GC mode (v2.4809): a bar a wait holds until it is in (ScheduleWait.lineIds). Both are of one job.';

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
  'GC mode (v2.4809): a trade''s own word, from its portal, on how many people a day it will have on a GC project in a week (CrewCount, G-142): 0 to 50. The newest for a trade and week counts (crewCountsNow); the ones before stay, so a cut reads. Append only.';

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
  'GC mode (v2.4809): the customer''s schedule for a GC project, sent on its own (ScheduleSend, G-94): when, who, to whom, the subject and the letter as it went, and the email it went in. Append only.';

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
