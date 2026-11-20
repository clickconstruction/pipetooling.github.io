SET lock_timeout = '3s';

-- Before we start (punch list #382, PR 3: the table). For each stage line the office writes a short list of things
-- that must be true before the crew goes. A bullet waits on them (the GC, the customer) or on us. A yes on a bullet
-- on them says how we know: their word, their photo, or one of ours saw it. Every ask is kept, every day they give
-- for ready is kept, the decision to send the crew is a press with a name on it, and what the crew found on arrival
-- is kept. Nothing here blocks a schedule, a clock-in or a bill.
--
-- Eight tables:
--   start_check_templates    the company's lists, one a stage kind (Rough In, Top Out, Trim Set): a starter a stage copies
--   start_check_bullets      a stage line's bullets
--   start_check_marks        a yes on a bullet on them, and its take-back
--   start_check_asks         every ask, a row a bullet, and a hold note sent
--   start_check_their_days   every day they gave for ready
--   start_check_decisions    Go and Hold, with who pressed it and what was open then
--   start_check_arrivals     what the crew found on arrival
--   start_check_settings     the days of notice a site or a lone job needs, and a job's switch for the GC's page
--
-- Who:
--   the desk       start_checks_desk(job): the office (dev, master_technician, assistant, controller), an estimator or a
--                  primary with a claim on the job (is_job_people), and a superintendent on their own job. It reads and
--                  writes a job's list.
--   the decision   start_checks_may_decide(job): the office and the job's superintendent. Go and Hold go through
--                  start_check_decide, which keeps the name itself.
--   the crew       start_checks_crew(job): on the job's team, clocked in on it, or a sub who reads it. It reads the
--                  bullets on them and their yeses, for the look on arrival. It writes nothing here yet.
--   A primary reads no job's list beyond is_job_people. A job shut by its papers is shut here too.
--   start_check_windows reads our days for the desk, since a primary reads no stage window by the table's own policy.
--   The GC's page writes with the service role, in the release that shows it. anon holds no grant.
--
-- Additive and idempotent. Nothing in the app reads these tables until the client that follows.

-- ---------- 1 · Who ----------

CREATE OR REPLACE FUNCTION public.start_checks_desk(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
     AND p_job_id IS NOT NULL
     AND (
       public.is_job_people(p_job_id)
       OR (public.is_superintendent() AND public.superintendent_report_job_anchor_allowed(p_job_id))
     )
     AND NOT public.job_shut_to_me(p_job_id);
$$;
COMMENT ON FUNCTION public.start_checks_desk(uuid) IS 'Before we start (#382): who reads and writes a job''s list. The office, an estimator or a primary with a claim on the job (is_job_people), and a superintendent on their own job. Never a job shut by its papers. Change the audience here, never in a policy.';
REVOKE EXECUTE ON FUNCTION public.start_checks_desk(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_checks_desk(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.start_checks_may_decide(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
     AND p_job_id IS NOT NULL
     AND (
       public.is_office_staff()
       OR (public.is_superintendent() AND public.superintendent_report_job_anchor_allowed(p_job_id))
     )
     AND NOT public.job_shut_to_me(p_job_id);
$$;
COMMENT ON FUNCTION public.start_checks_may_decide(uuid) IS 'Before we start (#382): who may press Go or Hold on a job''s stage. The office and the job''s superintendent (the owner''s call 3, on its default).';
REVOKE EXECUTE ON FUNCTION public.start_checks_may_decide(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_checks_may_decide(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.start_checks_crew(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
     AND p_job_id IS NOT NULL
     AND NOT public.is_primary()
     AND (
       EXISTS (SELECT 1 FROM public.jobs_ledger_team_members m WHERE m.job_id = p_job_id AND m.user_id = (SELECT auth.uid()))
       OR EXISTS (SELECT 1 FROM public.clock_sessions cs WHERE cs.job_ledger_id = p_job_id AND cs.user_id = (SELECT auth.uid()))
       OR public.subcontractor_can_read_jobs_ledger_row(p_job_id)
     )
     AND NOT public.job_shut_to_me(p_job_id);
$$;
COMMENT ON FUNCTION public.start_checks_crew(uuid) IS 'Before we start (#382): the crew on a job, for the look on arrival. On the job''s team, clocked in on it, or a sub who reads it. A primary is held to is_job_people and is never crew here.';
REVOKE EXECUTE ON FUNCTION public.start_checks_crew(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_checks_crew(uuid) TO authenticated, service_role;

-- ---------- 2 · The tables ----------

CREATE TABLE IF NOT EXISTS public.start_check_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_kind text NOT NULL CHECK (stage_kind IN ('rough_in', 'top_out', 'trim_set')),
  sort_order integer NOT NULL DEFAULT 0,
  words text NOT NULL CHECK (char_length(btrim(words)) BETWEEN 1 AND 300),
  waits_on text NOT NULL CHECK (waits_on IN ('them', 'us')),
  wants_photo boolean NOT NULL DEFAULT false,
  reads text CHECK (reads IN ('order_log', 'trip', 'permit', 'hand')),
  retired_at timestamptz,
  retired_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_name text NOT NULL DEFAULT '' CHECK (char_length(created_by_name) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT start_check_templates_ours_reads CHECK ((waits_on = 'us') = (reads IS NOT NULL)),
  CONSTRAINT start_check_templates_photo_is_theirs CHECK (waits_on = 'them' OR NOT wants_photo)
);
COMMENT ON TABLE public.start_check_templates IS 'Before we start (#382): the company''s lists, one a stage kind. A stage with no list is offered its kind''s list as a starter and copies it into start_check_bullets. A change here changes no stage that already has its list.';
COMMENT ON COLUMN public.start_check_templates.waits_on IS 'them (the GC, the customer) or us.';
COMMENT ON COLUMN public.start_check_templates.wants_photo IS 'On them only: their word alone leaves the bullet open.';
COMMENT ON COLUMN public.start_check_templates.reads IS 'On us only: where the app reads it from. order_log, trip, permit, or hand for one a person of ours ticks.';
CREATE INDEX IF NOT EXISTS start_check_templates_kind_idx ON public.start_check_templates (stage_kind, sort_order) WHERE retired_at IS NULL;

CREATE TABLE IF NOT EXISTS public.start_check_bullets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  fixture_id uuid NOT NULL REFERENCES public.jobs_ledger_fixtures(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  words text NOT NULL CHECK (char_length(btrim(words)) BETWEEN 1 AND 300),
  waits_on text NOT NULL CHECK (waits_on IN ('them', 'us')),
  wants_photo boolean NOT NULL DEFAULT false,
  shown_to_gc boolean NOT NULL DEFAULT false,
  by_day date,
  reads text CHECK (reads IN ('order_log', 'trip', 'permit', 'hand')),
  hand_ok boolean NOT NULL DEFAULT false,
  hand_ok_at timestamptz,
  hand_ok_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  hand_ok_by_name text NOT NULL DEFAULT '' CHECK (char_length(hand_ok_by_name) <= 120),
  template_id uuid REFERENCES public.start_check_templates(id) ON DELETE SET NULL,
  removed_at timestamptz,
  removed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_name text NOT NULL DEFAULT '' CHECK (char_length(created_by_name) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT start_check_bullets_ours_reads CHECK ((waits_on = 'us') = (reads IS NOT NULL)),
  CONSTRAINT start_check_bullets_ours_is_ours CHECK (waits_on = 'them' OR (NOT wants_photo AND NOT shown_to_gc AND by_day IS NULL)),
  CONSTRAINT start_check_bullets_hand_tick CHECK (NOT hand_ok OR (reads IS NOT NULL AND reads = 'hand'))
);
COMMENT ON TABLE public.start_check_bullets IS 'Before we start (#382): one thing that must be true before a stage line begins. On them it is open until start_check_marks holds a yes. On us it is read from the app and nobody ticks it, unless it reads hand.';
COMMENT ON COLUMN public.start_check_bullets.job_id IS 'The stage line''s job, kept in step by a trigger: a line that moves to another job carries its bullets.';
COMMENT ON COLUMN public.start_check_bullets.wants_photo IS 'On them only: their word alone leaves it open. It needs their photo, or one of ours on site.';
COMMENT ON COLUMN public.start_check_bullets.shown_to_gc IS 'The bullet''s eye. On them only. The GC''s page shows it while the job shares its stage dates and start_check_settings.shows_on_gc_page is on. A bullet of ours is never shown.';
COMMENT ON COLUMN public.start_check_bullets.by_day IS 'On them only: the day they say it will be true, when they gave one.';
COMMENT ON COLUMN public.start_check_bullets.reads IS 'On us only: order_log, trip, permit, or hand.';
COMMENT ON COLUMN public.start_check_bullets.hand_ok IS 'A bullet of ours that reads hand: a person of ours marked it done.';
COMMENT ON COLUMN public.start_check_bullets.removed_at IS 'Taken off the list. The row stays, so an ask and a yes it had are still read.';
CREATE INDEX IF NOT EXISTS start_check_bullets_fixture_idx ON public.start_check_bullets (fixture_id, sort_order) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS start_check_bullets_job_idx ON public.start_check_bullets (job_id);

CREATE TABLE IF NOT EXISTS public.start_check_arrivals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  fixture_id uuid NOT NULL REFERENCES public.jobs_ledger_fixtures(id) ON DELETE CASCADE,
  arrived_on date NOT NULL,
  not_as_told uuid[] NOT NULL DEFAULT '{}'::uuid[],
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  dispatch_request_id uuid REFERENCES public.dispatch_requests(id) ON DELETE SET NULL,
  by_user uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (char_length(by_name) <= 120),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.start_check_arrivals IS 'Before we start (#382): what the crew found on arrival at a stage. not_as_told holds the bullets that were not as told, empty when all were. The crew is clocked in either way.';
COMMENT ON COLUMN public.start_check_arrivals.not_as_told IS 'The ids of the bullets on them that were not as told.';
COMMENT ON COLUMN public.start_check_arrivals.trip_id IS 'The trip the crew was on, when the site is far.';
COMMENT ON COLUMN public.start_check_arrivals.dispatch_request_id IS 'The stage check a No sent to Dispatch.';
CREATE INDEX IF NOT EXISTS start_check_arrivals_fixture_idx ON public.start_check_arrivals (fixture_id, created_at);
CREATE INDEX IF NOT EXISTS start_check_arrivals_job_idx ON public.start_check_arrivals (job_id);

CREATE TABLE IF NOT EXISTS public.start_check_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bullet_id uuid NOT NULL REFERENCES public.start_check_bullets(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  know text NOT NULL CHECK (know IN ('word', 'photo', 'saw')),
  who_name text NOT NULL CHECK (char_length(btrim(who_name)) BETWEEN 1 AND 120),
  how text NOT NULL DEFAULT '' CHECK (char_length(how) <= 80),
  said_on date NOT NULL,
  source text NOT NULL DEFAULT 'office' CHECK (source IN ('office', 'portal', 'crew')),
  arrival_id uuid REFERENCES public.start_check_arrivals(id) ON DELETE SET NULL,
  photo_file_name text CHECK (photo_file_name IS NULL OR char_length(photo_file_name) BETWEEN 1 AND 200),
  photo_taken_at timestamptz,
  photo_bytes integer CHECK (photo_bytes IS NULL OR photo_bytes >= 0),
  photo_storage_path text CHECK (photo_storage_path IS NULL OR char_length(photo_storage_path) <= 300),
  photo_drive_file_id text CHECK (photo_drive_file_id IS NULL OR char_length(photo_drive_file_id) <= 120),
  photo_filed_at timestamptz,
  photo_fail_why text CHECK (photo_fail_why IS NULL OR char_length(photo_fail_why) <= 300),
  by_user uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (char_length(by_name) <= 120),
  taken_back_at timestamptz,
  taken_back_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  taken_back_by_name text NOT NULL DEFAULT '' CHECK (char_length(taken_back_by_name) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.start_check_marks IS 'Before we start (#382): a yes on a bullet on them. One live yes a bullet; a yes taken back stays as a row. A bullet that asks for a photo is not settled by know = word.';
COMMENT ON COLUMN public.start_check_marks.know IS 'How we know: word (their word), photo (their photo) or saw (one of ours saw it on site).';
COMMENT ON COLUMN public.start_check_marks.who_name IS 'Who said it or saw it, as the office wrote the name.';
COMMENT ON COLUMN public.start_check_marks.how IS 'How it reached us: by phone, by text, on his page, on site.';
COMMENT ON COLUMN public.start_check_marks.said_on IS 'The day it was said or seen.';
COMMENT ON COLUMN public.start_check_marks.source IS 'office (a person of ours wrote it down), portal (their own press on the GC''s page) or crew (the look on arrival).';
COMMENT ON COLUMN public.start_check_marks.photo_storage_path IS 'The photo in the start-check-photos bucket, <job_id>/<mark_id>-<ms>.jpg, until it is filed.';
CREATE UNIQUE INDEX IF NOT EXISTS start_check_marks_live_idx ON public.start_check_marks (bullet_id) WHERE taken_back_at IS NULL;
CREATE INDEX IF NOT EXISTS start_check_marks_job_idx ON public.start_check_marks (job_id);

CREATE TABLE IF NOT EXISTS public.start_check_asks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  fixture_id uuid NOT NULL REFERENCES public.jobs_ledger_fixtures(id) ON DELETE CASCADE,
  bullet_id uuid REFERENCES public.start_check_bullets(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'ask' CHECK (kind IN ('ask', 'hold_note')),
  how text NOT NULL CHECK (how IN ('text', 'email', 'phone', 'in_person', 'other')),
  to_name text NOT NULL CHECK (char_length(btrim(to_name)) BETWEEN 1 AND 120),
  asked_on date NOT NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  by_user uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (char_length(by_name) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT start_check_asks_names_a_bullet CHECK (kind = 'hold_note' OR bullet_id IS NOT NULL)
);
COMMENT ON TABLE public.start_check_asks IS 'Before we start (#382): every ask, kept. One message to one person covers many bullets on many stages: it is one batch_id, a row a bullet. A hold note sent is a row with no bullet.';
COMMENT ON COLUMN public.start_check_asks.batch_id IS 'One press of Ask: every row of one message carries the same id.';
COMMENT ON COLUMN public.start_check_asks.message_id IS 'The line in Messages, when the ask went out through its box.';
CREATE INDEX IF NOT EXISTS start_check_asks_bullet_idx ON public.start_check_asks (bullet_id, created_at) WHERE bullet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS start_check_asks_fixture_idx ON public.start_check_asks (fixture_id, created_at);
CREATE INDEX IF NOT EXISTS start_check_asks_job_idx ON public.start_check_asks (job_id);

CREATE TABLE IF NOT EXISTS public.start_check_their_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  fixture_id uuid NOT NULL REFERENCES public.jobs_ledger_fixtures(id) ON DELETE CASCADE,
  ready_day date NOT NULL,
  said_on date NOT NULL,
  who_name text NOT NULL CHECK (char_length(btrim(who_name)) BETWEEN 1 AND 120),
  how text NOT NULL DEFAULT '' CHECK (char_length(how) <= 80),
  source text NOT NULL DEFAULT 'office' CHECK (source IN ('office', 'portal')),
  by_user uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (char_length(by_name) <= 120),
  removed_at timestamptz,
  removed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.start_check_their_days IS 'Before we start (#382): every day they gave for ready on a stage, kept. The newest is the day they say now, and first to newest is how far they have moved. A day typed by mistake is marked removed, never deleted.';
CREATE INDEX IF NOT EXISTS start_check_their_days_fixture_idx ON public.start_check_their_days (fixture_id, created_at);
CREATE INDEX IF NOT EXISTS start_check_their_days_job_idx ON public.start_check_their_days (job_id);

CREATE TABLE IF NOT EXISTS public.start_check_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  fixture_id uuid NOT NULL REFERENCES public.jobs_ledger_fixtures(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('go', 'hold')),
  decided_on date NOT NULL,
  open_then jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(open_then) = 'array'),
  start_then date,
  hold_until date,
  by_user uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (char_length(by_name) <= 120),
  taken_back_at timestamptz,
  taken_back_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  taken_back_by_name text NOT NULL DEFAULT '' CHECK (char_length(taken_back_by_name) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT start_check_decisions_hold_day CHECK (kind = 'hold' OR hold_until IS NULL)
);
COMMENT ON TABLE public.start_check_decisions IS 'Before we start (#382): Go and Hold on a stage, each with who pressed it and the day. The newest row not taken back is where the stage stands. Written by start_check_decide and start_check_take_back, which keep the name themselves.';
COMMENT ON COLUMN public.start_check_decisions.open_then IS 'The words of every bullet that was open when it was pressed. A Go with any is a go on their promise.';
COMMENT ON COLUMN public.start_check_decisions.start_then IS 'Our first day as it stood when it was pressed.';
COMMENT ON COLUMN public.start_check_decisions.hold_until IS 'A hold: the day our start moved to.';
CREATE INDEX IF NOT EXISTS start_check_decisions_fixture_idx ON public.start_check_decisions (fixture_id, created_at);
CREATE INDEX IF NOT EXISTS start_check_decisions_job_idx ON public.start_check_decisions (job_id);

CREATE TABLE IF NOT EXISTS public.start_check_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid UNIQUE REFERENCES public.developments(id) ON DELETE CASCADE,
  job_id uuid UNIQUE REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  notice_days integer CHECK (notice_days IS NULL OR notice_days BETWEEN 0 AND 60),
  shows_on_gc_page boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by_name text NOT NULL DEFAULT '' CHECK (char_length(updated_by_name) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT start_check_settings_one_home CHECK ((development_id IS NULL) <> (job_id IS NULL)),
  CONSTRAINT start_check_settings_page_is_a_jobs CHECK (job_id IS NOT NULL OR NOT shows_on_gc_page)
);
COMMENT ON TABLE public.start_check_settings IS 'Before we start (#382): one row a site, and one a job. A site''s row holds the days of notice we need there. A job''s row holds the switch for the GC''s page, and its own days of notice when the job is on no site.';
COMMENT ON COLUMN public.start_check_settings.notice_days IS 'The days of notice we need before our first day. Null reads the default: ten days for a far site and two for a near one.';
COMMENT ON COLUMN public.start_check_settings.shows_on_gc_page IS 'A job''s row only: Show what we need before each stage. Off by default. The page also needs the job to share its stage dates.';

-- ---------- 3 · A row's job is its stage line's job ----------

CREATE OR REPLACE FUNCTION public.start_check_row_on_stage_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job uuid;
BEGIN
  SELECT f.job_id INTO v_job FROM public.jobs_ledger_fixtures f WHERE f.id = NEW.fixture_id;
  NEW.job_id := COALESCE(v_job, NEW.job_id);
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.start_check_row_on_stage_job() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.start_check_row_on_stage_job() IS 'Before we start (#382): a row''s job is its stage line''s job, read on every write that names either, so a press made before a split or a combine lands on the line''s job and the gate asks about that job.';

CREATE OR REPLACE TRIGGER start_check_bullets_on_stage_job
  BEFORE INSERT OR UPDATE OF job_id, fixture_id ON public.start_check_bullets
  FOR EACH ROW EXECUTE FUNCTION public.start_check_row_on_stage_job();
CREATE OR REPLACE TRIGGER start_check_arrivals_on_stage_job
  BEFORE INSERT OR UPDATE OF job_id, fixture_id ON public.start_check_arrivals
  FOR EACH ROW EXECUTE FUNCTION public.start_check_row_on_stage_job();
CREATE OR REPLACE TRIGGER start_check_asks_on_stage_job
  BEFORE INSERT OR UPDATE OF job_id, fixture_id ON public.start_check_asks
  FOR EACH ROW EXECUTE FUNCTION public.start_check_row_on_stage_job();
CREATE OR REPLACE TRIGGER start_check_their_days_on_stage_job
  BEFORE INSERT OR UPDATE OF job_id, fixture_id ON public.start_check_their_days
  FOR EACH ROW EXECUTE FUNCTION public.start_check_row_on_stage_job();
CREATE OR REPLACE TRIGGER start_check_decisions_on_stage_job
  BEFORE INSERT OR UPDATE OF job_id, fixture_id ON public.start_check_decisions
  FOR EACH ROW EXECUTE FUNCTION public.start_check_row_on_stage_job();

-- A yes is on a bullet on them, and its job is its bullet's job.
CREATE OR REPLACE FUNCTION public.start_check_mark_on_bullet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job uuid;
  v_on text;
BEGIN
  SELECT b.job_id, b.waits_on INTO v_job, v_on FROM public.start_check_bullets b WHERE b.id = NEW.bullet_id;
  IF v_on = 'us' THEN
    RAISE EXCEPTION 'A bullet of ours is read from the app. Nobody ticks it.' USING ERRCODE = '23514';
  END IF;
  NEW.job_id := COALESCE(v_job, NEW.job_id);
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.start_check_mark_on_bullet() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.start_check_mark_on_bullet() IS 'Before we start (#382): a yes is on a bullet on them, and it takes its bullet''s job.';

CREATE OR REPLACE TRIGGER start_check_marks_on_bullet
  BEFORE INSERT OR UPDATE OF job_id, bullet_id ON public.start_check_marks
  FOR EACH ROW EXECUTE FUNCTION public.start_check_mark_on_bullet();

-- A stage line that moves to another job carries its list.
CREATE OR REPLACE FUNCTION public.jobs_ledger_fixture_carries_start_checks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.start_check_bullets SET job_id = NEW.job_id WHERE fixture_id = NEW.id AND job_id IS DISTINCT FROM NEW.job_id;
  UPDATE public.start_check_marks m SET job_id = NEW.job_id
    FROM public.start_check_bullets b
   WHERE b.id = m.bullet_id AND b.fixture_id = NEW.id AND m.job_id IS DISTINCT FROM NEW.job_id;
  UPDATE public.start_check_asks SET job_id = NEW.job_id WHERE fixture_id = NEW.id AND job_id IS DISTINCT FROM NEW.job_id;
  UPDATE public.start_check_their_days SET job_id = NEW.job_id WHERE fixture_id = NEW.id AND job_id IS DISTINCT FROM NEW.job_id;
  UPDATE public.start_check_decisions SET job_id = NEW.job_id WHERE fixture_id = NEW.id AND job_id IS DISTINCT FROM NEW.job_id;
  UPDATE public.start_check_arrivals SET job_id = NEW.job_id WHERE fixture_id = NEW.id AND job_id IS DISTINCT FROM NEW.job_id;
  RETURN NULL;
END
$$;
REVOKE ALL ON FUNCTION public.jobs_ledger_fixture_carries_start_checks() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.jobs_ledger_fixture_carries_start_checks() IS 'Before we start (#382): a stage line that moves to another job carries its bullets, their yeses, its asks, the days they gave, its decisions and its arrivals. Nothing else on them changes.';

CREATE OR REPLACE TRIGGER jobs_ledger_fixtures_carry_start_checks
  AFTER UPDATE OF job_id ON public.jobs_ledger_fixtures
  FOR EACH ROW
  WHEN (OLD.job_id IS DISTINCT FROM NEW.job_id)
  EXECUTE FUNCTION public.jobs_ledger_fixture_carries_start_checks();

CREATE OR REPLACE TRIGGER start_check_templates_set_updated_at
  BEFORE UPDATE ON public.start_check_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER start_check_bullets_set_updated_at
  BEFORE UPDATE ON public.start_check_bullets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER start_check_marks_set_updated_at
  BEFORE UPDATE ON public.start_check_marks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER start_check_settings_set_updated_at
  BEFORE UPDATE ON public.start_check_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 4 · Row security ----------

ALTER TABLE public.start_check_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.start_check_bullets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.start_check_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.start_check_asks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.start_check_their_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.start_check_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.start_check_arrivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.start_check_settings ENABLE ROW LEVEL SECURITY;

-- The company's lists: every signed-in person reads them, the office writes them.
DROP POLICY IF EXISTS start_check_templates_select ON public.start_check_templates;
CREATE POLICY start_check_templates_select ON public.start_check_templates FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS start_check_templates_insert ON public.start_check_templates;
CREATE POLICY start_check_templates_insert ON public.start_check_templates FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_office_staff()) AND created_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS start_check_templates_update ON public.start_check_templates;
CREATE POLICY start_check_templates_update ON public.start_check_templates FOR UPDATE TO authenticated
  USING ((SELECT public.is_office_staff())) WITH CHECK ((SELECT public.is_office_staff()));
DROP POLICY IF EXISTS start_check_templates_delete ON public.start_check_templates;
CREATE POLICY start_check_templates_delete ON public.start_check_templates FOR DELETE TO authenticated
  USING ((SELECT public.is_dev()));

-- A stage's bullets: the desk reads and writes them. The crew reads the ones on them that are still on the list.
DROP POLICY IF EXISTS start_check_bullets_select ON public.start_check_bullets;
CREATE POLICY start_check_bullets_select ON public.start_check_bullets FOR SELECT TO authenticated
  USING (public.start_checks_desk(job_id) OR (waits_on = 'them' AND removed_at IS NULL AND public.start_checks_crew(job_id)));
DROP POLICY IF EXISTS start_check_bullets_insert ON public.start_check_bullets;
CREATE POLICY start_check_bullets_insert ON public.start_check_bullets FOR INSERT TO authenticated
  WITH CHECK (public.start_checks_desk(job_id) AND created_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS start_check_bullets_update ON public.start_check_bullets;
CREATE POLICY start_check_bullets_update ON public.start_check_bullets FOR UPDATE TO authenticated
  USING (public.start_checks_desk(job_id)) WITH CHECK (public.start_checks_desk(job_id));
DROP POLICY IF EXISTS start_check_bullets_delete ON public.start_check_bullets;
CREATE POLICY start_check_bullets_delete ON public.start_check_bullets FOR DELETE TO authenticated
  USING ((SELECT public.is_dev()));

-- A yes: the desk writes one down as the office. The crew reads the live ones on the bullets it reads. The GC's page and the look on arrival
-- write theirs with the service role and through their own function, in the releases that bring them.
DROP POLICY IF EXISTS start_check_marks_select ON public.start_check_marks;
CREATE POLICY start_check_marks_select ON public.start_check_marks FOR SELECT TO authenticated
  USING (
    public.start_checks_desk(job_id)
    OR (
      taken_back_at IS NULL
      AND public.start_checks_crew(job_id)
      -- Read under the caller's own policy on the bullets: a yes on a bullet taken off the list is not the crew's.
      AND EXISTS (SELECT 1 FROM public.start_check_bullets b WHERE b.id = bullet_id)
    )
  );
DROP POLICY IF EXISTS start_check_marks_insert ON public.start_check_marks;
CREATE POLICY start_check_marks_insert ON public.start_check_marks FOR INSERT TO authenticated
  WITH CHECK (public.start_checks_desk(job_id) AND source = 'office' AND by_user = (SELECT auth.uid()));
DROP POLICY IF EXISTS start_check_marks_update ON public.start_check_marks;
CREATE POLICY start_check_marks_update ON public.start_check_marks FOR UPDATE TO authenticated
  USING (public.start_checks_desk(job_id)) WITH CHECK (public.start_checks_desk(job_id));
DROP POLICY IF EXISTS start_check_marks_delete ON public.start_check_marks;
CREATE POLICY start_check_marks_delete ON public.start_check_marks FOR DELETE TO authenticated
  USING ((SELECT public.is_dev()));

-- Every ask is kept: the desk reads and adds, nobody changes one.
DROP POLICY IF EXISTS start_check_asks_select ON public.start_check_asks;
CREATE POLICY start_check_asks_select ON public.start_check_asks FOR SELECT TO authenticated
  USING (public.start_checks_desk(job_id));
DROP POLICY IF EXISTS start_check_asks_insert ON public.start_check_asks;
CREATE POLICY start_check_asks_insert ON public.start_check_asks FOR INSERT TO authenticated
  WITH CHECK (public.start_checks_desk(job_id) AND by_user = (SELECT auth.uid()));
DROP POLICY IF EXISTS start_check_asks_delete ON public.start_check_asks;
CREATE POLICY start_check_asks_delete ON public.start_check_asks FOR DELETE TO authenticated
  USING ((SELECT public.is_dev()));

-- Every day they gave is kept: the desk reads and adds, and marks one removed. The column grant below holds an
-- update to that mark.
DROP POLICY IF EXISTS start_check_their_days_select ON public.start_check_their_days;
CREATE POLICY start_check_their_days_select ON public.start_check_their_days FOR SELECT TO authenticated
  USING (public.start_checks_desk(job_id));
DROP POLICY IF EXISTS start_check_their_days_insert ON public.start_check_their_days;
CREATE POLICY start_check_their_days_insert ON public.start_check_their_days FOR INSERT TO authenticated
  WITH CHECK (public.start_checks_desk(job_id) AND source = 'office' AND by_user = (SELECT auth.uid()));
DROP POLICY IF EXISTS start_check_their_days_update ON public.start_check_their_days;
CREATE POLICY start_check_their_days_update ON public.start_check_their_days FOR UPDATE TO authenticated
  USING (public.start_checks_desk(job_id)) WITH CHECK (public.start_checks_desk(job_id));
DROP POLICY IF EXISTS start_check_their_days_delete ON public.start_check_their_days;
CREATE POLICY start_check_their_days_delete ON public.start_check_their_days FOR DELETE TO authenticated
  USING ((SELECT public.is_dev()));

-- A decision: the desk reads it. It is written by start_check_decide and start_check_take_back alone.
DROP POLICY IF EXISTS start_check_decisions_select ON public.start_check_decisions;
CREATE POLICY start_check_decisions_select ON public.start_check_decisions FOR SELECT TO authenticated
  USING (public.start_checks_desk(job_id));
DROP POLICY IF EXISTS start_check_decisions_delete ON public.start_check_decisions;
CREATE POLICY start_check_decisions_delete ON public.start_check_decisions FOR DELETE TO authenticated
  USING ((SELECT public.is_dev()));

-- An arrival: the desk reads it, and the person who made it reads their own.
DROP POLICY IF EXISTS start_check_arrivals_select ON public.start_check_arrivals;
CREATE POLICY start_check_arrivals_select ON public.start_check_arrivals FOR SELECT TO authenticated
  USING (public.start_checks_desk(job_id) OR by_user = (SELECT auth.uid()));
DROP POLICY IF EXISTS start_check_arrivals_delete ON public.start_check_arrivals;
CREATE POLICY start_check_arrivals_delete ON public.start_check_arrivals FOR DELETE TO authenticated
  USING ((SELECT public.is_dev()));

-- The settings: a job's row follows the job's desk. A site's row is read by whoever reads the site, and written by
-- the office.
DROP POLICY IF EXISTS start_check_settings_select ON public.start_check_settings;
CREATE POLICY start_check_settings_select ON public.start_check_settings FOR SELECT TO authenticated
  USING (
    (job_id IS NOT NULL AND public.start_checks_desk(job_id))
    OR (development_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.developments d WHERE d.id = development_id))
  );
DROP POLICY IF EXISTS start_check_settings_insert ON public.start_check_settings;
CREATE POLICY start_check_settings_insert ON public.start_check_settings FOR INSERT TO authenticated
  WITH CHECK (
    (job_id IS NOT NULL AND public.start_checks_desk(job_id))
    OR (development_id IS NOT NULL AND (SELECT public.is_office_staff()) AND EXISTS (SELECT 1 FROM public.developments d WHERE d.id = development_id))
  );
DROP POLICY IF EXISTS start_check_settings_update ON public.start_check_settings;
CREATE POLICY start_check_settings_update ON public.start_check_settings FOR UPDATE TO authenticated
  USING (
    (job_id IS NOT NULL AND public.start_checks_desk(job_id))
    OR (development_id IS NOT NULL AND (SELECT public.is_office_staff()) AND EXISTS (SELECT 1 FROM public.developments d WHERE d.id = development_id))
  )
  WITH CHECK (
    (job_id IS NOT NULL AND public.start_checks_desk(job_id))
    OR (development_id IS NOT NULL AND (SELECT public.is_office_staff()) AND EXISTS (SELECT 1 FROM public.developments d WHERE d.id = development_id))
  );
DROP POLICY IF EXISTS start_check_settings_delete ON public.start_check_settings;
CREATE POLICY start_check_settings_delete ON public.start_check_settings FOR DELETE TO authenticated
  USING ((SELECT public.is_dev()));

-- A job shut by its papers is shut here too: each gate above asks job_shut_to_me, so these tables carry no
-- job_papers_fence of their own. That short fence is for a table that grants a job's rows with no helper.

REVOKE ALL ON public.start_check_templates, public.start_check_bullets, public.start_check_marks, public.start_check_asks,
  public.start_check_their_days, public.start_check_decisions, public.start_check_arrivals, public.start_check_settings FROM anon;
REVOKE ALL ON public.start_check_templates, public.start_check_bullets, public.start_check_marks, public.start_check_asks,
  public.start_check_their_days, public.start_check_decisions, public.start_check_arrivals, public.start_check_settings FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.start_check_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.start_check_bullets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.start_check_marks TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.start_check_asks TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.start_check_their_days TO authenticated;
GRANT UPDATE (removed_at, removed_by) ON public.start_check_their_days TO authenticated;
GRANT SELECT, DELETE ON public.start_check_decisions TO authenticated;
GRANT SELECT, DELETE ON public.start_check_arrivals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.start_check_settings TO authenticated;
GRANT ALL ON public.start_check_templates, public.start_check_bullets, public.start_check_marks, public.start_check_asks,
  public.start_check_their_days, public.start_check_decisions, public.start_check_arrivals, public.start_check_settings TO service_role;

-- ---------- 5 · Go and Hold: one door, and the name is kept ----------

-- A definer stands behind the tables' fences, so it holds them itself. Go keeps who pressed it, the day, and what
-- was open. Hold does the same and moves our window to the day picked, its length kept, since a superintendent may
-- decide and may not write a window.
CREATE OR REPLACE FUNCTION public.start_check_decide(
  p_fixture_id uuid,
  p_kind text,
  p_open_then jsonb DEFAULT '[]'::jsonb,
  p_hold_until date DEFAULT NULL
)
RETURNS public.start_check_decisions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_job uuid;
  v_window public.job_stage_windows;
  v_len integer;
  v_row public.start_check_decisions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'This account is archived.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'Training mode is read-only. Nothing was decided.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin decides no stage.' USING ERRCODE = '42501';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('go', 'hold') THEN
    RAISE EXCEPTION 'A decision is Go or Hold.' USING ERRCODE = '22023';
  END IF;
  IF p_open_then IS NULL OR jsonb_typeof(p_open_then) <> 'array' OR jsonb_array_length(p_open_then) > 200 THEN
    RAISE EXCEPTION 'What was open is a list of bullets.' USING ERRCODE = '22023';
  END IF;
  SELECT f.job_id INTO v_job FROM public.jobs_ledger_fixtures f WHERE f.id = p_fixture_id;
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'That stage is gone.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.start_checks_may_decide(v_job) THEN
    RAISE EXCEPTION 'Go and Hold are for the office and the job''s superintendent.' USING ERRCODE = '42501';
  END IF;
  SELECT w.* INTO v_window FROM public.job_stage_windows w WHERE w.fixture_id = p_fixture_id FOR UPDATE;
  IF p_kind = 'hold' THEN
    IF p_hold_until IS NULL THEN
      RAISE EXCEPTION 'A hold needs the day our start moves to.' USING ERRCODE = '22023';
    END IF;
    IF v_window.id IS NULL OR v_window.window_start IS NULL THEN
      RAISE EXCEPTION 'Plan our days for this stage first. A hold moves them.' USING ERRCODE = '22023';
    END IF;
  ELSIF p_hold_until IS NOT NULL THEN
    RAISE EXCEPTION 'A Go moves no day.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.start_check_decisions (job_id, fixture_id, kind, decided_on, open_then, start_then, hold_until, by_user, by_name)
  VALUES (
    v_job, p_fixture_id, p_kind, public.app_today(), p_open_then, v_window.window_start, p_hold_until, v_uid,
    COALESCE((SELECT u.name FROM public.users u WHERE u.id = v_uid), '')
  )
  RETURNING * INTO v_row;

  IF p_kind = 'hold' THEN
    v_len := COALESCE(v_window.window_end - v_window.window_start, 0);
    UPDATE public.job_stage_windows
       SET window_start = p_hold_until, window_end = p_hold_until + v_len, window_by = 'office'
     WHERE id = v_window.id;
  END IF;
  RETURN v_row;
END
$fn$;
COMMENT ON FUNCTION public.start_check_decide(uuid, text, jsonb, date) IS 'Before we start (#382): Go or Hold on a stage line. For the office and the job''s superintendent. It keeps who pressed it, the day and what was open, and a Hold moves our window to the day picked with its length kept. Refuses a training account, a digital twin and an archived caller itself.';
REVOKE EXECUTE ON FUNCTION public.start_check_decide(uuid, text, jsonb, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_check_decide(uuid, text, jsonb, date) TO authenticated, service_role;

-- Take the Go back: the decision stays as a row, marked with who took it back. A hold taken back moves no day.
CREATE OR REPLACE FUNCTION public.start_check_take_back(p_decision_id uuid)
RETURNS public.start_check_decisions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.start_check_decisions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'This account is archived.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'Training mode is read-only. Nothing was taken back.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin decides no stage.' USING ERRCODE = '42501';
  END IF;
  SELECT d.* INTO v_row FROM public.start_check_decisions d WHERE d.id = p_decision_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'That decision is gone.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.start_checks_may_decide(v_row.job_id) THEN
    RAISE EXCEPTION 'Go and Hold are for the office and the job''s superintendent.' USING ERRCODE = '42501';
  END IF;
  IF v_row.taken_back_at IS NOT NULL THEN
    RETURN v_row;
  END IF;
  UPDATE public.start_check_decisions
     SET taken_back_at = now(), taken_back_by = v_uid,
         taken_back_by_name = COALESCE((SELECT u.name FROM public.users u WHERE u.id = v_uid), '')
   WHERE id = v_row.id
  RETURNING * INTO v_row;
  RETURN v_row;
END
$fn$;
COMMENT ON FUNCTION public.start_check_take_back(uuid) IS 'Before we start (#382): take a Go or a Hold back. The row stays, marked with who took it back and when. A second call changes nothing. Refuses a training account, a digital twin and an archived caller itself.';
REVOKE EXECUTE ON FUNCTION public.start_check_take_back(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_check_take_back(uuid) TO authenticated, service_role;

-- Our days for a job's stages, for the desk. job_stage_windows is read by the office, an estimator and a
-- superintendent, and by no primary. A primary with a claim on a job is on its desk, and a list that could not say
-- our first day would say nothing. This read names the window's two days and nothing else, and only for a job
-- whose desk the caller is on, so it opens no job to a primary beyond is_job_people.
CREATE OR REPLACE FUNCTION public.start_check_windows(p_job_ids uuid[])
RETURNS TABLE (job_id uuid, fixture_id uuid, window_start date, window_end date)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.job_id, w.fixture_id, w.window_start, w.window_end
    FROM public.job_stage_windows w
   WHERE w.job_id = ANY (COALESCE(p_job_ids, '{}'::uuid[]))
     AND NOT public.caller_is_archived()
     AND public.start_checks_desk(w.job_id);
$$;
COMMENT ON FUNCTION public.start_check_windows(uuid[]) IS 'Before we start (#382): our window for each stage line of the jobs named, its two days and nothing else, for a caller on the job''s desk (start_checks_desk). Nothing for a job the caller is not on, and nothing for an archived caller.';
REVOKE EXECUTE ON FUNCTION public.start_check_windows(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_check_windows(uuid[]) TO authenticated, service_role;

-- ---------- 6 · The photos ----------

-- Private, 2 MB a file, images only, as the stage checklist's bucket. Objects are named <job_id>/<mark_id>-<ms>.jpg,
-- so the desk's gate reads the job from the path. The GC's page uploads with the service role.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('start-check-photos', 'start-check-photos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS start_check_photos_files_insert ON storage.objects;
CREATE POLICY start_check_photos_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'start-check-photos' AND public.start_checks_desk(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS start_check_photos_files_select ON storage.objects;
CREATE POLICY start_check_photos_files_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'start-check-photos' AND public.start_checks_desk(((storage.foldername(name))[1])::uuid));

-- ---------- 7 · The fences ----------

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
