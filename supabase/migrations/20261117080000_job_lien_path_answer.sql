SET lock_timeout = '3s';

-- A job can leave the lien path for its own reason (the owner's ask of 2026-11-16, on a job whose one bill was three
-- trips to pick up checks that were not there: money that is not for labor or materials on the property, so most
-- likely no lien secures it).
--
-- Until now a job left the Lien desk three ways, and none of them says this. Paid. Uncollectible, which writes the
-- money off. Or its whole property answered public (20261116221500), which is about the land and not the job. A job
-- that should be collected another way stayed in the bins, its notice one signature from the mail.
--
-- 1 · The answer lives on the job. NULL means the job is on the lien path, as every job is today. 'off_path' means a
--     person took it off: the Lien desk leaves it out of its bins and its run, and shows it apart with the reason.
--     Who, when and why sit beside it, and stay there when the job is put back, as who put it back, when and why.
-- 2 · One function writes it, for the lien office, with a line on the job's activity each time the answer changes.
--     On the way off it can also put the job on the attorney's list through the Collections flag that already
--     exists, under that flag's own rules, and it names what the flag refused.
--
-- Nothing here files, voids or deletes a lien paper. The desk items stay as they are, so putting the job back brings
-- its papers back where they stood.
--
-- Additive and idempotent. No CREATE TABLE, so no fence calls: jobs_ledger already carries the read-only blocks, the
-- twin fence and the archived seal, and those triggers fire inside this SECURITY DEFINER function, so training mode is
-- refused here as everywhere. Nothing reads the columns or calls the function until the client that follows, so the
-- push can come any time after the merge.

-- ---------- 1 · the answer on the job ----------

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS lien_path_answer text,
  ADD COLUMN IF NOT EXISTS lien_path_answered_at timestamptz,
  ADD COLUMN IF NOT EXISTS lien_path_answered_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lien_path_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_ledger_lien_path_answer_check') THEN
    ALTER TABLE public.jobs_ledger ADD CONSTRAINT jobs_ledger_lien_path_answer_check
      CHECK (lien_path_answer IS NULL OR lien_path_answer = 'off_path');
  END IF;
END $$;

COMMENT ON COLUMN public.jobs_ledger.lien_path_answer IS
  'Is this job on the lien path? NULL = yes, as every job is until a person says otherwise. ''off_path'' = a person took it off for a reason of its own (the money is not for labor or materials on the property, for one): the Lien desk leaves it out of its bins and its run. Nothing is filed, voided or deleted. Written only by set_job_lien_path_answer.';
COMMENT ON COLUMN public.jobs_ledger.lien_path_answered_at IS
  'When the job was last taken off the lien path, or last put back on it.';
COMMENT ON COLUMN public.jobs_ledger.lien_path_answered_by IS
  'Who last took the job off the lien path, or put it back (users.id).';
COMMENT ON COLUMN public.jobs_ledger.lien_path_reason IS
  'Why, in the person''s words: why the job is off the lien path, or why it went back on.';

-- ---------- 2 · the press ----------

-- p_answer: 'off_path', or 'on_path' (puts the job back). A reason is required both ways.
-- p_attorney_list: for 'off_path' only, true also puts the job on the attorney's list (the Collections flag), with
--   the reason as its note. The flag's own rules decide (a job must be billed); what it refuses is named in `held`,
--   and the job is off the lien path all the same.
-- Returns { ok, answer, changed, on_attorney_list, already_on_list, held } or { error }.
CREATE OR REPLACE FUNCTION public.set_job_lien_path_answer(
  p_job_id uuid,
  p_answer text,
  p_reason text DEFAULT NULL,
  p_attorney_list boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_role text;
  v_found boolean := false;
  v_old text;
  v_old_reason text;
  v_collections_at timestamptz;
  v_new text;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_changed boolean := false;
  v_flag jsonb;
  v_on_list boolean := false;
  v_already boolean := false;
  v_held text := NULL;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- The lien office: the seats that draft, send and run lien papers (isLienOffice in src/lib/jobs/lienDesk.ts).
  SELECT u.role INTO v_role FROM public.users u WHERE u.id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('dev', 'master_technician', 'assistant', 'controller') THEN
    RETURN jsonb_build_object('error', 'Not authorized to take a job off the lien path');
  END IF;

  IF p_answer IS NULL OR p_answer NOT IN ('off_path', 'on_path') THEN
    RETURN jsonb_build_object('error', 'The answer must be off_path or on_path');
  END IF;
  v_new := NULLIF(p_answer, 'on_path');

  SELECT true, jl.lien_path_answer, jl.lien_path_reason, jl.collections_at
    INTO v_found, v_old, v_old_reason, v_collections_at
  FROM public.jobs_ledger jl
  WHERE jl.id = p_job_id
  FOR UPDATE;
  IF NOT COALESCE(v_found, false) THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  IF v_new = 'off_path' AND v_reason IS NULL THEN
    RETURN jsonb_build_object('error', 'Say why this job is off the lien path');
  END IF;
  IF v_new IS NULL AND v_old = 'off_path' AND v_reason IS NULL THEN
    RETURN jsonb_build_object('error', 'Say why this job goes back on the lien path');
  END IF;

  -- A job that was never taken off has nothing to put back: no stamp, no line.
  -- The same answer with the same reason is the same press twice: no second stamp, no second line.
  IF v_new IS DISTINCT FROM v_old OR (v_new = 'off_path' AND v_reason IS DISTINCT FROM v_old_reason) THEN
    v_changed := true;
    UPDATE public.jobs_ledger
       SET lien_path_answer = v_new,
           lien_path_answered_at = now(),
           lien_path_answered_by = auth.uid(),
           lien_path_reason = v_reason,
           updated_at = now()
     WHERE id = p_job_id;

    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    VALUES (
      p_job_id,
      'lien_path_change',
      now(),
      auth.uid(),
      CASE WHEN v_new = 'off_path'
        THEN 'Taken off the lien path — ' || v_reason
        ELSE 'Put back on the lien path — ' || v_reason
      END,
      jsonb_build_object('answer', v_new, 'reason', v_reason),
      true
    );
  END IF;

  IF v_new = 'off_path' AND COALESCE(p_attorney_list, false) THEN
    IF v_collections_at IS NOT NULL THEN
      v_on_list := true;
      v_already := true;
    ELSE
      -- The attorney's list is the Collections flag that already exists: its own rules decide (a job must be
      -- billed), and what it refuses is named while the job leaves the lien path all the same.
      v_flag := public.set_job_collections_flag(p_job_id, true, v_reason);
      IF v_flag ? 'error' THEN
        v_held := v_flag->>'error';
      ELSE
        v_on_list := true;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'answer', v_new,
    'changed', v_changed,
    'on_attorney_list', v_on_list,
    'already_on_list', v_already,
    'held', v_held
  );
END;
$function$;

ALTER FUNCTION public.set_job_lien_path_answer(uuid, text, text, boolean) OWNER TO postgres;

COMMENT ON FUNCTION public.set_job_lien_path_answer(uuid, text, text, boolean) IS
  'Takes one job off the lien path for a reason of its own, or puts it back (jobs_ledger.lien_path_answer), for the lien office (dev, master_technician, assistant, controller). A reason is required both ways, and each change writes a lien_path_change line on the job''s activity. On the way off it can put the job on the attorney''s list through set_job_collections_flag, naming what that flag refused. Nothing is filed, voided or deleted.';

REVOKE ALL ON FUNCTION public.set_job_lien_path_answer(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_job_lien_path_answer(uuid, text, text, boolean) TO authenticated;
