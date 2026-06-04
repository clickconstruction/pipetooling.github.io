-- Hours reviewed: per-person per-week tracking for Pay tab "hours reviewed" workflow
-- Dev, pay-approved masters, assistants can mark that they've reviewed a person's hours for a given week

CREATE TABLE public.hours_reviewed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reviewed_by uuid NOT NULL REFERENCES auth.users(id),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(person_name, start_date)
);

CREATE INDEX idx_hours_reviewed_start_date ON public.hours_reviewed(start_date);

COMMENT ON TABLE public.hours_reviewed IS 'Tracks which person-weeks have been marked as reviewed in the Pay tab. person_name + start_date identifies a week.';

ALTER TABLE public.hours_reviewed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can manage hours_reviewed"
ON public.hours_reviewed FOR ALL
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
)
WITH CHECK (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
