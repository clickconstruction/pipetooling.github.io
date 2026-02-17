-- Pay Approved Masters: dev selects which masters can access Pay and Hours tabs on People page
-- Approved masters and their assistants get Hours access; only dev and approved masters see Pay

CREATE TABLE IF NOT EXISTS public.pay_approved_masters (
  master_id UUID NOT NULL PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pay_approved_masters_master_id ON public.pay_approved_masters(master_id);

ALTER TABLE public.pay_approved_masters ENABLE ROW LEVEL SECURITY;

-- Helper: true if current user is dev or is in pay_approved_masters
CREATE OR REPLACE FUNCTION public.is_pay_approved_master()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.is_dev()
  OR EXISTS (SELECT 1 FROM public.pay_approved_masters WHERE master_id = auth.uid());
$$;

-- Helper: true if current user is assistant of a pay-approved master
CREATE OR REPLACE FUNCTION public.is_assistant_of_pay_approved_master()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.master_assistants ma
    JOIN public.pay_approved_masters pam ON pam.master_id = ma.master_id
    WHERE ma.assistant_id = auth.uid()
  );
$$;

-- Dev can do everything
CREATE POLICY "Devs can manage pay approved masters"
ON public.pay_approved_masters
FOR ALL
USING (public.is_dev())
WITH CHECK (public.is_dev());

-- Dev and approved masters can read (to check access)
CREATE POLICY "Devs and approved masters can read pay approved masters"
ON public.pay_approved_masters
FOR SELECT
USING (
  public.is_dev()
  OR master_id = auth.uid()
);

COMMENT ON TABLE public.pay_approved_masters IS 'Masters approved by dev to access Pay and Hours tabs on People page. Their assistants can enter hours.';
