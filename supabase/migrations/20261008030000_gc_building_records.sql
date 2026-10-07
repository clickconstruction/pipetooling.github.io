SET lock_timeout = '3s';

-- GC mode, the real build, the Building lane's U1 (v2.4827): the job's records while we build, from
-- the prototype's model (to-dos/gc-mode/BUILDING_REAL_BUILD.md on branch spike/gc-mode, "The
-- tables": U1). The superintendent's daily log with the crews on site and what held work up, the
-- punch list, the submittal register with the work each holds and each time it was sent, the
-- questions during construction (RFIs) with the work each holds, and the weekly report to the
-- customer as it went. Who sees them: dev only while it is built (decision 4); Building's door PR
-- opens them to the job's team. Nothing reads or writes these yet: the writes are U3 to U5, the
-- mapper U3.
--
-- Inspections are not here: they are the schedule's bars and failures (20261007210000), read by
-- Building and never made again (decision 1).
--
-- Push order: after B1's 20261008020000_gc_company_record, which makes gc_companies. gc_rfis names
-- it. The lead pushes the two in the same batch, B1 first.

-- The superintendent's log for one day on a job being built (DailyLog). One a day: saving again
-- replaces that day's crews and delays (U3's gc_save_daily_log).
CREATE TABLE IF NOT EXISTS public.gc_daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  log_date date NOT NULL,
  sky text NOT NULL
    CONSTRAINT gc_daily_logs_sky_known CHECK (sky IN ('clear', 'cloudy', 'rain', 'storm', 'wind')),
  -- Degrees Fahrenheit.
  high integer NOT NULL,
  low integer NOT NULL,
  -- Work stopped for the weather (G-58 counts the day lost).
  weather_stop boolean NOT NULL DEFAULT false,
  -- What got done, and inspections and visitors, in the superintendent's words.
  done text NOT NULL DEFAULT '',
  visitors text NOT NULL DEFAULT '',
  -- A link to the day's photos in the job's Drive folder (decision 6). Never a copy.
  photos_url text,
  -- The company day it was written, as the writer gives it (never the server's date). Later than
  -- log_date: caught up after the day.
  written_on date NOT NULL,
  written_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_daily_logs_written_after CHECK (written_on >= log_date),
  CONSTRAINT gc_daily_logs_photos_linked CHECK (photos_url IS NULL OR btrim(photos_url) <> ''),
  CONSTRAINT gc_daily_logs_one_a_day UNIQUE (project_id, log_date)
);

COMMENT ON TABLE public.gc_daily_logs IS
  'GC mode (v2.4827): the superintendent''s daily log on a GC project being built (DailyLog), one a day: the weather and whether work stopped for it, what got done, inspections and visitors, a Drive link to the day''s photos, and who wrote it on what day. Its crews are gc_daily_log_crews, what held work up gc_daily_log_delays. Read by nothing yet: U3 writes it (to-dos/gc-mode/BUILDING_REAL_BUILD.md).';

