SET lock_timeout = '3s';

-- GC difficulty rating, PR 6 (punch list #357): the site scale, picked on the bid.
--
-- The owner's call 1 of 2026-11-14: rate the GC, not the bid, with one exception. The site is the job's and not
-- the GC's, so the site scale is picked on the bid and priced from the Bid Board's site percent
-- (difficulty_price_versions.body.sitePctPerPoint, there since PR 4).
--
--   1. Criteria version 2: version 1's three scales and the site scale (key site, scope bid, picked, 0 to 2).
--      Published here and not from the dev's card, so the live walk is a read. A rating made under version 1 keeps
--      its version and carries unchanged: the client carries a GC's picks to the GC's scales only.
--   2. bid_difficulty_picks: one row per bid, the picks made on the bid itself ({site: 1}) under one published
--      version. Kept apart from the pin (bid_difficulty), which is what the bid was priced with: a bid to a GC
--      nobody has rated can still carry a site pick, and a master can pick the site before the bid is costed.
--   3. The guard: stamps who and when, holds the version to a published one, and holds every pick to a scale of
--      scope bid that a person picks, and to a rung that scale has.
--   4. The gates: everyone signed in reads; whoever may price a bid writes (is_bid_pricing_user(): dev, owner,
--      assistant, controller, estimator); a dev deletes a row made in a walk.

-- 1. Version 2. The same JSON lives in src/lib/bids/difficultyCriteria.ts as DIFFICULTY_CRITERIA_V2, and
-- difficultyCriteria.test.ts reads this file to hold the two equal.
INSERT INTO public.difficulty_criteria_versions (version, status, body, note, published_by_name, published_at)
VALUES (
  2,
  'published',
  $json${"scales":[{"key":"paying","name":"Paying","scope":"gc","source":"bills","max":1,"rungs":[{"points":0,"sentence":"They pay at the GC pace, or faster."},{"points":1,"sentence":"They pay slow. Read from their bills against the price list's rule."}]},{"key":"field","name":"Field and superintendent","scope":"gc","source":"picked","max":3,"rungs":[{"points":0,"sentence":"The super sets a schedule and keeps it. Our crew walks on and works."},{"points":1,"sentence":"Small surprises. A locked gate, a late inspection, a trade in our way for a day."},{"points":2,"sentence":"The order of work changes after we mobilize, or the site is not ready when they call us out."},{"points":3,"sentence":"We remobilize more than once, the super fights every change order, or our crew waits on them every week."}]},{"key":"office","name":"Their office","scope":"gc","source":"picked","max":2,"rungs":[{"points":0,"sentence":"Pay apps go through the first time. One call settles a question."},{"points":1,"sentence":"Pay apps come back for paperwork, lien waivers are asked for twice, a question waits a week."},{"points":2,"sentence":"Every bill is a fight, or nobody at their office can be reached."}]},{"key":"site","name":"The site","scope":"bid","source":"picked","max":2,"rungs":[{"points":0,"sentence":"Open ground with room to stage."},{"points":1,"sentence":"An occupied building, or no room to stage."},{"points":2,"sentence":"Work in phases, or every trip is a lift."}]}]}$json$::jsonb,
  'Version 1 and the site scale: picked on the bid, since the site is the job''s and not the GC''s.',
  'the app',
  now()
)
ON CONFLICT (version) WHERE status = 'published' DO NOTHING;

-- 2. The picks made on the bid.
CREATE TABLE IF NOT EXISTS public.bid_difficulty_picks (
  bid_id uuid PRIMARY KEY REFERENCES public.bids(id) ON DELETE CASCADE,
  criteria_version_id uuid NOT NULL REFERENCES public.difficulty_criteria_versions(id),
  picks jsonb NOT NULL DEFAULT '{}'::jsonb,
  picked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  picked_by_name text NOT NULL DEFAULT '',
  picked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bid_difficulty_picks_shape CHECK (jsonb_typeof(picks) = 'object')
);

COMMENT ON TABLE public.bid_difficulty_picks IS
  'GC difficulty rating (punch list #357, PR 6): the picks made on a bid itself, one row per bid: {scale key: points} for the scales of scope bid (the site) under one published criteria version. The Workbench prices them with the GC''s rating into the bid''s difficulty lines; bid_difficulty.picks keeps what the bid was priced with.';
COMMENT ON COLUMN public.bid_difficulty_picks.picks IS '{key: points}: one entry per bid-scope scale picked. No entry is unrated.';

CREATE INDEX IF NOT EXISTS bid_difficulty_picks_version ON public.bid_difficulty_picks (criteria_version_id);
CREATE INDEX IF NOT EXISTS bid_difficulty_picks_picked_by ON public.bid_difficulty_picks (picked_by) WHERE picked_by IS NOT NULL;

-- 3. The guard.
CREATE OR REPLACE FUNCTION public.bid_difficulty_picks_guard()
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
  NEW.picked_at := now();
  IF v_uid IS NOT NULL THEN
    NEW.picked_by := v_uid;
    NEW.picked_by_name := COALESCE((SELECT u.name FROM public.users u WHERE u.id = v_uid), '');
  END IF;

  SELECT v.body, v.status, v.version INTO v_body, v_status, v_version
  FROM public.difficulty_criteria_versions v WHERE v.id = NEW.criteria_version_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'The criteria version is not there. Reload and pick again.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_status <> 'published' THEN
    RAISE EXCEPTION 'A pick is made under a published version, not a draft.' USING ERRCODE = 'check_violation';
  END IF;

  FOR v_key, v_points IN SELECT key, value FROM jsonb_each(NEW.picks) LOOP
    IF jsonb_typeof(v_points) <> 'number' THEN
      RAISE EXCEPTION 'The pick for % is not a number of points.', v_key USING ERRCODE = 'check_violation';
    END IF;
    SELECT s INTO v_scale FROM jsonb_array_elements(v_body->'scales') s WHERE s->>'key' = v_key;
    IF v_scale IS NULL THEN
      RAISE EXCEPTION 'Version % has no scale %.', v_version, v_key USING ERRCODE = 'check_violation';
    END IF;
    IF v_scale->>'scope' <> 'bid' OR v_scale->>'source' <> 'picked' THEN
      RAISE EXCEPTION '% is rated on the GC, not picked on a bid.', COALESCE(v_scale->>'name', v_key) USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_scale->'rungs', '[]'::jsonb)) r WHERE (r->'points') = v_points) THEN
      RAISE EXCEPTION 'Version % has no % point rung on %.', v_version, v_points::text, v_key USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$fn$;

