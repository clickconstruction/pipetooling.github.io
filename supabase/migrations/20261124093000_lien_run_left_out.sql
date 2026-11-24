SET lock_timeout = '3s';

-- Lien desk: a paper left out of the run, and who left it out (v2.8474, punch list #362, step 5).
--
-- The run is every lien paper due by the day the Board's first tile counts to. Its first step, *Get it right*, lists
-- each paper that still asks a question, and each line carries **Leave out**, so one stuck paper never holds the
-- rest. This table is where a left-out paper is remembered: one row each time a person leaves a paper out of a run,
-- with the run's day, the reason they picked, their words, who and when. Every office seat reads the same rows.
--
-- The rule the rows serve, kept in the client's kernel (`src/lib/jobs/lienLeftOut.ts`):
--   - a row that is not put back, for this run's day or a later one: the paper is left out of this run;
--   - a row that is not put back, for an earlier run's day: the next run asks about the paper again, first on its
--     list, with the old reason. It is neither taken into that run nor left out of it until a person answers.
-- So a paper is never carried into a run nobody looked at, and never stays out of every run with nobody asked.
--
-- A paper is a job's notice or a job's affidavit, named by (job_id, paper): a paper may have no desk item yet (a notice
-- that still needs its owner of record), so the row cannot hang on `job_lien_desk_items`.
--
-- Rows are written by one function and never changed but for the put-back stamp; nothing deletes one. Leaving a paper
-- out changes nothing about the paper: it stays in its bin with its own day, and no notice, affidavit or filing is
-- touched. Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.lien_run_left_out (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  -- Which of the job's papers: its § 53.056 notice or its § 53.052 affidavit.
  paper text NOT NULL CHECK (paper IN ('notice', 'affidavit')),
  -- The day the run counted to when the paper was left out.
  run_day date NOT NULL,
  -- The reason the person picked; 'other' needs their words in `note`.
  reason text NOT NULL CHECK (reason IN ('fact_not_in_time', 'leader_not_in_time', 'customer_paying', 'ask_attorney', 'other')),
  note text NOT NULL DEFAULT '',
  left_out_by uuid NOT NULL REFERENCES public.users(id),
  left_out_at timestamptz NOT NULL DEFAULT now(),
  -- Put back in the run: who and when. Both or neither.
  put_back_by uuid REFERENCES public.users(id),
  put_back_at timestamptz,
  CONSTRAINT lien_run_left_out_other_has_words CHECK (reason <> 'other' OR length(btrim(note)) > 0),
  CONSTRAINT lien_run_left_out_put_back_pair CHECK ((put_back_at IS NULL) = (put_back_by IS NULL))
);

COMMENT ON TABLE public.lien_run_left_out IS
  'Lien desk (v2.8474, punch list #362): a lien paper (a job''s notice or affidavit) left out of the run that counted to run_day, with the reason picked, the person''s words, who and when. A row not put back for an earlier run_day makes the next run ask again. Written only by set_lien_run_left_out; the lien office reads it.';

-- One standing leave-out a paper and run: the same press twice writes one row.
CREATE UNIQUE INDEX IF NOT EXISTS lien_run_left_out_live_key
  ON public.lien_run_left_out (job_id, paper, run_day)
  WHERE put_back_at IS NULL;

ALTER TABLE public.lien_run_left_out ENABLE ROW LEVEL SECURITY;

-- The lien office reads (dev, assistant-like, a master), as it reads job_lien_desk_items. No policy writes: the
-- function below is the only way in, so who and when are the server's and never typed.
DROP POLICY IF EXISTS lien_run_left_out_select_office ON public.lien_run_left_out;
CREATE POLICY lien_run_left_out_select_office
  ON public.lien_run_left_out FOR SELECT TO authenticated
  USING (
    (SELECT public.is_dev())
    OR (SELECT public.is_assistant())
    OR (SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician'))
  );

REVOKE ALL ON TABLE public.lien_run_left_out FROM anon;
REVOKE ALL ON TABLE public.lien_run_left_out FROM authenticated;
GRANT SELECT ON TABLE public.lien_run_left_out TO authenticated;
GRANT ALL ON TABLE public.lien_run_left_out TO service_role;

-- Leave a paper out of a run, or put it back. Answers { ok, left_out, changed } or { error } with nothing written.
CREATE OR REPLACE FUNCTION public.set_lien_run_left_out(
  p_job_id uuid,
  p_paper text,
  p_run_day date,
  p_left_out boolean,
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
  v_note text := btrim(COALESCE(p_note, ''));
  v_rows integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  IF NOT (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_uid AND u.role = 'master_technician')
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized to leave a lien paper out of the run');
  END IF;
  IF p_paper IS NULL OR p_paper NOT IN ('notice', 'affidavit') THEN
    RETURN jsonb_build_object('error', 'The paper must be notice or affidavit');
  END IF;
  IF p_left_out IS NULL THEN
    RETURN jsonb_build_object('error', 'Say whether the paper is left out or put back');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id) THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  IF p_left_out THEN
    IF p_run_day IS NULL THEN
      RETURN jsonb_build_object('error', 'Say which run the paper is left out of');
    END IF;
    IF v_reason NOT IN ('fact_not_in_time', 'leader_not_in_time', 'customer_paying', 'ask_attorney', 'other') THEN
      RETURN jsonb_build_object('error', 'Pick a reason to leave this paper out');
    END IF;
    IF v_reason = 'other' AND v_note = '' THEN
      RETURN jsonb_build_object('error', 'Say why this paper is left out');
    END IF;
    INSERT INTO public.lien_run_left_out (job_id, paper, run_day, reason, note, left_out_by, left_out_at)
    VALUES (p_job_id, p_paper, p_run_day, v_reason, v_note, v_uid, now())
    ON CONFLICT (job_id, paper, run_day) WHERE put_back_at IS NULL DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN jsonb_build_object('ok', true, 'left_out', true, 'changed', v_rows > 0);
  END IF;

  -- Put back: every standing leave-out of this paper, whatever run it was for, so no older one asks again.
  UPDATE public.lien_run_left_out
     SET put_back_by = v_uid, put_back_at = now()
   WHERE job_id = p_job_id AND paper = p_paper AND put_back_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'left_out', false, 'changed', v_rows > 0);
END;
$$;

COMMENT ON FUNCTION public.set_lien_run_left_out(uuid, text, date, boolean, text, text) IS
  'Lien desk (v2.8474): leave a job''s notice or affidavit out of the run that counts to p_run_day, with a picked reason (other needs words), or put it back, which stamps every standing leave-out of that paper. The lien office only. Changes nothing about the paper itself.';

REVOKE ALL ON FUNCTION public.set_lien_run_left_out(uuid, text, date, boolean, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_lien_run_left_out(uuid, text, date, boolean, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_lien_run_left_out(uuid, text, date, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_lien_run_left_out(uuid, text, date, boolean, text, text) TO service_role;

-- House rules: training mode writes nothing, a twin writes nothing here, an archived caller reads nothing.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
