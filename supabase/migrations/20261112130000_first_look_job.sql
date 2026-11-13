SET lock_timeout = '3s';

-- The look follows the job (punch list #319 PR 6, v2.7005). When a job is made from a look, by the accept of its
-- estimate, by Create job, or by Book a visit on the look's card, the look remembers the job. Then its Drive folder
-- moves under the job, and whoever may see the job's photos may see what the customer sent before the visit.
-- No new table, so no fence call.
--
--   1. first_looks.job_id (to jobs_ledger, ON DELETE SET NULL) and drive_job_folder_at, the stamp the sweep sets once
--      the look's Drive folder sits under the job.
--   2. A trigger on estimates: when an estimate that remembers a look gains its job (estimates.job_ledger_id, set by
--      create_job_from_estimate and by the accept's auto-create), the look takes the job. It never raises: an estimate's
--      write must not fail because of a look.
--   3. set_first_look_job(p_look_id, p_job_id): the same stamp for Book a visit, where there is no estimate. The office
--      team only.
--   4. Who reads a look with a job: whoever may report on that job (can_report_stage_progress, the gate on the job's
--      own photos): the office, and a field user on the job's team or clocked in on it. On both tables and on the
--      bucket, so the Job Mode card draws the photos and plays the video.

ALTER TABLE public.first_looks ADD COLUMN IF NOT EXISTS job_id uuid;
ALTER TABLE public.first_looks ADD COLUMN IF NOT EXISTS drive_job_folder_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'first_looks_job_id_fkey' AND conrelid = 'public.first_looks'::regclass) THEN
    ALTER TABLE public.first_looks
      ADD CONSTRAINT first_looks_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs_ledger(id) ON DELETE SET NULL NOT VALID;
  END IF;
END;
$$;
ALTER TABLE public.first_looks VALIDATE CONSTRAINT first_looks_job_id_fkey;

COMMENT ON COLUMN public.first_looks.job_id IS
  'First look (punch list #319 PR 6): the job made from this look. Set by the trigger on estimates when the look''s estimate gains its job, or by set_first_look_job from Book a visit.';

CREATE INDEX IF NOT EXISTS first_looks_job_idx ON public.first_looks (job_id) WHERE job_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.first_look_follows_estimate_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.job_ledger_id IS NOT NULL AND NEW.first_look_id IS NOT NULL THEN
    BEGIN
      UPDATE public.first_looks SET job_id = NEW.job_ledger_id WHERE id = NEW.first_look_id AND job_id IS NULL;
    EXCEPTION WHEN OTHERS THEN
      -- An estimate's write never fails because of a look.
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.first_look_follows_estimate_job() IS
  'First look (punch list #319 PR 6): when an estimate that remembers a look gains its job, the look takes the job. Never raises.';

DROP TRIGGER IF EXISTS estimates_first_look_follows_job ON public.estimates;
CREATE TRIGGER estimates_first_look_follows_job
  AFTER INSERT OR UPDATE OF job_ledger_id, first_look_id ON public.estimates
  FOR EACH ROW
  WHEN (NEW.job_ledger_id IS NOT NULL AND NEW.first_look_id IS NOT NULL)
  EXECUTE FUNCTION public.first_look_follows_estimate_job();

CREATE OR REPLACE FUNCTION public.set_first_look_job(p_look_id uuid, p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot tie a look to a job.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot tie a look to a job.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office can tie a look to a job.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id) THEN
    RAISE EXCEPTION 'That job is not there.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.first_looks SET job_id = p_job_id WHERE id = p_look_id AND job_id IS NULL;
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.set_first_look_job(uuid, uuid) IS
  'First look (punch list #319 PR 6): ties a look to the job Book a visit made from it. Keeps the first job. The office team only.';

REVOKE ALL ON FUNCTION public.set_first_look_job(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_first_look_job(uuid, uuid) TO authenticated;

-- Whoever may report on the job reads its look: beside the office team's own policy, never in place of it.
DROP POLICY IF EXISTS first_looks_select_job_team ON public.first_looks;
CREATE POLICY first_looks_select_job_team ON public.first_looks FOR SELECT TO authenticated
  USING (job_id IS NOT NULL AND public.can_report_stage_progress(job_id));

DROP POLICY IF EXISTS first_look_files_select_job_team ON public.first_look_files;
CREATE POLICY first_look_files_select_job_team ON public.first_look_files FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.first_looks l
    WHERE l.id = first_look_files.look_id AND l.job_id IS NOT NULL AND public.can_report_stage_progress(l.job_id)
  ));

DROP POLICY IF EXISTS first_look_files_select_job_team ON storage.objects;
CREATE POLICY first_look_files_select_job_team ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'first-look-files'
    AND EXISTS (
      SELECT 1 FROM public.first_looks l
      WHERE l.id::text = (storage.foldername(name))[1] AND l.job_id IS NOT NULL AND public.can_report_stage_progress(l.job_id)
    )
  );
