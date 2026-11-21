SET lock_timeout = '3s';

-- A photo keeps its spot on the job (punch list #413): the ground for the card's later steps, in one migration so
-- the screens that follow each need no migration of their own. Taunya's word of 2026-11-21: build it all.
--
--   Step 3. A job photo and a report photo keep the phone's reading of the moment they were taken.
--           A place counts how often someone other than its setter opens it.
--   Step 4. A job's own list of places is read from every job at the same customer address.
--   Step 6. A place may point at a line, so a buried line has its walked length.
--   Step 7. A place may hold more photos than its first.
--
-- Additive and idempotent. No CREATE TABLE, so no fence calls. Each ALTER TABLE adds nullable columns or a column
-- with a constant default, which rewrites no row. No screen reads or writes any of this yet.

-- ---------------------------------------------------------------------------------------------------------------
-- Step 3a. Where the phone was when a photo was taken. Both columns or neither, and a margin only with a point.
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.job_photo_notes
  ADD COLUMN IF NOT EXISTS taken_lat double precision,
  ADD COLUMN IF NOT EXISTS taken_lng double precision,
  ADD COLUMN IF NOT EXISTS taken_accuracy_m integer;
ALTER TABLE public.report_photos
  ADD COLUMN IF NOT EXISTS taken_lat double precision,
  ADD COLUMN IF NOT EXISTS taken_lng double precision,
  ADD COLUMN IF NOT EXISTS taken_accuracy_m integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.job_photo_notes'::regclass AND conname = 'job_photo_notes_taken_point_check') THEN
    ALTER TABLE public.job_photo_notes ADD CONSTRAINT job_photo_notes_taken_point_check CHECK (
      (taken_lat IS NULL) = (taken_lng IS NULL)
      AND (taken_lat IS NULL OR taken_lat BETWEEN -90 AND 90)
      AND (taken_lng IS NULL OR taken_lng BETWEEN -180 AND 180)
      AND (taken_accuracy_m IS NULL OR (taken_lat IS NOT NULL AND taken_accuracy_m >= 0))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.report_photos'::regclass AND conname = 'report_photos_taken_point_check') THEN
    ALTER TABLE public.report_photos ADD CONSTRAINT report_photos_taken_point_check CHECK (
      (taken_lat IS NULL) = (taken_lng IS NULL)
      AND (taken_lat IS NULL OR taken_lat BETWEEN -90 AND 90)
      AND (taken_lng IS NULL OR taken_lng BETWEEN -180 AND 180)
      AND (taken_accuracy_m IS NULL OR (taken_lat IS NOT NULL AND taken_accuracy_m >= 0))
    );
  END IF;
END $$;

COMMENT ON COLUMN public.job_photo_notes.taken_lat IS 'A photo keeps its spot (#413): where the phone was when the photo was taken, read once on that press. Null when the phone gave no reading, the reading was rough, or the photo was not of that moment.';
COMMENT ON COLUMN public.job_photo_notes.taken_lng IS 'With taken_lat: both or neither.';
COMMENT ON COLUMN public.job_photo_notes.taken_accuracy_m IS 'The phone''s own margin for that reading, in metres. Null when it gave none.';
COMMENT ON COLUMN public.report_photos.taken_lat IS 'A photo keeps its spot (#413): where the phone was when the photo was taken, read once on that press. Null when the phone gave no reading, the reading was rough, or the photo was not of that moment.';
COMMENT ON COLUMN public.report_photos.taken_lng IS 'With taken_lat: both or neither.';
COMMENT ON COLUMN public.report_photos.taken_accuracy_m IS 'The phone''s own margin for that reading, in metres. Null when it gave none.';

-- ---------------------------------------------------------------------------------------------------------------
-- Steps 3b, 6 and 7. On a place: how often it was opened, the line it runs along, and its other photos.
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.painted_map_places
  ADD COLUMN IF NOT EXISTS opened_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS line_id uuid,
  ADD COLUMN IF NOT EXISTS more_photos jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.painted_map_places'::regclass AND conname = 'painted_map_places_opened_count_check') THEN
    ALTER TABLE public.painted_map_places ADD CONSTRAINT painted_map_places_opened_count_check CHECK (opened_count >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.painted_map_places'::regclass AND conname = 'painted_map_places_line_id_fkey') THEN
    ALTER TABLE public.painted_map_places ADD CONSTRAINT painted_map_places_line_id_fkey
      FOREIGN KEY (line_id) REFERENCES public.painted_map_lines(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.painted_map_places'::regclass AND conname = 'painted_map_places_more_photos_check') THEN
    ALTER TABLE public.painted_map_places ADD CONSTRAINT painted_map_places_more_photos_check
      -- A CASE, not an AND: the length of something that is not a list is an error, and an AND may ask for it first.
      CHECK (CASE WHEN jsonb_typeof(more_photos) = 'array' THEN jsonb_array_length(more_photos) <= 12 ELSE false END);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS painted_map_places_line_idx ON public.painted_map_places (line_id) WHERE line_id IS NOT NULL;

COMMENT ON COLUMN public.painted_map_places.opened_count IS 'A photo keeps its spot (#413): how many times someone other than the place''s setter opened it. Written by note_painted_place_opened and by nothing else.';
COMMENT ON COLUMN public.painted_map_places.last_opened_at IS 'When someone other than its setter last opened the place.';
COMMENT ON COLUMN public.painted_map_places.line_id IS 'A photo keeps its spot (#413): the line this place runs along, such as a buried line walked before backfill. The line may be on another painted map of the job. Null when it has none, and again when the line is removed.';
COMMENT ON COLUMN public.painted_map_places.more_photos IS 'A photo keeps its spot (#413): the place''s photos after its first, as a list of {path, words, at, by}, up to twelve. Each path is an object in the painted-map-photos bucket under this place''s map.';

-- A place was opened. The count is a fact about the place and not about the reader, so nobody is named in it. The
-- setter's own opens are not counted: the question the count answers is whether anyone else came looking.
--
-- Two functions. The outer one runs as the caller, so it finds the place only when the caller can read it. The
-- inner one runs as its owner, since a reader is not let to change a place they did not set. It swallows its own
-- failure: a training account and a digital twin write nothing, and a count that was not taken must never stop a
-- person from reading a place.
CREATE OR REPLACE FUNCTION public.painted_place_opened_bump(p_place_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.painted_map_places SET opened_count = opened_count + 1, last_opened_at = now() WHERE id = p_place_id;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
REVOKE ALL ON FUNCTION public.painted_place_opened_bump(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painted_place_opened_bump(uuid) TO authenticated;
COMMENT ON FUNCTION public.painted_place_opened_bump(uuid) IS 'A photo keeps its spot (#413): adds one to a place''s count of opens. Called by note_painted_place_opened, which checks the caller can read the place. It changes a count and nothing else.';

CREATE OR REPLACE FUNCTION public.note_painted_place_opened(p_place_id uuid)
RETURNS void LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT public.painted_place_opened_bump(p.id)
  FROM public.painted_map_places p
  WHERE p.id = p_place_id AND auth.uid() IS NOT NULL AND p.set_by IS DISTINCT FROM auth.uid()
$$;
REVOKE ALL ON FUNCTION public.note_painted_place_opened(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.note_painted_place_opened(uuid) TO authenticated;
COMMENT ON FUNCTION public.note_painted_place_opened(uuid) IS 'A photo keeps its spot (#413): the caller opened this place. Counts it when the caller can read the place and did not set it.';

-- ---------------------------------------------------------------------------------------------------------------
-- Step 4. A job's own list of places is read from every job at the same customer address.
-- ---------------------------------------------------------------------------------------------------------------
-- The next tech at a house is on a different job. The list stays on the job that made it, which keeps who and when,
-- and a job at the same customer address reads it too. A job with no customer address shares nothing.
--
-- The two inner functions run as their owner, since a helper cannot read the ledger, and they answer with ids only:
-- which jobs share an address. Whether the caller may see any of it is asked outside them, as the caller, by
-- on_site_can_touch_job, the gate a painted map on a job already uses.
CREATE OR REPLACE FUNCTION public.painted_list_address_jobs(p_map_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET row_security = off AS $$
  SELECT j2.id
  FROM public.painted_maps m
  JOIN public.jobs_ledger j ON j.id = m.job_id
  JOIN public.jobs_ledger j2 ON j2.customer_address_id = j.customer_address_id AND j2.id <> j.id
  WHERE m.id = p_map_id AND m.job_list IS TRUE AND j.customer_address_id IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.painted_list_address_jobs(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painted_list_address_jobs(uuid) TO authenticated;
COMMENT ON FUNCTION public.painted_list_address_jobs(uuid) IS 'A photo keeps its spot (#413): the other jobs at the customer address of the job this list of places is on. Ids only. Nothing for a map that is not a job''s list, and nothing for a job with no customer address.';

CREATE OR REPLACE FUNCTION public.painted_address_jobs_of(p_job_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET row_security = off AS $$
  SELECT j2.id
  FROM public.jobs_ledger j
  JOIN public.jobs_ledger j2 ON j2.customer_address_id = j.customer_address_id AND j2.id <> j.id
  WHERE j.id = p_job_id AND j.customer_address_id IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.painted_address_jobs_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painted_address_jobs_of(uuid) TO authenticated;
COMMENT ON FUNCTION public.painted_address_jobs_of(uuid) IS 'A photo keeps its spot (#413): the other jobs at this job''s customer address. Ids only.';

-- Runs as the caller: true when one of those jobs is one the caller may touch.
CREATE OR REPLACE FUNCTION public.painted_map_at_my_address(p_map_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.painted_list_address_jobs(p_map_id) AS s(job_id) WHERE public.on_site_can_touch_job(s.job_id)
  )
$$;
REVOKE ALL ON FUNCTION public.painted_map_at_my_address(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painted_map_at_my_address(uuid) TO authenticated;
COMMENT ON FUNCTION public.painted_map_at_my_address(uuid) IS 'A photo keeps its spot (#413): true when this is a job''s list of places and the caller may touch another job at the same customer address.';

-- One more way to read a painted map, beside its own gate and a task that carries it. The lines, the places and the
-- photo files of a map all ask "can the caller read the map", so they follow with no policy of their own. That
-- includes adding a place, as for every reader of a map: the screens write a new place to the caller's own job.
DROP POLICY IF EXISTS painted_maps_select_at_my_address ON public.painted_maps;
CREATE POLICY painted_maps_select_at_my_address ON public.painted_maps FOR SELECT TO authenticated
  USING (job_list IS TRUE AND job_id IS NOT NULL AND public.painted_map_at_my_address(id));

-- What a job's window asks: the lists of places kept by other jobs at this job's address. Runs as the caller, so it
-- answers only for a job the caller may touch, and each list it names is one the policy above lets the caller read.
CREATE OR REPLACE FUNCTION public.job_address_place_lists(p_job_id uuid)
RETURNS TABLE (map_id uuid, job_id uuid, created_at timestamptz) LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT m.id, m.job_id, m.created_at
  FROM public.painted_maps m
  WHERE m.job_list IS TRUE
    AND m.job_id IN (SELECT public.painted_address_jobs_of(p_job_id))
    AND public.on_site_can_touch_job(p_job_id)
  ORDER BY m.created_at, m.id
$$;
REVOKE ALL ON FUNCTION public.job_address_place_lists(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_address_place_lists(uuid) TO authenticated;
COMMENT ON FUNCTION public.job_address_place_lists(uuid) IS 'A photo keeps its spot (#413): the lists of places kept by other jobs at this job''s customer address, oldest first. Empty for a job the caller may not touch and for a job with no customer address.';
