SET lock_timeout = '3s';

-- A name for a saved pay application (v2.4508).
-- The window's list showed a saved application by its number, period and payment due. The office
-- asked to name the ones it saves ("Sent to the GC", "Revised after the walk"), and to change
-- the name later. The name is the office's own note: it is not printed on the G702 or the G703.
ALTER TABLE public.job_pay_applications
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_pay_applications_name_length') THEN
    ALTER TABLE public.job_pay_applications
      ADD CONSTRAINT job_pay_applications_name_length CHECK (char_length(name) <= 80);
  END IF;
END $$;

COMMENT ON COLUMN public.job_pay_applications.name IS
  'The office''s name for this saved application (v2.4508), or ''''. Shown in the window''s list and on the job''s Documents tab; never printed on the form.';
