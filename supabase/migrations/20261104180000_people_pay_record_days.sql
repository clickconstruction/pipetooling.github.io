SET lock_timeout = '3s';

-- People with no login hold their own days and standing (punch list #254, v2.6501). A clock session belongs to a
-- login (clock_sessions.user_id → users → auth.users), so a person paid from the bank and never given a login could
-- hold no day and no Charged as, and a job they worked priced short by every day they were out. The owner's rule
-- (2026-11-04): "we want to be able to track people even if they have no login".
--
--   1. people.charge_standing — the same four values as users.charge_standing. A People record linked to a login
--      reads the login's standing (one place to set it); an unlinked one reads its own.
--   2. people_pay_record_days — one row a person, a job and a day, hours and a note naming the source, written only
--      by the import door below (no insert policy; the service role aside), approved through the approval door
--      below, read by the roles that price a job's charges. Pay never reads these rows: the people on them are paid
--      from bank rows, not payroll.
--   3. import_person_days(p_rows jsonb) — SECURITY DEFINER, devs only, modeled on import_clock_sessions: every row
--      checked, a row that fails named with its reason while the rest go in, a rerun skipping what is there.
--      Answers { inserted, skipped, refused: [{ row, reason }] }.
--   4. approve_person_days(p_ids uuid[]) — the hours-approval gate (a dev, the controller, a pay-approved master,
--      an assistant), stamping approved_at / approved_by and nothing else: no pay row, no crew-job row.
--   5. charge_standings() answers the unlinked People records too, as rows with person_id and no id, so every
--      charge reader prices them from the one read.

-- 1. A People record's standing.
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS charge_standing text;
COMMENT ON COLUMN public.people.charge_standing IS
  'What this person counts as when a crew''s hour is priced, for a People record with no login: master, tech, helper, or none. Null reads as none. A record linked to a login reads the login''s users.charge_standing instead. Punch list #254, v2.6501.';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'people_charge_standing_check') THEN
    ALTER TABLE public.people
      ADD CONSTRAINT people_charge_standing_check
      CHECK (charge_standing IS NULL OR charge_standing IN ('master', 'tech', 'helper', 'none')) NOT VALID;
  END IF;
END $$;

-- 2. The days a person with no login worked a job, from the pay records.
CREATE TABLE IF NOT EXISTS public.people_pay_record_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  job_ledger_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  hours numeric(6,2) NOT NULL CHECK (hours > 0 AND hours <= 16),
  -- Where the day came from: the bank row, the trip record, the person's word.
  note text NOT NULL CHECK (btrim(note) <> ''),
  origin text NOT NULL DEFAULT 'imported' CHECK (origin = 'imported'),
  approved_at timestamptz,
  approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT people_pay_record_days_one_a_day UNIQUE (person_id, job_ledger_id, work_date)
);
COMMENT ON TABLE public.people_pay_record_days IS
  'Punch list #254, v2.6501: the days a person on the People roster worked a job, imported from the pay records by a dev (import_person_days), one row a person, a job and a day, approved through approve_person_days. Priced on the job''s charges beside the approved clock sessions. Pay never reads these rows.';

CREATE INDEX IF NOT EXISTS people_pay_record_days_job_idx ON public.people_pay_record_days (job_ledger_id, work_date);
CREATE INDEX IF NOT EXISTS people_pay_record_days_person_idx ON public.people_pay_record_days (person_id, work_date);

ALTER TABLE public.people_pay_record_days ENABLE ROW LEVEL SECURITY;

-- Read by the roles that price a job's charges, as charge_standings() and job_charge_adjustments are gated. No insert,
-- update or delete policy: the two doors below write as the definer, and nothing else does.
DROP POLICY IF EXISTS people_pay_record_days_select ON public.people_pay_record_days;
CREATE POLICY people_pay_record_days_select ON public.people_pay_record_days
  FOR SELECT TO authenticated USING (public.is_dev() OR public.has_payroll_access());

REVOKE ALL ON public.people_pay_record_days FROM anon;
GRANT SELECT ON public.people_pay_record_days TO authenticated;

