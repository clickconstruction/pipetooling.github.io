SET lock_timeout = '3s';

-- A place on a site can carry the way to it (punch list #372, step 4; the owner's word of 2026-11-17, "Build all the
-- steps").
--
-- Where is it? on a box (v2.7575) draws a straight line from the reader to the box's pin. A straight line knows no
-- fence, wall or gate. A painted map (#345) does, because a person drew it. Boxes stand in places (the laydown yard,
-- Level 2), and 86 of the 92 placed boxes read on 2026-11-16 shared one place, so one way painted once to a place
-- serves every box in it. This lets a place point at that map.
--
--   1. painted_map_id on job_places. Null until someone paints the way. A map thrown away leaves the place standing
--      with no way (ON DELETE SET NULL).
--   2. An UPDATE policy on job_places, which had a select and an insert and no update: whoever may touch the job's
--      boxes (on_site_can_touch_job, the gate every other on-site table asks) may update its places.
--   3. A guard, so that policy opens one column and no more. From a direct caller a place keeps everything but the
--      way: its name, its job, who made it and when. And the way, from anyone, must be a map the writer can open that
--      hangs on the place's own job or on the job's development. A map on no job is read by its maker and the office
--      only, so a place never points at one: the crew could not open it.
--
-- Who reads the map is not changed here. A map on a job is already read by the job's crew and the office
-- (painted_maps_select through painted_map_can_touch, which asks on_site_can_touch_job), the same people who read the
-- job's places. So whoever reads a place reads its way.
--
-- The guard runs as the caller on purpose: the read of painted_maps is under the writer's own RLS, so a map they
-- cannot open is not found. One small definer function answers whether a job is in a development, because a helper on
-- a job's crew cannot read the ledger and the guard would otherwise turn a development's map away from them.
--
-- The guard's refusals carry their own code, P0PWY, so the app prints their words: it renders 42501, the code of a
-- row level security refusal, as one fixed sentence about access.
--
-- The read-only blocks, the twin fence and the archived seal already stand on job_places (made with the table), and
-- the read-only block covers UPDATE. No CREATE TABLE here, so no fence calls.
--
-- Additive and idempotent: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, CREATE OR REPLACE, and the policy
-- and the trigger are dropped before they are made. A nullable column with no default is a catalog change alone.
-- Nothing reads or writes the column until the client that follows, which must not merge before this is pushed: it
-- names the column in the read of every place.

-- 1. The column.
ALTER TABLE public.job_places
  ADD COLUMN IF NOT EXISTS painted_map_id uuid REFERENCES public.painted_maps(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.job_places.painted_map_id IS 'Materials on site (#372): the painted map that is the way to this place, on the place''s own job or its development. Null with no way. Whoever reads the place reads the map.';
-- A map thrown away sets its places'' pointers null, which looks a place up by its map.
CREATE INDEX IF NOT EXISTS job_places_painted_map_idx ON public.job_places (painted_map_id) WHERE painted_map_id IS NOT NULL;

-- 2. Is this job in this development? A yes or a no about two ids the caller already holds, and nothing else.
CREATE OR REPLACE FUNCTION public.on_site_job_in_development(p_job_id uuid, p_development_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT p_job_id IS NOT NULL AND p_development_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id AND j.development_id = p_development_id)
$fn$;
COMMENT ON FUNCTION public.on_site_job_in_development(uuid, uuid) IS 'Materials on site (#372): true when the job is in the development. Definer, because a helper on a job''s crew cannot read the ledger; it answers yes or no about two ids and returns no row.';
REVOKE EXECUTE ON FUNCTION public.on_site_job_in_development(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_site_job_in_development(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.on_site_job_in_development(uuid, uuid) TO authenticated, service_role;

-- 3. The guard.
CREATE OR REPLACE FUNCTION public.on_site_guard_place_way()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_map_job uuid;
  v_map_development uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- A direct caller changes the way and nothing else. on_site_carry_job, inside the combine and the dev seat's
    -- move, still changes a place's job: it runs inside a definer function, as its owner.
    IF current_user IN ('authenticated', 'anon')
       AND (to_jsonb(NEW) - 'painted_map_id') IS DISTINCT FROM (to_jsonb(OLD) - 'painted_map_id') THEN
      RAISE EXCEPTION 'A place keeps its name and its job. Only the way to it can be set.' USING ERRCODE = 'P0PWY';
    END IF;
    IF NEW.painted_map_id IS NOT DISTINCT FROM OLD.painted_map_id THEN
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.painted_map_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Read under the writer's own RLS: a map they cannot open is not found.
  SELECT m.job_id, m.development_id INTO v_map_job, v_map_development FROM public.painted_maps m WHERE m.id = NEW.painted_map_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That map cannot be the way to a place. It is not a map you can open.' USING ERRCODE = 'P0PWY';
  END IF;
  IF v_map_job IS DISTINCT FROM NEW.job_id AND NOT public.on_site_job_in_development(NEW.job_id, v_map_development) THEN
    RAISE EXCEPTION 'The way to a place is a map of its own job or of its development.' USING ERRCODE = 'P0PWY';
  END IF;
  RETURN NEW;
END
$fn$;
COMMENT ON FUNCTION public.on_site_guard_place_way() IS 'Materials on site (#372): from a direct caller a place keeps everything but the way to it, and the way is a painted map the writer can open on the place''s own job or its development.';
REVOKE EXECUTE ON FUNCTION public.on_site_guard_place_way() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_site_guard_place_way() FROM anon;
REVOKE EXECUTE ON FUNCTION public.on_site_guard_place_way() FROM authenticated;

DROP TRIGGER IF EXISTS job_places_guard_way ON public.job_places;
CREATE TRIGGER job_places_guard_way BEFORE INSERT OR UPDATE ON public.job_places
  FOR EACH ROW EXECUTE FUNCTION public.on_site_guard_place_way();

-- 4. The door: the same gate as the job's boxes.
DROP POLICY IF EXISTS job_places_update ON public.job_places;
CREATE POLICY job_places_update ON public.job_places FOR UPDATE TO authenticated
  USING (public.on_site_can_touch_job(job_id)) WITH CHECK (public.on_site_can_touch_job(job_id));
