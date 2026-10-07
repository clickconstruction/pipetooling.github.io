SET lock_timeout = '3s';

-- The lines of a pay application (v2.4498).
-- An application had one line, typed into five form fields kept in `fields`. The continuation
-- sheet has a row per piece of the contract, so an application now carries a list: each line's
-- name, scheduled value, work from previous applications, work this period and stored material,
-- with an id that stays the same from one application to the next. `split_labor_material` says
-- whether each line prints as a labor row and a material row. An application saved before this
-- keeps an empty list and reads as its one line from `fields`.
ALTER TABLE public.job_pay_applications
  ADD COLUMN IF NOT EXISTS lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS split_labor_material boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_pay_applications_lines_array') THEN
    ALTER TABLE public.job_pay_applications
      ADD CONSTRAINT job_pay_applications_lines_array CHECK (jsonb_typeof(lines) = 'array');
  END IF;
END $$;

COMMENT ON COLUMN public.job_pay_applications.lines IS
  'The G703''s lines (v2.4498): [{ id, label, scheduledValue, labor, stage, fromPrevious, thisPeriod, stored }]. Empty on an application saved before lines, which reads as one line from fields.';
COMMENT ON COLUMN public.job_pay_applications.split_labor_material IS
  'Print each line as a labor row and a material row (v2.4498).';
