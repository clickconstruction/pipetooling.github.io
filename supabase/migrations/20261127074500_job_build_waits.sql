SET lock_timeout = '3s';

-- A Build job waits, with a reason (punch list #192, write A, v2.8709). The Bridge's Build desk tells its reader to
-- crew a stalled job or name why it waits, and there was nowhere to name it: a job the GC is not ready for counted
-- against the crew every week it sat. Taunya's answer of 2026-11-25: yes. This file is the ground under that press and
-- changes nothing a screen draws today: no client reads the table yet, and nothing calls the function.
--
--   1. job_build_waits: one row a wait. The job, the reason picked from six, the person's words, who marked it and
--      when, and who lifted it and when. A job holds at most one wait that is not lifted. The job's status does not
--      change: it stays Working, since the app's Waiting means not started.
--   2. set_job_build_wait(job, waits, reason, note): the one write. It marks a job waiting, or lifts the wait, and
--      writes one line on the job's Activity each time, as a status change does.
--
-- Who may do what. A wait is read by whoever reads its job: the policy asks jobs_ledger under the reader's own
-- rights, so the chip on a job's card shows to the people who see the card and to no one else. Nobody writes the
-- table from the app: there is no INSERT, UPDATE or DELETE policy, so every write is the function's, and the function
-- takes the office alone (is_office_staff: dev, owner, assistant, controller).
--
-- One table is created, so the four fences close the file. Additive and idempotent.

-- 1. The wait.
CREATE TABLE IF NOT EXISTS public.job_build_waits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  -- The reason the person picked; 'other' needs their words in `note`.
  reason text NOT NULL CHECK (reason IN ('gc_not_ready', 'materials', 'inspection', 'customer_hold', 'weather', 'other')),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 300),
  marked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  marked_by_name text NOT NULL DEFAULT '' CHECK (char_length(marked_by_name) <= 120),
  since_at timestamptz NOT NULL DEFAULT now(),
  -- The wait lifted: who and when. Null while the job still waits.
  lifted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  lifted_by_name text CHECK (lifted_by_name IS NULL OR char_length(lifted_by_name) <= 120),
  lifted_at timestamptz,
  CONSTRAINT job_build_waits_other_has_words CHECK (reason <> 'other' OR length(btrim(note)) > 0)
);

COMMENT ON TABLE public.job_build_waits IS
  'The Bridge''s Build desk (v2.8709, punch list #192 write A): a job marked as waiting, with a reason, so the desk stops counting it against the crew. One row a wait: the reason picked, the person''s words, who marked it and when, who lifted it and when. A job holds at most one wait that is not lifted. The job''s status does not change. Written only by set_job_build_wait.';
COMMENT ON COLUMN public.job_build_waits.reason IS 'Why the job waits: gc_not_ready (the GC is not ready for us), materials (waiting on materials), inspection (waiting on an inspection), customer_hold (the customer asked us to hold), weather, other (the words are in note).';
COMMENT ON COLUMN public.job_build_waits.since_at IS 'When the job was marked waiting.';
COMMENT ON COLUMN public.job_build_waits.lifted_at IS 'When the wait was lifted. Null while the job still waits.';

CREATE UNIQUE INDEX IF NOT EXISTS job_build_waits_one_open
  ON public.job_build_waits (job_id)
  WHERE lifted_at IS NULL;
CREATE INDEX IF NOT EXISTS job_build_waits_job_idx ON public.job_build_waits (job_id, since_at DESC);

ALTER TABLE public.job_build_waits ENABLE ROW LEVEL SECURITY;

-- Whoever reads the job reads its wait: jobs_ledger answers under the reader's own policies.
DROP POLICY IF EXISTS job_build_waits_select_with_job ON public.job_build_waits;
CREATE POLICY job_build_waits_select_with_job
  ON public.job_build_waits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = job_build_waits.job_id));

REVOKE ALL ON TABLE public.job_build_waits FROM anon;
REVOKE ALL ON TABLE public.job_build_waits FROM authenticated;
GRANT SELECT ON TABLE public.job_build_waits TO authenticated;
GRANT ALL ON TABLE public.job_build_waits TO service_role;

