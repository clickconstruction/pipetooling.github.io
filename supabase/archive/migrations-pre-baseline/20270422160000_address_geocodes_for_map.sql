-- Deduplicated geocode cache for dev Map page. Populated by Edge geocode-address-batch.

CREATE TABLE public.address_geocodes (
  address_normalized text NOT NULL PRIMARY KEY,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  geocoded_at timestamptz NOT NULL DEFAULT now(),
  geocode_error text
);

COMMENT ON TABLE public.address_geocodes IS 'Cached lat/lng for normalized address strings. Dev-only RLS; used by /map.';

CREATE INDEX address_geocodes_geocoded_at_idx ON public.address_geocodes (geocoded_at DESC);

ALTER TABLE public.address_geocodes ENABLE ROW LEVEL SECURITY;

-- Dev-only: map and geocoding are internal tools; expand policies if /map is opened to more roles.
CREATE POLICY "Devs can read address geocodes"
ON public.address_geocodes
FOR SELECT
USING (public.is_dev());

CREATE POLICY "Devs can insert address geocodes"
ON public.address_geocodes
FOR INSERT
WITH CHECK (public.is_dev());

CREATE POLICY "Devs can update address geocodes"
ON public.address_geocodes
FOR UPDATE
USING (public.is_dev())
WITH CHECK (public.is_dev());

CREATE POLICY "Devs can delete address geocodes"
ON public.address_geocodes
FOR DELETE
USING (public.is_dev());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.address_geocodes TO authenticated;
