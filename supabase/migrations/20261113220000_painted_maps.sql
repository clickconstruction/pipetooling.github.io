SET lock_timeout = '3s';

-- v2.7202 (punch list #345, PR 1): a painted map.
--
-- A street address cannot say which gate, where to park, or where the meter is. A painted map can: lines somebody
-- walked, drove or drew by hand on the view from above, and named places with a word and a photo. It hangs on a
-- job, on a development (so every lot shares one way in), or on nothing yet.
--
--   1. painted_maps        — the map: a name, a line of words, and its home.
--   2. painted_map_lines   — one stroke: its points, how it was made, its length and how sure that length is.
--   3. painted_map_places  — a named dot with a word for whoever comes next, and a photo.
--   4. The gate: you may read and add to a map when you can open its job (Materials on site's own gate), when you
--      can see its development or a job in it, or, for a map tied to nothing, when you made it or work in the office.
--   5. The bucket painted-map-photos, where a place's photo lives.
--
-- A saved line is a shape. `points` holds pairs of numbers and nothing else: no clock along the line, so a line
-- cannot say how fast anyone walked or how long they stood. Nothing follows a phone here; the walking is a later PR
-- and happens on the phone, and only the line the person confirms is ever written.
--
-- No screen reads or writes these yet. Idempotent: IF NOT EXISTS, CREATE OR REPLACE, and every policy is dropped
-- before it is made.

-- 1. The map.
CREATE TABLE IF NOT EXISTS public.painted_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(TRIM(name)) BETWEEN 1 AND 80),
  words text NOT NULL DEFAULT '' CHECK (length(words) <= 200),
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  development_id uuid REFERENCES public.developments(id) ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT painted_maps_one_home_check CHECK (job_id IS NULL OR development_id IS NULL)
);
CREATE INDEX IF NOT EXISTS painted_maps_job_idx ON public.painted_maps (job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS painted_maps_development_idx ON public.painted_maps (development_id) WHERE development_id IS NOT NULL;
COMMENT ON TABLE public.painted_maps IS 'Paint a map (#345): a named map of lines and places, on a job, on a development, or on nothing yet. Never both homes at once.';
COMMENT ON COLUMN public.painted_maps.words IS 'One line under the name, in the painter''s words ("Start at the truck gate, not the sales entrance"). Empty when nobody said.';
COMMENT ON COLUMN public.painted_maps.job_id IS 'The job this map is for. Set null when the job goes, so the map is kept for its maker and the office.';
COMMENT ON COLUMN public.painted_maps.development_id IS 'The development this map is for: it then shows on every job in it.';

-- 2. A line.
CREATE TABLE IF NOT EXISTS public.painted_map_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES public.painted_maps(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '' CHECK (length(label) <= 80),
  how text NOT NULL CHECK (how IN ('walked', 'driven', 'drawn')),
  points jsonb NOT NULL,
  poor_parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  fixed_by_hand boolean NOT NULL DEFAULT false,
  length_m double precision NOT NULL CHECK (length_m >= 0),
  margin_m double precision CHECK (margin_m IS NULL OR margin_m >= 0),
  measured_ft numeric(9, 1) CHECK (measured_ft IS NULL OR measured_ft > 0),
  measured_how text CHECK (measured_how IS NULL OR measured_how IN ('wheel', 'tape', 'other')),
  made_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  made_at timestamptz NOT NULL DEFAULT now(),
  -- A CASE, not an AND: the length of something that is not a list is an error, and an AND may ask for it first.
  CONSTRAINT painted_map_lines_points_check CHECK (
    CASE WHEN jsonb_typeof(points) = 'array' THEN jsonb_array_length(points) BETWEEN 2 AND 5000 ELSE false END
  ),
  CONSTRAINT painted_map_lines_poor_parts_check CHECK (
    CASE WHEN jsonb_typeof(poor_parts) = 'array' THEN jsonb_array_length(poor_parts) <= 200 ELSE false END
  ),
  -- A measured length says how it was measured, and a way of measuring never stands without its number.
  CONSTRAINT painted_map_lines_measured_whole_check CHECK ((measured_ft IS NULL) = (measured_how IS NULL))
);
CREATE INDEX IF NOT EXISTS painted_map_lines_map_idx ON public.painted_map_lines (map_id, made_at);
COMMENT ON TABLE public.painted_map_lines IS 'Paint a map (#345): one stroke of a painted map. A shape and how it was made; no clock along it.';
COMMENT ON COLUMN public.painted_map_lines.how IS 'walked or driven = read from a phone that was moving; drawn = pressed out by hand on the view from above.';
COMMENT ON COLUMN public.painted_map_lines.points IS 'The line: a list of [latitude, longitude] pairs, 2 to 5000 of them, six decimals. Pairs only: no time, no speed, no margin for each point.';
COMMENT ON COLUMN public.painted_map_lines.poor_parts IS 'The stretches the phone was not sure of: a list of [from, to] indexes into points. Drawn faint and left out of the length.';
COMMENT ON COLUMN public.painted_map_lines.fixed_by_hand IS 'True when part of a walked or driven line was redrawn by hand, so nobody takes that part for a reading.';
COMMENT ON COLUMN public.painted_map_lines.length_m IS 'The line''s length in metres along its sure parts.';
COMMENT ON COLUMN public.painted_map_lines.margin_m IS 'The give or take on that length, in metres. Null when nothing is known about it.';
COMMENT ON COLUMN public.painted_map_lines.measured_ft IS 'A length somebody measured with a wheel or a tape and typed in, in feet. It is shown in place of length_m.';

-- 3. A place.
CREATE TABLE IF NOT EXISTS public.painted_map_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES public.painted_maps(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(TRIM(name)) BETWEEN 1 AND 80),
  words text NOT NULL DEFAULT '' CHECK (length(words) <= 200),
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  accuracy_m integer CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  photo_path text CHECK (photo_path IS NULL OR length(photo_path) BETWEEN 1 AND 300),
  set_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  set_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS painted_map_places_map_idx ON public.painted_map_places (map_id, set_at);
COMMENT ON TABLE public.painted_map_places IS 'Paint a map (#345): a named dot on a painted map, with a word for whoever comes next and a photo.';
COMMENT ON COLUMN public.painted_map_places.accuracy_m IS 'The phone''s margin in metres when the place was set from where the painter stood. Null when the dot was placed or moved by hand.';
COMMENT ON COLUMN public.painted_map_places.photo_path IS 'The place''s photo, an object name in the painted-map-photos bucket (<map id>/<file>.jpg). Null with no photo.';

-- 4. The gate.
-- A helper or a subcontractor reaches a job through its team list and cannot read the ledger, so "am I on a job of
-- this development" has to be answered for them. SECURITY DEFINER, and it answers only yes or no about the caller.
CREATE OR REPLACE FUNCTION public.painted_map_on_development_team(p_development_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND p_development_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.jobs_ledger_team_members m
    JOIN public.jobs_ledger j ON j.id = m.job_id
    WHERE m.user_id = auth.uid() AND j.development_id = p_development_id
  )
$$;
REVOKE ALL ON FUNCTION public.painted_map_on_development_team(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painted_map_on_development_team(uuid) TO authenticated;
COMMENT ON FUNCTION public.painted_map_on_development_team(uuid) IS 'Paint a map (#345): true when the caller is on the team of a job in this development. Yes or no about the caller, nothing else.';

-- SECURITY INVOKER on purpose: the reads of jobs_ledger and developments run under the caller's own RLS, so a
-- primary keeps their scope and nobody sees a map for a job they cannot open.
CREATE OR REPLACE FUNCTION public.painted_map_can_touch(p_job_id uuid, p_development_id uuid, p_created_by uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND CASE
    WHEN p_job_id IS NOT NULL THEN public.on_site_can_touch_job(p_job_id)
    WHEN p_development_id IS NOT NULL THEN
      EXISTS (SELECT 1 FROM public.developments d WHERE d.id = p_development_id)
      OR EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.development_id = p_development_id)
      OR public.painted_map_on_development_team(p_development_id)
    ELSE p_created_by = auth.uid() OR public.is_office_staff()
  END
$$;
COMMENT ON FUNCTION public.painted_map_can_touch(uuid, uuid, uuid) IS 'Paint a map (#345): may the caller read and add to a map with this home? Its job as Materials on site gates one, its development when they can see it or a job in it, and a map tied to nothing when they made it or work in the office.';

ALTER TABLE public.painted_maps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS painted_maps_select ON public.painted_maps;
CREATE POLICY painted_maps_select ON public.painted_maps FOR SELECT TO authenticated
  USING (public.painted_map_can_touch(job_id, development_id, created_by));
DROP POLICY IF EXISTS painted_maps_insert ON public.painted_maps;
CREATE POLICY painted_maps_insert ON public.painted_maps FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.painted_map_can_touch(job_id, development_id, created_by));
-- Renaming a map, moving it to another home and throwing it away are its maker's and the office's.
DROP POLICY IF EXISTS painted_maps_update ON public.painted_maps;
CREATE POLICY painted_maps_update ON public.painted_maps FOR UPDATE TO authenticated
  USING ((created_by = auth.uid() OR public.is_office_staff()) AND public.painted_map_can_touch(job_id, development_id, created_by))
  WITH CHECK ((created_by = auth.uid() OR public.is_office_staff()) AND public.painted_map_can_touch(job_id, development_id, created_by));
DROP POLICY IF EXISTS painted_maps_delete ON public.painted_maps;
CREATE POLICY painted_maps_delete ON public.painted_maps FOR DELETE TO authenticated
  USING ((created_by = auth.uid() OR public.is_office_staff()) AND public.painted_map_can_touch(job_id, development_id, created_by));

-- A line and a place follow their map: the EXISTS reads painted_maps under the caller's own RLS. Anyone who can
-- read the map may add a stroke or a place to it. Changing or removing one is its maker's and the office's.
ALTER TABLE public.painted_map_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS painted_map_lines_select ON public.painted_map_lines;
CREATE POLICY painted_map_lines_select ON public.painted_map_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id = map_id));
DROP POLICY IF EXISTS painted_map_lines_insert ON public.painted_map_lines;
CREATE POLICY painted_map_lines_insert ON public.painted_map_lines FOR INSERT TO authenticated
  WITH CHECK (made_by = auth.uid() AND EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id = map_id));
