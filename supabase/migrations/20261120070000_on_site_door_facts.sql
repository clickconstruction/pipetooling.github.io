SET lock_timeout = '3s';

-- Materials on site (punch list #407, v2.8103): what the Job Mode card's Materials on site press says of a job's site.
--
-- The press beside Job calendar (v2.8050) carries the count of the live cages and boxes on the job's SITE, never of
-- the one job: a big site's cages often sit under a sister job. The client read that as a head count in three small
-- reads. Two more facts cannot be head counts: how many of those boxes are due a count, which needs the newest count
-- on each box out of the ledger, and how many printed stickers wait for a box, which crosses two tables. This
-- function answers all three in one call:
--
--   boxes     live containers on the site that are not Unsorted
--   due       of those, the ones never counted or last counted 14 days ago or more: the rule of
--             src/lib/materials/onSite.ts (countIsDue, STALE_COUNT_DAYS = 14) and jobMaterialsSummary's `stale`
--   stickers  stickers of the site's runs that are on no box and not lost, the screens' "reserved"
--
-- The site is on_site_site_job_ids(p_job_id), every job of the job's development, with the job itself always among
-- them, so a reader who cannot read the ledger row still counts the one job.
--
-- SECURITY INVOKER on purpose: job_containers, job_material_movements, box_stickers and sticker_runs each answer under
-- the caller's own RLS (on_site_can_touch_job and the stickers' own read rule), so the numbers are what that person
-- can open. A press taken back is closed to every read by its restrictive policy; the predicate below says so again
-- in words. No table is created, so no fence is owed.

CREATE OR REPLACE FUNCTION public.on_site_door_facts(p_job_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  WITH site AS (
    SELECT p_job_id AS id
    UNION
    SELECT s FROM public.on_site_site_job_ids(p_job_id) AS s
  ),
  boxes AS (
    SELECT c.id
    FROM public.job_containers c
    WHERE c.job_id IN (SELECT id FROM site)
      AND c.retired_at IS NULL
      AND c.kind <> 'unsorted'
  ),
  counted AS (
    SELECT m.from_container_id AS id, max(m.at) AS at
    FROM public.job_material_movements m
    WHERE m.reason = 'counted'
      AND m.taken_back_at IS NULL
      AND m.from_container_id IN (SELECT id FROM boxes)
    GROUP BY m.from_container_id
  )
  SELECT jsonb_build_object(
    'boxes', (SELECT count(*) FROM boxes),
    'due', (
      SELECT count(*)
      FROM boxes b
      LEFT JOIN counted k ON k.id = b.id
      WHERE k.at IS NULL OR k.at <= now() - interval '14 days'
    ),
    'stickers', (
      SELECT count(*)
      FROM public.box_stickers s
      JOIN public.sticker_runs r ON r.id = s.run_id
      WHERE r.job_id IN (SELECT id FROM site)
        AND s.container_id IS NULL
        AND s.lost_at IS NULL
    )
  )
$fn$;

REVOKE ALL ON FUNCTION public.on_site_door_facts(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.on_site_door_facts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.on_site_door_facts(uuid) TO authenticated;

COMMENT ON FUNCTION public.on_site_door_facts(uuid) IS 'Materials on site (#407): what the Job Mode card''s press says of a job''s site, in one read under the caller''s own RLS — live boxes, the boxes due a count (never counted, or 14 days since the last count) and the printed stickers on no box yet.';
