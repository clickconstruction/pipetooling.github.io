-- Fix cost_estimates RLS to match bids table access pattern
-- Allow all dev/master/assistant/estimator users to access cost estimates

-- Drop existing policies
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read cost estimates" ON public.cost_estimates;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert cost estimates" ON public.cost_estimates;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update cost estimates" ON public.cost_estimates;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete cost estimates" ON public.cost_estimates;

-- Create simplified policies matching bids table pattern
CREATE POLICY "Devs, masters, assistants, and estimators can read cost estimates"
ON public.cost_estimates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert cost estimates"
ON public.cost_estimates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update cost estimates"
ON public.cost_estimates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete cost estimates"
ON public.cost_estimates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

COMMENT ON TABLE public.cost_estimates IS 'Cost estimates for bids; accessible to all dev/master/assistant/estimator users (matches bids access pattern).';
