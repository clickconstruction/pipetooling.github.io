SET lock_timeout = '3s';

-- GC difficulty rating, PR 3 (punch list #357, v2.7296): the paying scale read from the bills.
--
-- The Paying scale is never picked by a person: the client reads it from the GC's bills (the pay-speed data and the
-- pay calendar, src/lib/bids/difficultyPaying.ts) against the price list's rule, and writes the point it read into
-- the rating's picks with the numbers behind it, so a rating stays a record with reasons. The office may set it by
-- hand with a reason instead. Either way a bills scale's pick carries its words here.
--
--   1. gc_difficulty_ratings.pick_reasons — {key: words}: for a bills scale, what the point rests on (read from the
--      bills, or by hand with the person's reason).
--   2. The guard gains one rule: a pick on a bills scale needs its words, and words name a pick that is there.

ALTER TABLE public.gc_difficulty_ratings ADD COLUMN IF NOT EXISTS pick_reasons jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.gc_difficulty_ratings DROP CONSTRAINT IF EXISTS gc_difficulty_ratings_pick_reasons_shape;
ALTER TABLE public.gc_difficulty_ratings
  ADD CONSTRAINT gc_difficulty_ratings_pick_reasons_shape CHECK (jsonb_typeof(pick_reasons) = 'object') NOT VALID;
ALTER TABLE public.gc_difficulty_ratings VALIDATE CONSTRAINT gc_difficulty_ratings_pick_reasons_shape;

COMMENT ON COLUMN public.gc_difficulty_ratings.pick_reasons IS '{scale key: words}: what a bills scale''s point rests on — read from the bills with the numbers behind it, or By hand: with the person''s reason. Required for every pick on a bills scale.';

CREATE OR REPLACE FUNCTION public.gc_difficulty_ratings_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_body jsonb;
  v_status text;
  v_version integer;
  v_key text;
  v_points jsonb;
  v_scale jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'A rating is never changed. Save a new rating; the newest stands and every one is kept.' USING ERRCODE = 'check_violation';
  END IF;

  NEW.note := btrim(COALESCE(NEW.note, ''));
  NEW.rated_at := now();
  NEW.created_at := now();
  NEW.pick_reasons := COALESCE(NEW.pick_reasons, '{}'::jsonb);
  IF v_uid IS NOT NULL THEN
    NEW.rated_by := v_uid;
    NEW.rated_by_name := COALESCE((SELECT u.name FROM public.users u WHERE u.id = v_uid), '');
  END IF;

  SELECT v.body, v.status, v.version INTO v_body, v_status, v_version
  FROM public.difficulty_criteria_versions v WHERE v.id = NEW.criteria_version_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'The criteria version is not there. Reload and rate again.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_status <> 'published' THEN
    RAISE EXCEPTION 'A rating is made under a published version, not a draft.' USING ERRCODE = 'check_violation';
  END IF;

  FOR v_key, v_points IN SELECT key, value FROM jsonb_each(NEW.picks) LOOP
    IF jsonb_typeof(v_points) <> 'number' THEN
      RAISE EXCEPTION 'The pick for % is not a number of points.', v_key USING ERRCODE = 'check_violation';
    END IF;
    SELECT s INTO v_scale FROM jsonb_array_elements(v_body->'scales') s WHERE s->>'key' = v_key;
    IF v_scale IS NULL THEN
      RAISE EXCEPTION 'Version % has no scale %.', v_version, v_key USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_scale->'rungs', '[]'::jsonb)) r WHERE (r->'points') = v_points)
       AND NOT (v_scale->>'source' = 'bills' AND jsonb_array_length(COALESCE(v_scale->'rungs', '[]'::jsonb)) = 0 AND (v_points)::text::numeric BETWEEN 0 AND COALESCE((v_scale->>'max')::numeric, 0)) THEN
      RAISE EXCEPTION 'Version % has no % point rung on %.', v_version, v_points::text, v_key USING ERRCODE = 'check_violation';
    END IF;
    -- A bills scale's point says what it rests on.
    IF v_scale->>'source' = 'bills' AND btrim(COALESCE(NEW.pick_reasons->>v_key, '')) = '' THEN
      RAISE EXCEPTION 'The % point needs its words: read from the bills, or by hand with a reason.', v_key USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  FOR v_key IN SELECT key FROM jsonb_each(NEW.pick_reasons) LOOP
    IF NEW.picks->v_key IS NULL THEN
      RAISE EXCEPTION 'Words for % name a pick that is not there.', v_key USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.gc_difficulty_ratings_guard() FROM PUBLIC, anon, authenticated;
