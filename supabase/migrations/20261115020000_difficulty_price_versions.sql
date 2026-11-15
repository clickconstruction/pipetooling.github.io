SET lock_timeout = '3s';

-- GC difficulty rating, PR 4 (punch list #357, v2.7301): the price list, versioned.
--
-- The office owns what a point costs (the owner's call of 2026-11-14): each field point a percent of the bid's field
-- hours at its labor rate, each office point so many office hours at the office rate, each site point a percent of
-- field hours (the site scale comes in PR 6), the paying point a monthly rate on the price for the days past the
-- threshold, all lines together never more than a percent of the bid's own cost. The owner and the controller edit it
-- from the Bid Board behind Pricing rules; estimators read it. It is versioned like the criteria: a published row is
-- immutable, a bid priced under version 1 keeps its lines when version 2 is published.
--
--   1. difficulty_price_versions — one row per version; `body` is the price list, validated by the client's kernel
--      (src/lib/bids/difficultyPrice.ts); the database holds the floor (an object).
--   2. The guard, the criteria's twin: a publish stamps who and when and takes the next number; a published row is
--      never changed or deleted.
--   3. The gates: everyone signed in reads; the owner, the controller and a dev write.
--   4. Version 1 with the canvas's numbers.

-- 1. The versions.
CREATE TABLE IF NOT EXISTS public.difficulty_price_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text NOT NULL DEFAULT '',
  published_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  published_by_name text NOT NULL DEFAULT '',
  published_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT difficulty_price_versions_status_known CHECK (status IN ('draft', 'published')),
  CONSTRAINT difficulty_price_versions_body_shape CHECK (jsonb_typeof(body) = 'object'),
  CONSTRAINT difficulty_price_versions_note_length CHECK (length(note) <= 400),
  CONSTRAINT difficulty_price_versions_published_stamped CHECK (status = 'draft' OR (published_at IS NOT NULL AND version >= 1))
);

COMMENT ON TABLE public.difficulty_price_versions IS
  'GC difficulty rating (punch list #357): the price list that turns a rating''s points into cost lines on a bid, one row per version. body is {fieldPctPerPoint, officeHoursPerPoint, officeRate, sitePctPerPoint, payingDaysPast, payingMonthlyRate, payingMinBills, payingLateBillsInYear, capPct, raters}; src/lib/bids/difficultyPrice.ts validates it. The owner and the controller edit the draft from the Bid Board behind Pricing rules and publish it; a published row is immutable, and a priced bid (bid_difficulty) pins to the version it was priced under.';
COMMENT ON COLUMN public.difficulty_price_versions.version IS 'The published version number, 1 and up. A draft carries 0 until it is published; the guard assigns the next number then.';
COMMENT ON COLUMN public.difficulty_price_versions.status IS 'draft (one at a time) or published (immutable).';
COMMENT ON COLUMN public.difficulty_price_versions.body IS 'The price list. fieldPctPerPoint and sitePctPerPoint are percents of the bid''s field hours per point at its labor rate; officeHoursPerPoint hours per point at officeRate dollars an hour; the paying point is payingMonthlyRate percent a month on the price for the days the median runs past payingDaysPast, read once a GC has payingMinBills bills, or when payingLateBillsInYear bills in a year ran past their calendar; capPct is the most all lines together may add, as a percent of the bid''s own cost; raters is who may rate a GC (office, estimator, master).';

CREATE UNIQUE INDEX IF NOT EXISTS difficulty_price_versions_one_draft ON public.difficulty_price_versions ((status)) WHERE status = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS difficulty_price_versions_published_version ON public.difficulty_price_versions (version) WHERE status = 'published';

-- 2. The guard.
CREATE OR REPLACE FUNCTION public.difficulty_price_versions_guard()
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
      RAISE EXCEPTION 'Price list version % is published and cannot be deleted. Priced bids pin to it.', OLD.version USING ERRCODE = 'check_violation';
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
    RAISE EXCEPTION 'Price list version % is published and cannot be changed. Save the next version instead.', OLD.version USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = 'published' THEN
    PERFORM pg_advisory_xact_lock(hashtext('difficulty_price_versions'));
    NEW.version := COALESCE((SELECT max(v.version) FROM public.difficulty_price_versions v WHERE v.status = 'published'), 0) + 1;
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

REVOKE ALL ON FUNCTION public.difficulty_price_versions_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS difficulty_price_versions_guard ON public.difficulty_price_versions;
CREATE TRIGGER difficulty_price_versions_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.difficulty_price_versions
  FOR EACH ROW EXECUTE FUNCTION public.difficulty_price_versions_guard();

-- 3. The gates: everyone signed in reads; the owner, the controller and a dev write.
ALTER TABLE public.difficulty_price_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS difficulty_price_versions_select_signed_in ON public.difficulty_price_versions;
CREATE POLICY difficulty_price_versions_select_signed_in
  ON public.difficulty_price_versions FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS difficulty_price_versions_insert_owner ON public.difficulty_price_versions;
CREATE POLICY difficulty_price_versions_insert_owner
  ON public.difficulty_price_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_master_or_dev() OR public.is_controller());

DROP POLICY IF EXISTS difficulty_price_versions_update_owner ON public.difficulty_price_versions;
CREATE POLICY difficulty_price_versions_update_owner
  ON public.difficulty_price_versions FOR UPDATE TO authenticated
  USING (public.is_master_or_dev() OR public.is_controller())
  WITH CHECK (public.is_master_or_dev() OR public.is_controller());

DROP POLICY IF EXISTS difficulty_price_versions_delete_owner ON public.difficulty_price_versions;
CREATE POLICY difficulty_price_versions_delete_owner
  ON public.difficulty_price_versions FOR DELETE TO authenticated
  USING (public.is_master_or_dev() OR public.is_controller());

REVOKE ALL ON public.difficulty_price_versions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.difficulty_price_versions TO authenticated;

-- 4. Version 1: the canvas's numbers. The same JSON lives in src/lib/bids/difficultyPrice.ts as DIFFICULTY_PRICE_V1,
-- and difficultyPrice.test.ts reads this file to hold the two equal.
INSERT INTO public.difficulty_price_versions (version, status, body, note, published_by_name, published_at)
VALUES (
  1,
  'published',
  $json${"fieldPctPerPoint":5,"officeHoursPerPoint":12,"officeRate":80,"sitePctPerPoint":4,"payingDaysPast":45,"payingMonthlyRate":1.5,"payingMinBills":3,"payingLateBillsInYear":2,"capPct":10,"raters":["office","master"]}$json$::jsonb,
  'The numbers of the 2026-11-14 canvas, until the owner or the controller saves the next version.',
  'the app',
  now()
)
ON CONFLICT (version) WHERE status = 'published' DO NOTHING;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
