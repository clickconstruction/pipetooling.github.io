SET lock_timeout = '3s';

-- Pins on a painted map, reading C (punch list #393, v2.7792): a job's own list of places.
--
-- The owner's ask of 2026-11-17 was to set points of interest on a job, and not only on a painted map. On
-- 2026-11-18 he chose a list of its own, apart from Materials on site's places, and liked the mock-up that keeps it
-- under the job's address and draws it on every painted map of that job. This is the database half: one column. No
-- screen reads or writes it yet.
--
-- The list is kept as a painted map that holds places only and is marked as the job's own. So everything a place
-- already has comes with it and nothing is built twice: its kind and mark, its photo in the private bucket, who may
-- read and change it, and the map's own link, picture and printed page. No new table, so no new fence.
--
-- The table holds a job to no count of such maps, on purpose:
--   - A job that goes sets its maps' job_id to null. A check that a list has a job would refuse that.
--   - Two jobs can be combined, and both may have a list. A rule of one a job would refuse the combine.
-- The app makes one and reads every one a job has as one list. A second list costs nothing and loses nothing.
--
-- Nothing else changes. The four policies on painted_maps are by row and do not read the column, so whoever may
-- paint a map for a job may start its list, and nobody else gains anything.

ALTER TABLE public.painted_maps
  ADD COLUMN IF NOT EXISTS job_list boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.painted_maps.job_list IS 'True for a job''s own list of places (#393): a map that holds places only, shown under the job''s address and drawn on every other painted map of that job. The app makes one a job and reads every one a job has as one list. False for a map somebody painted.';
