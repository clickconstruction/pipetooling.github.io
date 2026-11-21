SET lock_timeout = '3s';

-- Write someone up (punch list #410, PR 1): the ground under the phone sheet a leader or a superintendent opens from
-- the Dashboard. A field report about a person (person_reports, v2.2235) kept who, the day and the words. It gains the
-- facts a record needs a year later: the kind, the job, the time, who saw it, whether the person was told, the writer's
-- role, and whether the writer was on the clock at that job. Three functions:
--   write_up_people()         the list the sheet opens on: the roster without the caller, each person with the newest
--                             job-day they shared with the caller in the last seven days, and the caller's own jobs.
--   land_person_report(p)     the one door a send lands through. A leader, a superintendent or a dev, never about
--                             themselves. It takes a per-press id, so a send that arrives twice counts once.
--   withdraw_person_report()  the writer takes one back while it still waits, with a reason. The row and its words stay:
--                             it reads as dismissed with "Taken back by the writer: <reason>", so every reader that knows
--                             pending, filed and dismissed keeps working.
-- A superintendent could not write a report before: the table's insert policy names leaders and devs. That policy is
-- left as it is; the function is the superintendent's door, and an author already reads their own rows.
-- An addition to a write-up is a second report that points at the first (adds_to), so it waits and is filed like any other.
-- Additive and idempotent. No table is created, so no fence call is owed.

ALTER TABLE public.person_reports
  ADD COLUMN IF NOT EXISTS kind text NULL,
  ADD COLUMN IF NOT EXISTS job_ledger_id uuid NULL REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_label text NULL,
  ADD COLUMN IF NOT EXISTS occurred_time time NULL,
  ADD COLUMN IF NOT EXISTS author_role text NULL,
  ADD COLUMN IF NOT EXISTS author_saw_it boolean NULL,
  ADD COLUMN IF NOT EXISTS author_on_job boolean NULL,
  ADD COLUMN IF NOT EXISTS seen_by jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS talked_to_person boolean NULL,
  ADD COLUMN IF NOT EXISTS adds_to uuid NULL REFERENCES public.person_reports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS press_id uuid NULL,
  ADD COLUMN IF NOT EXISTS pressed_at timestamptz NULL;

ALTER TABLE public.person_reports DROP CONSTRAINT IF EXISTS person_reports_kind_check;
ALTER TABLE public.person_reports ADD CONSTRAINT person_reports_kind_check
  CHECK (kind IS NULL OR kind IN ('late_no_show', 'safety', 'work_quality', 'conduct', 'tools_truck', 'other', 'good_work'));
ALTER TABLE public.person_reports DROP CONSTRAINT IF EXISTS person_reports_seen_by_is_list;
ALTER TABLE public.person_reports ADD CONSTRAINT person_reports_seen_by_is_list CHECK (jsonb_typeof(seen_by) = 'array');

CREATE UNIQUE INDEX IF NOT EXISTS person_reports_press_id_key ON public.person_reports (press_id) WHERE press_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_person_reports_job ON public.person_reports (job_ledger_id) WHERE job_ledger_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_person_reports_adds_to ON public.person_reports (adds_to) WHERE adds_to IS NOT NULL;

COMMENT ON COLUMN public.person_reports.kind IS
  'What kind of thing was seen, picked by the writer: late_no_show, safety, work_quality, conduct, tools_truck, other or good_work. NULL on a report written before the phone sheet.';
COMMENT ON COLUMN public.person_reports.job_ledger_id IS 'The job it happened on, when the writer named one.';
COMMENT ON COLUMN public.person_reports.job_label IS 'The job as the writer saw it named on the sheet, kept so the record still reads if the job goes.';
COMMENT ON COLUMN public.person_reports.occurred_time IS 'The time of day it happened, on the app''s clock (America/Chicago), beside occurred_date.';
COMMENT ON COLUMN public.person_reports.author_role IS 'The writer''s role when it was sent.';
COMMENT ON COLUMN public.person_reports.author_saw_it IS 'True when the writer saw it themselves, false when they were told.';
COMMENT ON COLUMN public.person_reports.author_on_job IS 'True when the writer had a clock session on that job that day, worked out when it landed.';
COMMENT ON COLUMN public.person_reports.seen_by IS 'Who else saw it: a list of { person_id?, name }.';
COMMENT ON COLUMN public.person_reports.talked_to_person IS 'Whether the writer had talked to the person about it when it was sent.';
COMMENT ON COLUMN public.person_reports.adds_to IS 'The earlier report of the same writer about the same person that this one adds to.';
COMMENT ON COLUMN public.person_reports.press_id IS 'The id the phone minted for the press. A send that arrives twice lands once.';
COMMENT ON COLUMN public.person_reports.pressed_at IS 'When Send was pressed on the phone, which is before created_at when it waited for signal.';

-- The list the sheet opens on.
CREATE OR REPLACE FUNCTION public.write_up_people()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH me AS (
  SELECT u.id, u.role::text AS role
    FROM public.users u
   WHERE u.id = (SELECT auth.uid())
     AND u.archived_at IS NULL
     AND u.role::text IN ('dev', 'master_technician', 'superintendent')
),
day AS (SELECT (now() AT TIME ZONE 'America/Chicago')::date AS today),
my_days AS (
  -- the job-days the caller was listed on or clocked on
  SELECT b.job_id, b.work_date
    FROM public.job_schedule_blocks b
    JOIN me ON me.id = b.assignee_user_id
    CROSS JOIN day
   WHERE b.work_date BETWEEN day.today - 6 AND day.today
     AND b.job_id IS NOT NULL
  UNION
  SELECT s.job_ledger_id, s.work_date
    FROM public.clock_sessions s
    JOIN me ON me.id = s.user_id
    CROSS JOIN day
   WHERE s.work_date BETWEEN day.today - 6 AND day.today
     AND s.job_ledger_id IS NOT NULL
     AND s.rejected_at IS NULL
     AND s.revoked_at IS NULL
  UNION
  -- a superintendent's projects: every job-day anyone was listed on or clocked on there
  SELECT b.job_id, b.work_date
    FROM public.job_schedule_blocks b
    JOIN public.jobs_ledger j ON j.id = b.job_id
    JOIN public.project_superintendents ps ON ps.project_id = j.project_id
    JOIN me ON me.id = ps.superintendent_id AND me.role = 'superintendent'
    CROSS JOIN day
   WHERE b.work_date BETWEEN day.today - 6 AND day.today
  UNION
  SELECT s.job_ledger_id, s.work_date
    FROM public.clock_sessions s
    JOIN public.jobs_ledger j ON j.id = s.job_ledger_id
    JOIN public.project_superintendents ps ON ps.project_id = j.project_id
    JOIN me ON me.id = ps.superintendent_id AND me.role = 'superintendent'
    CROSS JOIN day
   WHERE s.work_date BETWEEN day.today - 6 AND day.today
     AND s.rejected_at IS NULL
     AND s.revoked_at IS NULL
),
crew AS (
  SELECT d.job_id, d.work_date, b.assignee_user_id AS user_id, NULL::timestamptz AS clocked_in_at
    FROM my_days d
    JOIN public.job_schedule_blocks b ON b.job_id = d.job_id AND b.work_date = d.work_date
  UNION ALL
  SELECT d.job_id, d.work_date, s.user_id, s.clocked_in_at
    FROM my_days d
    JOIN public.clock_sessions s ON s.job_ledger_id = d.job_id AND s.work_date = d.work_date
   WHERE s.rejected_at IS NULL
     AND s.revoked_at IS NULL
),
latest AS (
  -- one line a crew member: the newest day they shared with the caller, its job, their first clock-in there
  SELECT DISTINCT ON (c.user_id)
         c.user_id, c.work_date, c.job_id,
         (SELECT min(c2.clocked_in_at) FROM crew c2
           WHERE c2.user_id = c.user_id AND c2.work_date = c.work_date AND c2.job_id = c.job_id) AS clocked_in_at
    FROM crew c
   WHERE c.user_id <> (SELECT auth.uid())
   ORDER BY c.user_id, c.work_date DESC, c.clocked_in_at DESC NULLS LAST, c.job_id
),
my_jobs AS (
  SELECT d.job_id, max(d.work_date) AS last_day FROM my_days d GROUP BY d.job_id
)
SELECT jsonb_build_object(
  'allowed', EXISTS (SELECT 1 FROM me),
  'today', (SELECT today FROM day),
  'people', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'person_id', p.id,
             'name', p.name,
             'kind', p.kind,
             'with_date', l.work_date,
             'job_id', l.job_id,
             'hcp_number', j.hcp_number,
             'click_number', j.click_number,
             'job_name', j.job_name,
             'job_address', j.job_address,
             'clocked_in_at', l.clocked_in_at
           ) ORDER BY lower(p.name), p.id)
      FROM public.people p
      LEFT JOIN public.users u ON u.id = p.account_user_id
      LEFT JOIN latest l ON l.user_id = p.account_user_id
      LEFT JOIN public.jobs_ledger j ON j.id = l.job_id
     WHERE EXISTS (SELECT 1 FROM me)
       AND p.archived_at IS NULL
       AND p.account_user_id IS DISTINCT FROM (SELECT auth.uid())
       AND (u.id IS NULL OR (u.archived_at IS NULL AND NOT COALESCE(u.is_sample, false) AND NOT COALESCE(u.is_digital_twin, false)))
  ), '[]'::jsonb),
  'jobs', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'job_id', j.id,
             'hcp_number', j.hcp_number,
             'click_number', j.click_number,
             'job_name', j.job_name,
             'job_address', j.job_address,
             'last_day', m.last_day
           ) ORDER BY m.last_day DESC, j.job_name, j.id)
      FROM my_jobs m
      JOIN public.jobs_ledger j ON j.id = m.job_id
     WHERE EXISTS (SELECT 1 FROM me)
  ), '[]'::jsonb)
);
$$;

