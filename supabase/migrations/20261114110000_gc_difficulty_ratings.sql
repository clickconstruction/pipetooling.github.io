SET lock_timeout = '3s';

-- GC difficulty rating, PR 2 (punch list #357, v2.7279): the rating itself.
--
-- One rating per GC, on its record, in sentences a person picks from the published criteria
-- (difficulty_criteria_versions, PR 1). The newest rating stands and every one is kept: a rating is never changed,
-- a new one is written. A rating given under version N stays a version N rating; the client carries its picks to a
-- newer version by the rule in src/lib/bids/difficultyCriteria.ts and says what did not carry.
--
--   1. gc_difficulty_ratings — customer_id, criteria_version_id, picks {key: points}, a required note (what
--      happened), who and when.
--   2. The guard: the database stamps who and when, holds the version to a published one, and holds every pick to a
--      scale and a rung that version has. An update is refused: a rating is written once.
--   3. The gates: everyone signed in reads (the Bid Board's chip, the Workbench, the master's sheet); the office
--      writes (is_office_staff(): dev, master, assistant, controller) until the Bid Board's price list says who may
--      rate (PR 4); a dev deletes a row made by mistake.

-- 1. The ratings.
CREATE TABLE IF NOT EXISTS public.gc_difficulty_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  criteria_version_id uuid NOT NULL REFERENCES public.difficulty_criteria_versions(id),
  picks jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text NOT NULL,
  rated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  rated_by_name text NOT NULL DEFAULT '',
  rated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_difficulty_ratings_picks_shape CHECK (jsonb_typeof(picks) = 'object'),
  CONSTRAINT gc_difficulty_ratings_note_length CHECK (length(btrim(note)) BETWEEN 1 AND 1000)
);

COMMENT ON TABLE public.gc_difficulty_ratings IS
  'GC difficulty rating (punch list #357): one row per rating of a GC under one criteria version; the newest per customer stands, every one is kept, none is changed. picks is {scale key: points}; note is what happened, required. Read by the GC''s card, the Bid Board''s chip, the Workbench and the master''s sheet; the Bid Board''s price list turns the points into cost lines (PR 4).';
COMMENT ON COLUMN public.gc_difficulty_ratings.criteria_version_id IS 'The published version the picks were made under. A rating stays a rating of that version; the client carries it forward by the key and the points.';
COMMENT ON COLUMN public.gc_difficulty_ratings.picks IS '{key: points}: one entry per scale picked. A scale with no entry is unrated under that version.';

CREATE INDEX IF NOT EXISTS gc_difficulty_ratings_customer_newest ON public.gc_difficulty_ratings (customer_id, rated_at DESC);

-- 2. The guard.
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
  END LOOP;
  RETURN NEW;
END;
$fn$;

-- A trigger function is never called by hand.
REVOKE ALL ON FUNCTION public.gc_difficulty_ratings_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS gc_difficulty_ratings_guard ON public.gc_difficulty_ratings;
CREATE TRIGGER gc_difficulty_ratings_guard
  BEFORE INSERT OR UPDATE ON public.gc_difficulty_ratings
  FOR EACH ROW EXECUTE FUNCTION public.gc_difficulty_ratings_guard();

-- 3. The gates.
ALTER TABLE public.gc_difficulty_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_difficulty_ratings_select_signed_in ON public.gc_difficulty_ratings;
CREATE POLICY gc_difficulty_ratings_select_signed_in
  ON public.gc_difficulty_ratings FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS gc_difficulty_ratings_insert_office ON public.gc_difficulty_ratings;
CREATE POLICY gc_difficulty_ratings_insert_office
  ON public.gc_difficulty_ratings FOR INSERT TO authenticated
  WITH CHECK (public.is_office_staff());

DROP POLICY IF EXISTS gc_difficulty_ratings_delete_dev ON public.gc_difficulty_ratings;
CREATE POLICY gc_difficulty_ratings_delete_dev
  ON public.gc_difficulty_ratings FOR DELETE TO authenticated
  USING (public.is_dev());

REVOKE ALL ON public.gc_difficulty_ratings FROM anon;
GRANT SELECT, INSERT, DELETE ON public.gc_difficulty_ratings TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
