SET lock_timeout = '3s';

-- Which court, step 2 (v2.4768, the owner's justice-court plan of 2026-10-06): the
-- office's own layer of justice precincts, drawn or imported on the Map page, and the
-- precinct each property record falls in. Counties come from the geocoder already; this
-- is for precincts only. The kernel (src/lib/legal/courtAreas.ts) classifies a point
-- against the active areas; a point within 100 m of a line names both precincts and
-- asks a person to settle it. Additive and idempotent. One CREATE TABLE.

CREATE TABLE IF NOT EXISTS public.court_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  county text NOT NULL,
  precinct text NOT NULL,
  label text NOT NULL DEFAULT '',
  -- A GeoJSON Polygon or MultiPolygon, [lng, lat] positions, as the Map page draws or the county's file holds it.
  polygon jsonb NOT NULL,
  source text NOT NULL DEFAULT 'drawn' CONSTRAINT court_areas_source_check CHECK (source IN ('drawn', 'imported')),
  -- Where it came from: the county file's URL and date, or who drew it against which map.
  source_note text NOT NULL DEFAULT '',
  drawn_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.court_areas IS
  'The office''s own justice precinct areas (v2.4768): one row per precinct polygon, drawn on the Map page or imported from a county file, each with its source and date. Every property record is classified against the active rows; an address on a line names both precincts for a person to settle.';
COMMENT ON COLUMN public.court_areas.precinct IS 'The county''s own label: 2, 1-2, 3 Place 1 … as the county writes it.';

CREATE INDEX IF NOT EXISTS court_areas_county_idx ON public.court_areas (county) WHERE active;

ALTER TABLE public.court_areas ENABLE ROW LEVEL SECURITY;

DO $policies$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'court_areas' AND policyname = 'court_areas_select') THEN
    CREATE POLICY court_areas_select ON public.court_areas FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'court_areas' AND policyname = 'court_areas_write') THEN
    CREATE POLICY court_areas_write ON public.court_areas FOR ALL TO authenticated
      USING ((SELECT public.is_office_staff())) WITH CHECK ((SELECT public.is_office_staff()));
  END IF;
END
$policies$;

REVOKE ALL ON TABLE public.court_areas FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.court_areas TO authenticated;

-- The precinct on the property record, beside the county and the parcel it already keeps.
ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS jp_precinct text NOT NULL DEFAULT '',
  -- '' = not classified; map = from the office's areas; hand = typed on the record (wins over the map).
  ADD COLUMN IF NOT EXISTS jp_precinct_source text NOT NULL DEFAULT ''
    CONSTRAINT customer_addresses_jp_precinct_source_check CHECK (jp_precinct_source IN ('', 'map', 'hand')),
  -- "2 or 3 — on the line" when the point sits within 100 m of a boundary; '' otherwise.
  ADD COLUMN IF NOT EXISTS jp_precinct_note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS jp_precinct_at timestamp with time zone;

COMMENT ON COLUMN public.customer_addresses.jp_precinct IS 'The justice precinct the property falls in, as the county labels it; '''' until classified.';
COMMENT ON COLUMN public.customer_addresses.jp_precinct_source IS 'map = the office''s court_areas layer; hand = typed on the record, which the nightly classification never overwrites.';
COMMENT ON COLUMN public.customer_addresses.jp_precinct_note IS 'Set when the point is on a line between precincts: both names, for a person to settle.';

-- The fences every new table carries (training mode, read-only statements, digital twins).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
