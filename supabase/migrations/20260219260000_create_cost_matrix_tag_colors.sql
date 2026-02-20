-- Tag colors for Cost matrix tags (e.g. "estimator" = blue)
-- Tag names are case-sensitive and must match exactly

CREATE TABLE IF NOT EXISTS public.cost_matrix_tag_colors (
  tag TEXT NOT NULL PRIMARY KEY,
  color TEXT NOT NULL DEFAULT '#e5e7eb'
);

COMMENT ON TABLE public.cost_matrix_tag_colors IS 'Background color for each tag in Cost matrix. Hex or CSS color.';

ALTER TABLE public.cost_matrix_tag_colors ENABLE ROW LEVEL SECURITY;

-- Pay access and shared users can read
CREATE POLICY "Tag colors readable by pay and shared users"
ON public.cost_matrix_tag_colors
FOR SELECT
USING (
  public.is_pay_approved_master()
  OR public.is_assistant()
  OR public.is_cost_matrix_shared_with_current_user()
);

-- Only pay access users can insert/update/delete
CREATE POLICY "Pay access users can insert tag colors"
ON public.cost_matrix_tag_colors
FOR INSERT
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant()
);

CREATE POLICY "Pay access users can update tag colors"
ON public.cost_matrix_tag_colors
FOR UPDATE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant()
)
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant()
);

CREATE POLICY "Pay access users can delete tag colors"
ON public.cost_matrix_tag_colors
FOR DELETE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant()
);