-- 3. The import door.
CREATE OR REPLACE FUNCTION public.import_person_days(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_i int := 0;
  v_person uuid;
  v_job uuid;
  v_day date;
  v_hours numeric;
  v_note text;
  v_id uuid;
  v_inserted int := 0;
  v_skipped int := 0;
  v_refused jsonb := '[]'::jsonb;
  v_reason text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'import_person_days: only a dev imports pay-record days' USING ERRCODE = '42501';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'import_person_days: p_rows must be a JSON array of rows';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_i := v_i + 1;
    v_reason := NULL;
    BEGIN
      v_person := (v_row->>'person_id')::uuid;
      v_job := (v_row->>'job_ledger_id')::uuid;
      v_day := (v_row->>'work_date')::date;
      v_hours := (v_row->>'hours')::numeric;
      v_note := btrim(COALESCE(v_row->>'note', ''));
    EXCEPTION WHEN OTHERS THEN
      v_refused := v_refused || jsonb_build_object('row', v_i, 'reason', 'a field would not read: ' || SQLERRM);
      CONTINUE;
    END;

    IF v_person IS NULL OR v_job IS NULL OR v_day IS NULL OR v_hours IS NULL THEN
      v_reason := 'person_id, job_ledger_id, work_date and hours are all required';
    ELSIF NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = v_person) THEN
      v_reason := 'no such person on the People roster';
    ELSIF NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = v_job AND COALESCE(j.billing_only, false) = false) THEN
      v_reason := 'no such job, or a billing-only job';
    ELSIF v_hours <= 0 THEN
      v_reason := 'hours must be more than zero';
    ELSIF v_hours > 16 THEN
      v_reason := 'a day of more than sixteen hours';
    ELSIF v_day > (now() AT TIME ZONE 'America/Chicago')::date THEN
      v_reason := 'work_date is after today';
    ELSIF v_note = '' THEN
      v_reason := 'the note must name where the day came from';
    END IF;

    IF v_reason IS NOT NULL THEN
      v_refused := v_refused || jsonb_build_object('row', v_i, 'reason', v_reason);
      CONTINUE;
    END IF;

    v_id := NULL;
    INSERT INTO public.people_pay_record_days (person_id, job_ledger_id, work_date, hours, note, created_by)
    VALUES (v_person, v_job, v_day, round(v_hours, 2), v_note, auth.uid())
    ON CONFLICT (person_id, job_ledger_id, work_date) DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      v_skipped := v_skipped + 1;
    ELSE
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped, 'refused', v_refused);
END;
$$;

COMMENT ON FUNCTION public.import_person_days(jsonb) IS
  'Devs only. Puts a People record''s days on a job from the pay records into people_pay_record_days, one row a person, a job and a day, unapproved, each note naming its source; a rerun skips what is there. Each row: person_id, job_ledger_id, work_date, hours, note. Answers { inserted, skipped, refused: [{ row, reason }] }. Punch list #254, v2.6501.';

REVOKE ALL ON FUNCTION public.import_person_days(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_person_days(jsonb) TO authenticated;

-- 4. The approval door: the stamp and nothing else.
CREATE OR REPLACE FUNCTION public.approve_person_days(p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approved int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (public.is_dev() OR public.has_payroll_access() OR public.is_assistant()) THEN
    RAISE EXCEPTION 'approve_person_days: the people who approve hours approve pay-record days' USING ERRCODE = '42501';
  END IF;
  UPDATE public.people_pay_record_days
  SET approved_at = now(), approved_by = auth.uid()
  WHERE id = ANY(COALESCE(p_ids, ARRAY[]::uuid[]))
    AND approved_at IS NULL;
  GET DIAGNOSTICS v_approved = ROW_COUNT;
  RETURN jsonb_build_object('approved', v_approved, 'skipped', COALESCE(array_length(p_ids, 1), 0) - v_approved);
END;
$$;

COMMENT ON FUNCTION public.approve_person_days(uuid[]) IS
  'Approves pay-record days (people_pay_record_days) by id: approved_at and approved_by stamped, nothing written to pay. The hours-approval gate: a dev, has_payroll_access() or an assistant; refused otherwise (42501). Answers { approved, skipped }. Punch list #254, v2.6501.';

REVOKE ALL ON FUNCTION public.approve_person_days(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_person_days(uuid[]) TO authenticated;

-- 5. charge_standings() answers the unlinked People records too. The return type widens by person_id, so the
--    v2.6490 function is dropped first; a client built before this change ignores the column. Among live rows a
--    People record sorts before a login of the same name, so a last-wins map by name still lands on the login.
DROP FUNCTION IF EXISTS public.charge_standings();
CREATE FUNCTION public.charge_standings()
RETURNS TABLE (id uuid, person_id uuid, name text, charge_standing text, archived_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_dev() OR public.has_payroll_access()) THEN
    RAISE EXCEPTION 'A job''s charges price for a dev, the controller and a pay-approved master.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT r.id, r.person_id, r.name, r.charge_standing, r.archived_at
    FROM (
      SELECT u.id, NULL::uuid AS person_id, u.name, u.charge_standing, u.archived_at
      FROM public.users u
      UNION ALL
      SELECT NULL::uuid, p.id, p.name, p.charge_standing, p.archived_at
      FROM public.people p
      WHERE p.account_user_id IS NULL
    ) r
    ORDER BY (r.archived_at IS NULL), (r.person_id IS NULL), r.name, r.id, r.person_id;
END;
$$;

COMMENT ON FUNCTION public.charge_standings() IS
  'Every login with its Charged as (users.charge_standing), people who left included, and every People record with no login with its own (people.charge_standing, as a row with person_id and no id), for the screens that price a job''s charges; a dev or has_payroll_access(), refused otherwise (42501). Archived rows first. Punch list #254, v2.6490; People records v2.6501.';

REVOKE EXECUTE ON FUNCTION public.charge_standings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charge_standings() TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
