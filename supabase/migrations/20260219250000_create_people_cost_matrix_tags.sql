-- Tags per person in Cost matrix (People Pay tab)
-- Stored as comma-separated text

CREATE TABLE IF NOT EXISTS public.people_cost_matrix_tags (
  person_name TEXT NOT NULL PRIMARY KEY,
  tags TEXT NOT NULL DEFAULT ''
);

COMMENT ON TABLE public.people_cost_matrix_tags IS 'Tags displayed next to person names in Cost matrix. Comma-separated.';

ALTER TABLE public.people_cost_matrix_tags ENABLE ROW LEVEL SECURITY;

-- Pay access and shared users can read
CREATE POLICY "Cost matrix tags readable by pay and shared users"
ON public.people_cost_matrix_tags
FOR SELECT
USING (
  public.is_pay_approved_master()
  OR public.is_assistant()
  OR public.is_cost_matrix_shared_with_current_user()
);

-- Only pay access users can insert/update/delete
CREATE POLICY "Pay access users can insert cost matrix tags"
ON public.people_cost_matrix_tags
FOR INSERT
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant()
);

CREATE POLICY "Pay access users can update cost matrix tags"
ON public.people_cost_matrix_tags
FOR UPDATE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant()
)
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant()
);

CREATE POLICY "Pay access users can delete cost matrix tags"
ON public.people_cost_matrix_tags
FOR DELETE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant()
);