ALTER FUNCTION public.write_up_people() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.write_up_people() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_up_people() TO authenticated;
COMMENT ON FUNCTION public.write_up_people() IS
  'Write someone up (#410): for a leader, a superintendent or a dev, the active roster without the caller (id, name, kind), each person with the newest job-day they shared with the caller in the last seven days (listed or clocked on a job the caller was on, or on a job of a superintendent''s project), and the caller''s own jobs of those days. Anyone else gets { allowed: false } and empty lists.';

-- The one door a send lands through.
CREATE OR REPLACE FUNCTION public.land_person_report(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_today date := (now() AT TIME ZONE 'America/Chicago')::date;
  v_role text;
  v_name text;
  v_press uuid;
  v_person uuid;
  v_kind text;
  v_content text;
  v_date date;
  v_time time;
  v_job uuid;
  v_job_label text;
  v_adds uuid;
  v_pressed timestamptz;
  v_seen jsonb;
  v_on_job boolean;
  v_row public.person_reports%ROWTYPE;
  v_parent public.person_reports%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to write someone up.' USING ERRCODE = '42501';
  END IF;
  SELECT u.role::text, COALESCE(NULLIF(btrim(u.name), ''), '') INTO v_role, v_name
    FROM public.users u WHERE u.id = v_uid AND u.archived_at IS NULL;
  IF v_role IS NULL OR v_role NOT IN ('dev', 'master_technician', 'superintendent') THEN
    RAISE EXCEPTION 'Only a leader or a superintendent can write someone up.' USING ERRCODE = '42501';
  END IF;
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'The write-up came through empty. Send it again.';
  END IF;

  IF COALESCE(p->>'press_id', '') !~ v_uuid_re THEN
    RAISE EXCEPTION 'The write-up has no press id. Open the sheet again and send it.';
  END IF;
  v_press := (p->>'press_id')::uuid;

  -- A send that already landed answers as it did.
  SELECT * INTO v_row FROM public.person_reports r WHERE r.press_id = v_press;
  IF FOUND THEN
    IF v_row.author_user_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'That press belongs to another write-up.' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object('already', true, 'id', v_row.id, 'status', v_row.status);
  END IF;

  IF COALESCE(p->>'subject_person_id', '') !~ v_uuid_re THEN
    RAISE EXCEPTION 'Pick who the write-up is about.';
  END IF;
  v_person := (p->>'subject_person_id')::uuid;
  IF NOT EXISTS (SELECT 1 FROM public.people pe WHERE pe.id = v_person) THEN
    RAISE EXCEPTION 'That person is not on the roster.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.people pe WHERE pe.id = v_person AND pe.account_user_id = v_uid) THEN
    RAISE EXCEPTION 'You cannot write yourself up.';
  END IF;

  v_kind := NULLIF(btrim(COALESCE(p->>'kind', '')), '');
  IF v_kind IS NULL OR v_kind NOT IN ('late_no_show', 'safety', 'work_quality', 'conduct', 'tools_truck', 'other', 'good_work') THEN
    RAISE EXCEPTION 'Pick what kind of thing it was.';
  END IF;

  v_content := btrim(COALESCE(p->>'content', ''));
  IF v_content = '' THEN
    RAISE EXCEPTION 'Say what you saw.';
  END IF;
  IF char_length(v_content) > 4000 THEN
    RAISE EXCEPTION 'That is too long to send: % characters, and 4,000 is the most.', char_length(v_content);
  END IF;

  IF COALESCE(p->>'occurred_date', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'Say which day it happened.';
  END IF;
  BEGIN
    v_date := (p->>'occurred_date')::date;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Say which day it happened.';
  END;
  IF v_date > v_today THEN
    RAISE EXCEPTION 'The day it happened cannot be after today.';
  END IF;
  IF COALESCE(p->>'occurred_time', '') ~ '^\d{2}:\d{2}(:\d{2})?$' THEN
    BEGIN
      v_time := (p->>'occurred_time')::time;
    EXCEPTION WHEN OTHERS THEN
      v_time := NULL;
    END;
  END IF;

  IF COALESCE(p->>'job_ledger_id', '') ~ v_uuid_re THEN
    v_job := (p->>'job_ledger_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = v_job) THEN
      RAISE EXCEPTION 'That job is not on the list any more. Pick the job again.';
    END IF;
  END IF;
  v_job_label := NULLIF(left(btrim(COALESCE(p->>'job_label', '')), 160), '');

  IF COALESCE(p->>'adds_to', '') ~ v_uuid_re THEN
    v_adds := (p->>'adds_to')::uuid;
    SELECT * INTO v_parent FROM public.person_reports r WHERE r.id = v_adds;
    IF NOT FOUND OR v_parent.author_user_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'You can add only to a write-up you wrote.' USING ERRCODE = '42501';
    END IF;
    IF v_parent.subject_person_id <> v_person THEN
      RAISE EXCEPTION 'An addition is about the same person as the write-up it adds to.';
    END IF;
  END IF;

  -- When Send was pressed: the phone's stamp when it is not ahead of the server, else now.
  BEGIN
    v_pressed := (p->>'pressed_at')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    v_pressed := NULL;
  END;
  IF v_pressed IS NULL OR v_pressed > now() + interval '5 minutes' THEN
    v_pressed := now();
  END IF;

  SELECT COALESCE(jsonb_agg(
           jsonb_strip_nulls(jsonb_build_object(
             'person_id', CASE WHEN COALESCE(t.e->>'person_id', '') ~ v_uuid_re THEN lower(t.e->>'person_id') END,
             'name', left(btrim(t.e->>'name'), 80)))
           ORDER BY t.n), '[]'::jsonb)
    INTO v_seen
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p->'seen_by') = 'array' THEN p->'seen_by' ELSE '[]'::jsonb END)
         WITH ORDINALITY AS t(e, n)
   WHERE jsonb_typeof(t.e) = 'object'
     AND btrim(COALESCE(t.e->>'name', '')) <> ''
     AND t.n <= 12;

  v_on_job := v_job IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clock_sessions s
     WHERE s.user_id = v_uid AND s.job_ledger_id = v_job AND s.work_date = v_date
       AND s.rejected_at IS NULL AND s.revoked_at IS NULL);

  BEGIN
    INSERT INTO public.person_reports (
      subject_person_id, author_user_id, author_name, author_role, occurred_date, occurred_time, content, kind,
      job_ledger_id, job_label, author_saw_it, author_on_job, seen_by, talked_to_person, adds_to, press_id, pressed_at)
    VALUES (
      v_person, v_uid, v_name, v_role, v_date, v_time, v_content, v_kind,
      v_job, v_job_label,
      CASE WHEN jsonb_typeof(p->'author_saw_it') = 'boolean' THEN (p->>'author_saw_it')::boolean END,
      v_on_job, v_seen,
      CASE WHEN jsonb_typeof(p->'talked_to_person') = 'boolean' THEN (p->>'talked_to_person')::boolean END,
      v_adds, v_press, v_pressed)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    -- Two sends of one press raced: answer with the one that landed.
    SELECT * INTO v_row FROM public.person_reports r WHERE r.press_id = v_press;
    IF FOUND AND v_row.author_user_id = v_uid THEN
      RETURN jsonb_build_object('already', true, 'id', v_row.id, 'status', v_row.status);
    END IF;
    RAISE;
  END;

  RETURN jsonb_build_object('already', false, 'id', v_id, 'status', 'pending');
