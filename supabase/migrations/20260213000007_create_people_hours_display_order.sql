-- Display order for Hours tab rows (shared by all users)
-- Anyone with Hours access can read/write

CREATE TABLE IF NOT EXISTS public.people_hours_display_order (
  person_name TEXT NOT NULL PRIMARY KEY,
  sequence_order INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.people_hours_display_order IS 'Display order for people in Hours tab. Shared by all users.';

ALTER TABLE public.people_hours_display_order ENABLE ROW LEVEL SECURITY;

-- Anyone with Hours access (dev, approved master, or assistant) can manage order
CREATE POLICY "Hours access users can manage display order"
ON public.people_hours_display_order
FOR ALL
USING (
  public.is_pay_approved_master()
  OR public.is_assistant()
)
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant()
);