-- A trigger function is never called by hand.
REVOKE ALL ON FUNCTION public.bid_difficulty_picks_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bid_difficulty_picks_guard ON public.bid_difficulty_picks;
CREATE TRIGGER bid_difficulty_picks_guard
  BEFORE INSERT OR UPDATE ON public.bid_difficulty_picks
  FOR EACH ROW EXECUTE FUNCTION public.bid_difficulty_picks_guard();

-- 4. The gates.
ALTER TABLE public.bid_difficulty_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bid_difficulty_picks_select_signed_in ON public.bid_difficulty_picks;
CREATE POLICY bid_difficulty_picks_select_signed_in
  ON public.bid_difficulty_picks FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS bid_difficulty_picks_insert_pricing ON public.bid_difficulty_picks;
CREATE POLICY bid_difficulty_picks_insert_pricing
  ON public.bid_difficulty_picks FOR INSERT TO authenticated
  WITH CHECK (public.is_bid_pricing_user());

DROP POLICY IF EXISTS bid_difficulty_picks_update_pricing ON public.bid_difficulty_picks;
CREATE POLICY bid_difficulty_picks_update_pricing
  ON public.bid_difficulty_picks FOR UPDATE TO authenticated
  USING (public.is_bid_pricing_user())
  WITH CHECK (public.is_bid_pricing_user());

DROP POLICY IF EXISTS bid_difficulty_picks_delete_dev ON public.bid_difficulty_picks;
CREATE POLICY bid_difficulty_picks_delete_dev
  ON public.bid_difficulty_picks FOR DELETE TO authenticated
  USING (public.is_dev());

REVOKE ALL ON public.bid_difficulty_picks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bid_difficulty_picks TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