DROP POLICY IF EXISTS painted_map_lines_update ON public.painted_map_lines;
CREATE POLICY painted_map_lines_update ON public.painted_map_lines FOR UPDATE TO authenticated
  USING ((made_by = auth.uid() OR public.is_office_staff()) AND EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id = map_id))
  WITH CHECK ((made_by = auth.uid() OR public.is_office_staff()) AND EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id = map_id));
DROP POLICY IF EXISTS painted_map_lines_delete ON public.painted_map_lines;
CREATE POLICY painted_map_lines_delete ON public.painted_map_lines FOR DELETE TO authenticated
  USING ((made_by = auth.uid() OR public.is_office_staff()) AND EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id = map_id));

ALTER TABLE public.painted_map_places ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS painted_map_places_select ON public.painted_map_places;
CREATE POLICY painted_map_places_select ON public.painted_map_places FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id = map_id));
DROP POLICY IF EXISTS painted_map_places_insert ON public.painted_map_places;
CREATE POLICY painted_map_places_insert ON public.painted_map_places FOR INSERT TO authenticated
  WITH CHECK (set_by = auth.uid() AND EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id = map_id));
DROP POLICY IF EXISTS painted_map_places_update ON public.painted_map_places;
CREATE POLICY painted_map_places_update ON public.painted_map_places FOR UPDATE TO authenticated
  USING ((set_by = auth.uid() OR public.is_office_staff()) AND EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id = map_id))
  WITH CHECK ((set_by = auth.uid() OR public.is_office_staff()) AND EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id = map_id));
