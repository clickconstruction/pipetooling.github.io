SET lock_timeout = '3s';

-- A deleted pay application stays in the job's history (v2.4715).
-- Delete removed the row, and the delete-archive trigger that keeps a job's other rows for
-- 90 days is not on this table, so the history could silently lose its first entry. Delete
-- now marks the row instead: `deleted_at` and `deleted_by`, stamped on the server. The live
-- list reads the rows that are not marked; the history reads the marked ones as a quiet line.
-- One live application per number: the unique rule moves to a partial index so a deleted
-- application 1 does not block a new application 1.
ALTER TABLE public.job_pay_applications
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.job_pay_applications
  DROP CONSTRAINT IF EXISTS job_pay_applications_job_number_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS job_pay_applications_job_number_live_uniq
  ON public.job_pay_applications (job_id, application_number)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.job_pay_applications.deleted_at IS
  'When the office took this application off the job (v2.4715), or null while it is live. The window''s Delete marks the row; the history still lists it.';
COMMENT ON COLUMN public.job_pay_applications.deleted_by IS
  'Who took it off the job (v2.4715); stamped on the server with deleted_at.';

-- The stamp trigger: who saved it and when, as before; a change to deleted_at is a delete
-- (or a restore), stamped as such and leaving the saved stamps alone, so the history does not
-- read a delete as "saved again". Replaces the v2.4490 definition in full.
CREATE OR REPLACE FUNCTION public.job_pay_applications_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
    IF NEW.deleted_at IS NOT NULL THEN
      NEW.deleted_at := now();
      NEW.deleted_by := auth.uid();
    ELSE
      NEW.deleted_by := NULL;
    END IF;
    RETURN NEW;
  END IF;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    -- Marked or unmarked: stamp that, keep the saved stamps.
    NEW.updated_by := OLD.updated_by;
    NEW.updated_at := OLD.updated_at;
    IF NEW.deleted_at IS NOT NULL THEN
      NEW.deleted_at := now();
      NEW.deleted_by := auth.uid();
    ELSE
      NEW.deleted_by := NULL;
    END IF;
    RETURN NEW;
  END IF;
  NEW.deleted_by := OLD.deleted_by;
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.job_pay_applications_stamp() FROM PUBLIC, anon, authenticated;
