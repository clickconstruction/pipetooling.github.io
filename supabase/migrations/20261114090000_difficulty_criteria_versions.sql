SET lock_timeout = '3s';

-- GC difficulty rating, PR 1 (punch list #357, v2.7275): the criteria, versioned.
--
-- The company loses bids when a master asks the estimator to add money to a price for a GC that is hard to work with,
-- with no reason attached. The owner's call of 2026-11-14: rate the GC once, in sentences a person picks from, and let
-- a price list the office owns turn the points into cost lines on the estimate. The sentences are the dev's and are
-- versioned: a rating and a priced bid pin to the version they were made under, so a new version never moves old points.
--
--   1. difficulty_criteria_versions — one row per version. `body` is the criteria: a list of scales, each with a stable
--      key, a name, its scope (gc or bid), its source (picked by a person, or read from the GC's bills), its maximum and
--      its rungs of {points, sentence} in order. The client's kernel (src/lib/bids/difficultyCriteria.ts) validates the
--      body and refuses to publish one that breaks the rules; the database holds the floor (an object with a scales
--      array). One draft at a time; a published row is immutable.
--   2. The guard: the dev's publish stamps who and when and takes the next version number; an update or a delete of a
--      published row is refused in a sentence; a draft's body must at least be an object with a scales array.
--   3. The gates: everyone signed in reads (the GC's card, the Workbench and the master's sheet read the published
--      version in later PRs); a dev alone writes.
--   4. Version 1, today's three scales: paying (read from bills, 0 to 1), field and superintendent (0 to 3), their
--      office (0 to 2). The site scale on the bid comes as version 2 in PR 6, published by the dev from the card.
--
-- Nothing prices anything from this table yet. PR 2 adds the ratings, PR 4 the price list and the lines.

-- 1. The versions.
CREATE TABLE IF NOT EXISTS public.difficulty_criteria_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  body jsonb NOT NULL DEFAULT '{"scales":[]}'::jsonb,
  note text NOT NULL DEFAULT '',
  published_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  published_by_name text NOT NULL DEFAULT '',
  published_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT difficulty_criteria_versions_status_known CHECK (status IN ('draft', 'published')),
  CONSTRAINT difficulty_criteria_versions_body_shape CHECK (jsonb_typeof(body) = 'object' AND jsonb_typeof(body->'scales') = 'array'),
  CONSTRAINT difficulty_criteria_versions_note_length CHECK (length(note) <= 400),
  CONSTRAINT difficulty_criteria_versions_published_stamped CHECK (status = 'draft' OR (published_at IS NOT NULL AND version >= 1))
);

COMMENT ON TABLE public.difficulty_criteria_versions IS
  'GC difficulty rating (punch list #357): the criteria a GC is rated on, one row per version. body.scales is the list of scales, each {key, name, scope, source, max, rungs:[{points, sentence}]}; src/lib/bids/difficultyCriteria.ts validates it. One draft at a time, edited by a dev from Settings → Difficulty criteria; publishing takes the next version number and freezes the row. A rating (gc_difficulty_ratings) and a priced bid (bid_difficulty) pin to the version they were made under.';
COMMENT ON COLUMN public.difficulty_criteria_versions.version IS 'The published version number, 1 and up. A draft carries 0 until it is published; the guard assigns the next number then.';
COMMENT ON COLUMN public.difficulty_criteria_versions.status IS 'draft (one at a time, a dev edits it) or published (immutable).';
COMMENT ON COLUMN public.difficulty_criteria_versions.body IS 'The criteria: {scales:[{key, name, scope: gc|bid, source: picked|bills, max, rungs:[{points, sentence}]}]}. The key carries a pick from one version to the next; the words and the points are the dev''s.';

-- One draft at a time; one row per published version number.
CREATE UNIQUE INDEX IF NOT EXISTS difficulty_criteria_versions_one_draft ON public.difficulty_criteria_versions ((status)) WHERE status = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS difficulty_criteria_versions_published_version ON public.difficulty_criteria_versions (version) WHERE status = 'published';

-- 2. The guard.
CREATE OR REPLACE FUNCTION public.difficulty_criteria_versions_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := '';
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'published' THEN
      RAISE EXCEPTION 'Version % is published and cannot be deleted. Ratings and priced bids pin to it.', OLD.version USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  NEW.note := btrim(COALESCE(NEW.note, ''));
  NEW.updated_at := now();
  IF v_uid IS NOT NULL THEN
    NEW.updated_by := v_uid;
    v_name := COALESCE((SELECT u.name FROM public.users u WHERE u.id = v_uid), '');
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_uid IS NOT NULL THEN
      NEW.created_by := v_uid;
    END IF;
    IF NEW.status = 'published' AND v_uid IS NOT NULL THEN
      -- A signed-in writer publishes a draft; it never inserts a published row.
      RAISE EXCEPTION 'Save the draft first, then publish it.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status = 'draft' THEN
      NEW.version := 0;
      NEW.published_at := NULL;
      NEW.published_by := NULL;
      NEW.published_by_name := '';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'Version % is published and cannot be changed. Start a draft and publish the next version.', OLD.version USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = 'published' THEN
    IF jsonb_array_length(NEW.body->'scales') < 1 THEN
      RAISE EXCEPTION 'A version needs at least one scale.' USING ERRCODE = 'check_violation';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('difficulty_criteria_versions'));
    NEW.version := COALESCE((SELECT max(v.version) FROM public.difficulty_criteria_versions v WHERE v.status = 'published'), 0) + 1;
    NEW.published_at := now();
    NEW.published_by := v_uid;
    NEW.published_by_name := v_name;
  ELSE
    NEW.version := 0;
    NEW.published_at := NULL;
    NEW.published_by := NULL;
    NEW.published_by_name := '';
  END IF;
  RETURN NEW;