DROP POLICY IF EXISTS painted_map_places_delete ON public.painted_map_places;
CREATE POLICY painted_map_places_delete ON public.painted_map_places FOR DELETE TO authenticated
  USING ((set_by = auth.uid() OR public.is_office_staff()) AND EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id = map_id));

-- 5. The bucket: private, 2 MB a file, images only. Objects are named <map id>/<file>, so the map's own gate reads
--    from the path: whoever can read the map can read and add its photos. Removing one is its uploader's and the
--    office's. The map's id is compared as text, so a name that does not open with one matches no map and no
--    cast can fail. The object's name is written objects.name: a map has a name of its own, and a bare name inside the
--    EXISTS would be the map's.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('painted-map-photos', 'painted-map-photos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS painted_map_photos_files_select ON storage.objects;
CREATE POLICY painted_map_photos_files_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'painted-map-photos' AND EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id::text = split_part(objects.name, '/', 1)));
DROP POLICY IF EXISTS painted_map_photos_files_insert ON storage.objects;
CREATE POLICY painted_map_photos_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'painted-map-photos' AND EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id::text = split_part(objects.name, '/', 1)));
DROP POLICY IF EXISTS painted_map_photos_files_delete ON storage.objects;
CREATE POLICY painted_map_photos_files_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'painted-map-photos'
    AND (owner = auth.uid() OR public.is_office_staff())
    AND EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id::text = split_part(objects.name, '/', 1))
  );

-- House rules for every CREATE TABLE: training-mode blocks, the digital-twin fence and the archived seal.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