-- Each trade on site that day and how many workers (DailyLog.crews). A trade not listed was not
-- there. The schedule's readers (G-57, G-58, G-60, G-84) count them by trade (decision 8).
CREATE TABLE IF NOT EXISTS public.gc_daily_log_crews (
  log_id uuid NOT NULL REFERENCES public.gc_daily_logs(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  workers integer NOT NULL
    CONSTRAINT gc_daily_log_crews_workers_counted CHECK (workers >= 1),
  PRIMARY KEY (log_id, package_id)
);

COMMENT ON TABLE public.gc_daily_log_crews IS
  'GC mode (v2.4827): each trade on site on a daily log''s day and how many workers (DailyLog.crews). A trade not listed was not there.';

CREATE INDEX IF NOT EXISTS gc_daily_log_crews_package_idx ON public.gc_daily_log_crews (package_id);

-- What held work up that day (DailyLog.delays): whose (null: the job's own), one of the look-ahead's
-- five reasons, and a note.
CREATE TABLE IF NOT EXISTS public.gc_daily_log_delays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES public.gc_daily_logs(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  package_id uuid REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  reason text NOT NULL
    CONSTRAINT gc_daily_log_delays_reason_known CHECK (reason IN ('weather', 'trade before', 'materials', 'crew', 'other')),
  note text NOT NULL DEFAULT ''
);

COMMENT ON TABLE public.gc_daily_log_delays IS
  'GC mode (v2.4827): what held work up on a daily log''s day (DailyLog.delays): whose (package_id, null for the job''s own), the reason (the look-ahead''s five) and a note.';

CREATE INDEX IF NOT EXISTS gc_daily_log_delays_log_idx ON public.gc_daily_log_delays (log_id, position);
CREATE INDEX IF NOT EXISTS gc_daily_log_delays_package_idx ON public.gc_daily_log_delays (package_id) WHERE package_id IS NOT NULL;

-- One punch-list item (PunchItem): something left to fix on a trade's work. The trade marks it fixed
-- in its portal (U3's gc_trade_punch_fixed); our superintendent checks it, or sends it back with a
-- note. A trade's work is accepted once every item on it is checked fixed.
CREATE TABLE IF NOT EXISTS public.gc_punch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  -- What is wrong, as our superintendent wrote it.
  text text NOT NULL
    CONSTRAINT gc_punch_items_said CHECK (btrim(text) <> ''),
  -- Where on the job: a room, a grid line (PunchItem.where).
  where_on text,
  -- A link to a photo in the job's Drive folder (decision 6).
  photo_url text,
  added_on date NOT NULL,
  added_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  -- The trade's word that it is fixed. Null: still open.
  fixed_on date,
  -- Our superintendent's check. Null: not checked yet.
  checked_on date,
  checked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- Checked and not fixed: sent back to the trade, how many times, with the last note (PunchItem.sentBack).
  sent_back_times integer NOT NULL DEFAULT 0
    CONSTRAINT gc_punch_items_sent_back_counted CHECK (sent_back_times >= 0),
  sent_back_note text,
  sent_back_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_punch_items_where_said CHECK (where_on IS NULL OR btrim(where_on) <> ''),
  CONSTRAINT gc_punch_items_photo_linked CHECK (photo_url IS NULL OR btrim(photo_url) <> ''),
  CONSTRAINT gc_punch_items_checked_once_fixed CHECK (checked_on IS NULL OR fixed_on IS NOT NULL),
  CONSTRAINT gc_punch_items_days_in_order CHECK (
    (fixed_on IS NULL OR fixed_on >= added_on) AND (checked_on IS NULL OR checked_on >= fixed_on)
  ),
  CONSTRAINT gc_punch_items_sent_back_kept CHECK (
    (sent_back_times = 0 AND sent_back_on IS NULL AND sent_back_note IS NULL)
    OR (sent_back_times > 0 AND sent_back_on IS NOT NULL AND sent_back_note IS NOT NULL)
  )
);

COMMENT ON TABLE public.gc_punch_items IS
  'GC mode (v2.4827): one punch-list item on a trade''s work (PunchItem): what is wrong and where, a photo link, the day it was added, the trade''s word that it is fixed, our superintendent''s check, and how many times it was sent back with the last note.';

CREATE INDEX IF NOT EXISTS gc_punch_items_project_idx ON public.gc_punch_items (project_id, package_id, position);

-- A submittal (Submittal): product data, shop drawings or samples a trade sends for the architect's
-- approval before its work. It holds the lines in gc_submittal_holds until approved, and is needed
-- by the first of their starts less its lead days; with none of them on the schedule, by needed_by.
CREATE TABLE IF NOT EXISTS public.gc_submittals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  -- Its number in the register: the spec section and a count, "26 24 16-01" (nextSubmittalNumber).
  number text NOT NULL
    CONSTRAINT gc_submittals_numbered CHECK (btrim(number) <> ''),
  title text NOT NULL
    CONSTRAINT gc_submittals_titled CHECK (btrim(title) <> ''),
  kind text NOT NULL
    CONSTRAINT gc_submittals_kind_known CHECK (kind IN ('product data', 'shop drawings', 'samples')),
  spec_section text,
  -- Days from approval to the material on site: ordering, making, shipping.
  lead_days integer NOT NULL DEFAULT 0
    CONSTRAINT gc_submittals_lead_days_counted CHECK (lead_days >= 0),
  needed_by date,
  asked_on date NOT NULL,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_submittals_section_said CHECK (spec_section IS NULL OR btrim(spec_section) <> ''),
  CONSTRAINT gc_submittals_number_once UNIQUE (project_id, number)
);

COMMENT ON TABLE public.gc_submittals IS
  'GC mode (v2.4827): a submittal in a GC project''s register (Submittal): its number by spec section, the trade, the title, product data, shop drawings or samples, the lead days from approval to on site, and the day it is needed when none of the work it holds is on the schedule. The work it holds is gc_submittal_holds, each time it was sent gc_submittal_rounds.';

CREATE INDEX IF NOT EXISTS gc_submittals_package_idx ON public.gc_submittals (package_id);

-- The lines a submittal holds until approved (Submittal.lineIds), keyed to the scope line (decision 2).
CREATE TABLE IF NOT EXISTS public.gc_submittal_holds (
  submittal_id uuid NOT NULL REFERENCES public.gc_submittals(id) ON DELETE CASCADE,
  scope_item_id uuid NOT NULL REFERENCES public.gc_scope_items(id) ON DELETE CASCADE,
  PRIMARY KEY (submittal_id, scope_item_id)
);

COMMENT ON TABLE public.gc_submittal_holds IS
  'GC mode (v2.4827): the scope lines a submittal holds until it is approved (Submittal.lineIds). The schedule reads them as holds on those lines'' bars.';

CREATE INDEX IF NOT EXISTS gc_submittal_holds_scope_item_idx ON public.gc_submittal_holds (scope_item_id);

-- One time a trade sent a submittal, and what came of it (SubmittalRound). From its portal, or by
-- email and recorded by the office (decision 6). The newest round says whose move it is.
CREATE TABLE IF NOT EXISTS public.gc_submittal_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id uuid NOT NULL REFERENCES public.gc_submittals(id) ON DELETE CASCADE,
  round integer NOT NULL
    CONSTRAINT gc_submittal_rounds_counted CHECK (round >= 1),
  sent_on date NOT NULL,
  -- trade: from its portal; office: it came by email and we recorded it.
  sent_by text NOT NULL
    CONSTRAINT gc_submittal_rounds_sent_by_known CHECK (sent_by IN ('trade', 'office')),
  recorded_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  -- The file it sent, by name, and its link in Drive (decision 6). Never a copy.
  file_name text NOT NULL
    CONSTRAINT gc_submittal_rounds_file_named CHECK (btrim(file_name) <> ''),
  drive_url text,
  note text NOT NULL DEFAULT '',
  -- The day we sent it to the architect, and that email. Null: with us.
  to_architect_on date,
  email_send_log_id uuid REFERENCES public.email_send_log(id) ON DELETE SET NULL,
  -- The architect's answer. Revise sends it back to the trade for another round.
  answered_on date,
  answer text
    CONSTRAINT gc_submittal_rounds_answer_known CHECK (answer IN ('approved', 'approved as noted', 'revise')),
  answer_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_submittal_rounds_drive_linked CHECK (drive_url IS NULL OR btrim(drive_url) <> ''),
  CONSTRAINT gc_submittal_rounds_answer_dated CHECK ((answer IS NULL) = (answered_on IS NULL)),
  CONSTRAINT gc_submittal_rounds_answered_after_sent CHECK (answer IS NULL OR to_architect_on IS NOT NULL),
  CONSTRAINT gc_submittal_rounds_revise_says_why CHECK (answer IS DISTINCT FROM 'revise' OR btrim(answer_note) <> ''),
  CONSTRAINT gc_submittal_rounds_days_in_order CHECK (
    (to_architect_on IS NULL OR to_architect_on >= sent_on) AND (answered_on IS NULL OR answered_on >= to_architect_on)
  ),
  CONSTRAINT gc_submittal_rounds_once UNIQUE (submittal_id, round)
);

