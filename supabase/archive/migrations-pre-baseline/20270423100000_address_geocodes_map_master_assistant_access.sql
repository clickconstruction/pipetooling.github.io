-- Extend address_geocodes RLS to master_technician and assistant (with dev) for /map and geocode Edge Functions.

COMMENT ON TABLE public.address_geocodes IS 'Cached lat/lng for normalized address strings. RLS: dev, master_technician, assistant; used by /map.';

DROP POLICY IF EXISTS "Devs can read address geocodes" ON public.address_geocodes;
DROP POLICY IF EXISTS "Devs can insert address geocodes" ON public.address_geocodes;
DROP POLICY IF EXISTS "Devs can update address geocodes" ON public.address_geocodes;
DROP POLICY IF EXISTS "Devs can delete address geocodes" ON public.address_geocodes;

CREATE POLICY "Map roles can read address geocodes"
ON public.address_geocodes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Map roles can insert address geocodes"
ON public.address_geocodes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Map roles can update address geocodes"
ON public.address_geocodes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Map roles can delete address geocodes"
ON public.address_geocodes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
  )
);