END;
$$;

ALTER FUNCTION public.land_person_report(jsonb) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.land_person_report(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.land_person_report(jsonb) TO authenticated;
COMMENT ON FUNCTION public.land_person_report(jsonb) IS
  'Write someone up (#410): lands one field report about a person from a leader, a superintendent or a dev, never about themselves. Keys: press_id (minted on the phone; a second arrival answers { already: true }), subject_person_id, kind, content, occurred_date, and optionally occurred_time, job_ledger_id, job_label, author_saw_it, seen_by [{ person_id?, name }], talked_to_person, adds_to, pressed_at. The writer''s name and role and whether they were on the clock at that job are worked out here. It waits on People, HR, Pending reports like any report.';

-- The writer takes one back while it still waits.
CREATE OR REPLACE FUNCTION public.withdraw_person_report(p_report_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.person_reports%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to take a write-up back.' USING ERRCODE = '42501';
  END IF;
  IF btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Say why you are taking it back.';
  END IF;
  SELECT * INTO r FROM public.person_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND OR r.author_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'You can take back only a write-up you wrote.' USING ERRCODE = '42501';
  END IF;
  IF r.status <> 'pending' THEN
    RETURN jsonb_build_object('already', true, 'status', r.status);
  END IF;
  UPDATE public.person_reports
     SET status = 'dismissed',
         resolution_note = 'Taken back by the writer: ' || left(btrim(p_reason), 500),
         resolved_at = now(),
         resolved_by = v_uid
   WHERE id = p_report_id;
  RETURN jsonb_build_object('already', false, 'status', 'dismissed');
END;
$$;

ALTER FUNCTION public.withdraw_person_report(uuid, text) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.withdraw_person_report(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_person_report(uuid, text) TO authenticated;
COMMENT ON FUNCTION public.withdraw_person_report(uuid, text) IS
  'Write someone up (#410): the writer takes back a report of their own that still waits, with a reason. The row and its words stay; it reads as dismissed with "Taken back by the writer: <reason>". A report already filed or dismissed answers { already: true }.';