-- 2. The one write: mark a job waiting, or lift the wait.
CREATE OR REPLACE FUNCTION public.set_job_build_wait(
  p_job_id uuid,
  p_waits boolean,
  p_reason text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_reason text := btrim(COALESCE(p_reason, ''));
  v_note text := left(btrim(COALESCE(p_note, '')), 300);
  v_name text;
  v_words text;
  v_rows integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  IF NOT public.is_office_staff() OR public.caller_is_archived() THEN
    RETURN jsonb_build_object('error', 'Only the office marks a job waiting or lifts a wait.');
  END IF;
  IF public.is_read_only() THEN
    RETURN jsonb_build_object('error', 'A training account changes nothing.');
  END IF;
  IF p_waits IS NULL THEN
    RETURN jsonb_build_object('error', 'Say whether the job waits or the wait is lifted.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id) THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;
  SELECT left(COALESCE(u.name, ''), 120) INTO v_name FROM public.users u WHERE u.id = v_uid;
  v_name := COALESCE(v_name, '');

  IF p_waits THEN
    IF v_reason NOT IN ('gc_not_ready', 'materials', 'inspection', 'customer_hold', 'weather', 'other') THEN
      RETURN jsonb_build_object('error', 'Pick the reason the job waits.');
    END IF;
    IF v_reason = 'other' AND v_note = '' THEN
      RETURN jsonb_build_object('error', 'Say why the job waits.');
    END IF;
    INSERT INTO public.job_build_waits (job_id, reason, note, marked_by, marked_by_name, since_at)
    VALUES (p_job_id, v_reason, v_note, v_uid, v_name, now())
    ON CONFLICT (job_id) WHERE lifted_at IS NULL DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
      v_words := CASE v_reason
        WHEN 'gc_not_ready' THEN 'the GC is not ready for us'
        WHEN 'materials' THEN 'waiting on materials'
        WHEN 'inspection' THEN 'waiting on an inspection'
        WHEN 'customer_hold' THEN 'the customer asked us to hold'
        WHEN 'weather' THEN 'weather'
        -- The person's own words end the sentence once, with or without a stop of their own.
        ELSE rtrim(v_note, '. ')
      END;
      INSERT INTO public.job_activity_events (job_id, event_type, actor_user_id, summary, detail, financial)
      VALUES (
        p_job_id, 'build_wait_marked', v_uid,
        'Marked the job waiting: ' || v_words || '.'
          || CASE WHEN v_reason <> 'other' AND v_note <> '' THEN ' ' || v_note ELSE '' END,
        jsonb_build_object('reason', v_reason, 'note', v_note, 'source', 'set_job_build_wait'),
        false
      );
    END IF;
    RETURN jsonb_build_object('ok', true, 'waits', true, 'changed', v_rows > 0);
  END IF;

  UPDATE public.job_build_waits
     SET lifted_by = v_uid, lifted_by_name = v_name, lifted_at = now()
   WHERE job_id = p_job_id AND lifted_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    INSERT INTO public.job_activity_events (job_id, event_type, actor_user_id, summary, detail, financial)
    VALUES (
      p_job_id, 'build_wait_lifted', v_uid,
      'Lifted the wait. The job counts on the Build desk again.',
      jsonb_build_object('source', 'set_job_build_wait'),
      false
    );
  END IF;
  RETURN jsonb_build_object('ok', true, 'waits', false, 'changed', v_rows > 0);
END;
$$;

COMMENT ON FUNCTION public.set_job_build_wait(uuid, boolean, text, text) IS
  'The Bridge''s Build desk (v2.8709, punch list #192 write A): mark a job as waiting with a picked reason (other needs words), or lift the wait. Office only; a training account and an archived one change nothing. Each change writes one line on the job''s Activity (build_wait_marked, build_wait_lifted). A second mark on a job that already waits, and a lift on a job that does not, change nothing and say so (changed false). Returns {ok, waits, changed} or {error}.';

REVOKE ALL ON FUNCTION public.set_job_build_wait(uuid, boolean, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_job_build_wait(uuid, boolean, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_job_build_wait(uuid, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_job_build_wait(uuid, boolean, text, text) TO service_role;

-- House rules: training mode writes nothing, a twin writes nothing here, an archived caller reads nothing.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