COMMENT ON TABLE public.gc_submittal_rounds IS
  'GC mode (v2.4827): one time a trade sent a submittal (SubmittalRound): from its portal or recorded by the office from an email, the file''s name and Drive link, a note, the day it went to the architect with that email, and the architect''s answer (approved, approved as noted, or revise with what to change).';

-- A question about the plans while we build (Rfi). It holds the lines in gc_rfi_holds until it is
-- answered, and is needed needed_days before the first of them starts. A cost answer starts a change
-- order (U5, which adds change_order_id once Owner Billing's gc_change_orders is on main).
CREATE TABLE IF NOT EXISTS public.gc_rfis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  -- RFI-001, RFI-002… on the job.
  number integer NOT NULL
    CONSTRAINT gc_rfis_numbered CHECK (number >= 1),
  question text NOT NULL
    CONSTRAINT gc_rfis_asked CHECK (btrim(question) <> ''),
  sheets text[] NOT NULL DEFAULT '{}',
  -- The trade it is about: a cost answer's change order goes on it. Null: our own work.
  package_id uuid REFERENCES public.gc_trade_packages(id) ON DELETE SET NULL,
  -- The trade that asked, from its portal or by phone (Rfi.partnerId). Null: our own people.
  asked_by_company_id uuid REFERENCES public.gc_companies(id) ON DELETE RESTRICT,
  -- Who typed it in. Null: the trade's portal.
  recorded_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  asked_on date NOT NULL,
  -- The answer is needed this many days before the first held work starts (RFI_NEEDED_DAYS).
  needed_days integer NOT NULL DEFAULT 3
    CONSTRAINT gc_rfis_needed_days_counted CHECK (needed_days >= 0),
  -- The day we sent it to the architect, and that email. Null: with us.
  sent_to_architect_on date,
  email_send_log_id uuid REFERENCES public.email_send_log(id) ON DELETE SET NULL,
  -- The answer (Rfi.answer): the day, its words, by the architect or by us, and what it changes.
  answered_on date,
  answer_text text,
  answered_by text
    CONSTRAINT gc_rfis_answered_by_known CHECK (answered_by IN ('architect', 'us')),
  impact text
    CONSTRAINT gc_rfis_impact_known CHECK (impact IN ('none', 'plans', 'cost')),
  cost numeric NOT NULL DEFAULT 0
    CONSTRAINT gc_rfis_cost_counted CHECK (cost >= 0),
  days integer NOT NULL DEFAULT 0
    CONSTRAINT gc_rfis_days_counted CHECK (days >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_rfis_answer_whole CHECK (
    (answered_on IS NULL) = (answer_text IS NULL)
    AND (answered_on IS NULL) = (answered_by IS NULL)
    AND (answered_on IS NULL) = (impact IS NULL)
  ),
  CONSTRAINT gc_rfis_answer_said CHECK (answer_text IS NULL OR btrim(answer_text) <> ''),
  -- The architect answers only what was sent to them; we can answer our own any time.
  CONSTRAINT gc_rfis_architect_was_asked CHECK (answered_by IS DISTINCT FROM 'architect' OR sent_to_architect_on IS NOT NULL),
  -- A cost answer has a cost or days; any other answer has neither.
  CONSTRAINT gc_rfis_cost_answer CHECK (
    CASE WHEN impact = 'cost' THEN cost > 0 OR days > 0 ELSE cost = 0 AND days = 0 END
  ),
  CONSTRAINT gc_rfis_days_in_order CHECK (
    (sent_to_architect_on IS NULL OR sent_to_architect_on >= asked_on) AND (answered_on IS NULL OR answered_on >= asked_on)
  ),
  CONSTRAINT gc_rfis_number_once UNIQUE (project_id, number)
);

COMMENT ON TABLE public.gc_rfis IS
  'GC mode (v2.4827): a question about the plans while a GC project is built (Rfi; the owner, 2026-10-05): its number on the job, the question and sheets, the trade it is about, the company that asked (null: our own people), the days before the held work it is needed, the day it went to the architect, and the answer with what it changes (nothing, the plans, or cost and days). The work it holds is gc_rfi_holds. U5 adds the change order a cost answer starts.';

CREATE INDEX IF NOT EXISTS gc_rfis_package_idx ON public.gc_rfis (package_id) WHERE package_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gc_rfis_company_idx ON public.gc_rfis (asked_by_company_id) WHERE asked_by_company_id IS NOT NULL;

-- The lines an RFI holds until it is answered (Rfi.holds), keyed to the scope line (decision 2).
CREATE TABLE IF NOT EXISTS public.gc_rfi_holds (
  rfi_id uuid NOT NULL REFERENCES public.gc_rfis(id) ON DELETE CASCADE,
  scope_item_id uuid NOT NULL REFERENCES public.gc_scope_items(id) ON DELETE CASCADE,
  PRIMARY KEY (rfi_id, scope_item_id)
);

COMMENT ON TABLE public.gc_rfi_holds IS
  'GC mode (v2.4827): the scope lines an RFI holds until it is answered (Rfi.holds). The schedule reads them as holds on those lines'' bars.';

CREATE INDEX IF NOT EXISTS gc_rfi_holds_scope_item_idx ON public.gc_rfi_holds (scope_item_id);

-- The weekly report to the customer as it went (WeeklyReportSent), every send kept. The newest for a
-- week is the one their portal shows (latestWeeklyReports). Append only.
CREATE TABLE IF NOT EXISTS public.gc_weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  -- The Monday of the week it covers.
  week_of date NOT NULL
    CONSTRAINT gc_weekly_reports_week_is_monday CHECK (extract(isodow FROM week_of) = 1),
  sent_on date NOT NULL,
  -- me: from my own mail, the draft filled in; company: from the company through Resend.
  sent_from text NOT NULL
    CONSTRAINT gc_weekly_reports_from_known CHECK (sent_from IN ('me', 'company')),
  sent_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  -- Who sent it, as the name read that day.
  by_name text NOT NULL
    CONSTRAINT gc_weekly_reports_by_named CHECK (btrim(by_name) <> ''),
  -- Who it went to: the customer's contact and company.
  to_words text NOT NULL,
  copied_architect boolean NOT NULL DEFAULT false,
  subject text NOT NULL
    CONSTRAINT gc_weekly_reports_subject_said CHECK (btrim(subject) <> ''),
  body text NOT NULL
    CONSTRAINT gc_weekly_reports_body_said CHECK (btrim(body) <> ''),
  -- The email a send from the company went as.
  email_send_log_id uuid REFERENCES public.email_send_log(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_weekly_reports_sent_in_or_after_week CHECK (sent_on >= week_of)
);

COMMENT ON TABLE public.gc_weekly_reports IS
  'GC mode (v2.4827): the weekly report to a GC project''s customer as it went (WeeklyReportSent): the week, the day, from me or from the company, who sent it and to whom, whether the architect was copied, the subject and the body as written. Every send is kept; the newest for a week is the one their portal shows. Append only.';

CREATE INDEX IF NOT EXISTS gc_weekly_reports_project_idx ON public.gc_weekly_reports (project_id, week_of, created_at);

-- Who sees them: dev only while it is built (decision 4). One policy a table; the wrap asks once a
-- statement, not once a row. Building's door PR swaps these for the job's team.
ALTER TABLE public.gc_daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_daily_log_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_daily_log_delays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_punch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_submittals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_submittal_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_submittal_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_rfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_rfi_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_weekly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_daily_logs_dev ON public.gc_daily_logs;
CREATE POLICY gc_daily_logs_dev ON public.gc_daily_logs FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_daily_log_crews_dev ON public.gc_daily_log_crews;
CREATE POLICY gc_daily_log_crews_dev ON public.gc_daily_log_crews FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_daily_log_delays_dev ON public.gc_daily_log_delays;
CREATE POLICY gc_daily_log_delays_dev ON public.gc_daily_log_delays FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_punch_items_dev ON public.gc_punch_items;
CREATE POLICY gc_punch_items_dev ON public.gc_punch_items FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_submittals_dev ON public.gc_submittals;
CREATE POLICY gc_submittals_dev ON public.gc_submittals FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_submittal_holds_dev ON public.gc_submittal_holds;
CREATE POLICY gc_submittal_holds_dev ON public.gc_submittal_holds FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_submittal_rounds_dev ON public.gc_submittal_rounds;
CREATE POLICY gc_submittal_rounds_dev ON public.gc_submittal_rounds FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_rfis_dev ON public.gc_rfis;
CREATE POLICY gc_rfis_dev ON public.gc_rfis FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_rfi_holds_dev ON public.gc_rfi_holds;
CREATE POLICY gc_rfi_holds_dev ON public.gc_rfi_holds FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_weekly_reports_dev ON public.gc_weekly_reports;
CREATE POLICY gc_weekly_reports_dev ON public.gc_weekly_reports FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));

-- Nobody signed out reaches them, and a weekly report stays as it went.
REVOKE ALL ON TABLE public.gc_daily_logs, public.gc_daily_log_crews, public.gc_daily_log_delays,
  public.gc_punch_items, public.gc_submittals, public.gc_submittal_holds, public.gc_submittal_rounds,
  public.gc_rfis, public.gc_rfi_holds, public.gc_weekly_reports FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.gc_weekly_reports FROM authenticated;

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
