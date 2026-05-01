-- Extend address_geocodes map RLS to estimator (with dev, master_technician, assistant).

COMMENT ON TABLE public.address_geocodes IS 'Cached lat/lng for normalized address strings. RLS: dev, master_technician, assistant, estimator; used by /map.';

DROP POLICY IF EXISTS "Map roles can read address geocodes" ON public.address_geocodes;
DROP POLICY IF EXISTS "Map roles can insert address geocodes" ON public.address_geocodes;
DROP POLICY IF EXISTS "Map roles can update address geocodes" ON public.address_geocodes;
DROP POLICY IF EXISTS "Map roles can delete address geocodes" ON public.address_geocodes;

CREATE POLICY "Map roles can read address geocodes"
ON public.address_geocodes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Map roles can insert address geocodes"
ON public.address_geocodes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Map roles can update address geocodes"
ON public.address_geocodes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Map roles can delete address geocodes"
ON public.address_geocodes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);