END;
$fn$;

-- A trigger function is never called by hand.
REVOKE ALL ON FUNCTION public.difficulty_criteria_versions_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS difficulty_criteria_versions_guard ON public.difficulty_criteria_versions;
CREATE TRIGGER difficulty_criteria_versions_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.difficulty_criteria_versions
  FOR EACH ROW EXECUTE FUNCTION public.difficulty_criteria_versions_guard();

-- 3. The gates: everyone signed in reads, a dev writes.
ALTER TABLE public.difficulty_criteria_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS difficulty_criteria_versions_select_signed_in ON public.difficulty_criteria_versions;
CREATE POLICY difficulty_criteria_versions_select_signed_in
  ON public.difficulty_criteria_versions FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS difficulty_criteria_versions_insert_dev ON public.difficulty_criteria_versions;
CREATE POLICY difficulty_criteria_versions_insert_dev
  ON public.difficulty_criteria_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_dev());

DROP POLICY IF EXISTS difficulty_criteria_versions_update_dev ON public.difficulty_criteria_versions;
CREATE POLICY difficulty_criteria_versions_update_dev
  ON public.difficulty_criteria_versions FOR UPDATE TO authenticated
  USING (public.is_dev())
  WITH CHECK (public.is_dev());

DROP POLICY IF EXISTS difficulty_criteria_versions_delete_dev ON public.difficulty_criteria_versions;
CREATE POLICY difficulty_criteria_versions_delete_dev
  ON public.difficulty_criteria_versions FOR DELETE TO authenticated
  USING (public.is_dev());

REVOKE ALL ON public.difficulty_criteria_versions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.difficulty_criteria_versions TO authenticated;

-- 4. Version 1: today's three scales. The same JSON lives in src/lib/bids/difficultyCriteria.ts as
-- DIFFICULTY_CRITERIA_V1, and difficultyCriteria.test.ts reads this file to hold the two equal.
INSERT INTO public.difficulty_criteria_versions (version, status, body, note, published_by_name, published_at)
VALUES (
  1,
  'published',
  $json${"scales":[{"key":"paying","name":"Paying","scope":"gc","source":"bills","max":1,"rungs":[{"points":0,"sentence":"They pay at the GC pace, or faster."},{"points":1,"sentence":"They pay slow. Read from their bills against the price list's rule."}]},{"key":"field","name":"Field and superintendent","scope":"gc","source":"picked","max":3,"rungs":[{"points":0,"sentence":"The super sets a schedule and keeps it. Our crew walks on and works."},{"points":1,"sentence":"Small surprises. A locked gate, a late inspection, a trade in our way for a day."},{"points":2,"sentence":"The order of work changes after we mobilize, or the site is not ready when they call us out."},{"points":3,"sentence":"We remobilize more than once, the super fights every change order, or our crew waits on them every week."}]},{"key":"office","name":"Their office","scope":"gc","source":"picked","max":2,"rungs":[{"points":0,"sentence":"Pay apps go through the first time. One call settles a question."},{"points":1,"sentence":"Pay apps come back for paperwork, lien waivers are asked for twice, a question waits a week."},{"points":2,"sentence":"Every bill is a fight, or nobody at their office can be reached."}]}]}$json$::jsonb,
  'The three scales of 2026-11-14: paying from the bills, the field and the super, their office.',
  'the app',
  now()
)
ON CONFLICT (version) WHERE status = 'published' DO NOTHING;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
