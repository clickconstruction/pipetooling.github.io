SET lock_timeout = '3s';

-- Plan sets by part (punch list #239, PR 4: the bid). A bid pins what it was priced on; a job follows its part. Until
-- now nothing carried a set from a bid to the job it became: the folder maker reused the bid's Drive folder and stamped
-- an empty Plans subfolder on the job. Here the bid names the set it was priced on (bids.priced_on_set_id, one of its
-- own bid_plan_sets rows; null means the set the robot reads, so every old bid reads sensibly and nothing is
-- backfilled), the office reads what the bid's jobs build from today for the amber note when a part moved on
-- (list_bid_jobs_plan_state), and a job opened from a bid starts its part building from the bid's set by trigger, so
-- the hand-off works from every door that makes a job (the New Job form, Dispatch's Open the job, a robot).
-- See docs/migrations/20261102060000_bid_priced_on_set.md.

-- ── the bid pins what it was priced on ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS priced_on_set_id uuid REFERENCES public.bid_plan_sets(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.bids.priced_on_set_id IS
  'Plan sets by part (#239, PR 4): the bid_plan_sets row this bid was priced on. Null means the set the robot reads (the row carrying plans_link, else plans_link itself), so an old bid needs no backfill. A job opened from the bid starts its part building from this set (jobs_ledger_seed_part_from_bid).';

-- ── two links are the same set when they differ only by space, a trailing slash or Drive's ?usp= tail ────────────
-- The client's samePlanLink (src/lib/bids/bidPlanSets.ts) in SQL, so the trigger and the client agree.
CREATE OR REPLACE FUNCTION public.plan_set_link_key(p_link text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(regexp_replace(regexp_replace(btrim(COALESCE(p_link, '')), '[?&]usp=[^&#]*', '', 'g'), '\?$', ''), '/+$', '')
$$;
COMMENT ON FUNCTION public.plan_set_link_key(text) IS 'Plan sets by part (#239): a Drive link with its ?usp= tail, trailing slash and surrounding space removed, so two spellings of one set compare equal.';

-- ── what the bid's jobs build from today, for the amber note ─────────────────────────────────────────────────────
-- An estimator reads no job row (list_bid_jobs_opened, v2.5659, exists for the same reason), so the state of the parts
-- the bid's jobs name is read here as the definer, for the office and estimators who may price the bid.
CREATE OR REPLACE FUNCTION public.list_bid_jobs_plan_state(p_bid_ids uuid[])
RETURNS TABLE (
  bid_id uuid,
  job_id uuid,
  hcp_number text,
  click_number text,
  job_name text,
  part_id uuid,
  part_name text,
  set_id uuid,
  set_name text,
  set_kind text,
  set_dated date,
  set_link text,
  set_came_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT j.bid_id, j.id, j.hcp_number, j.click_number, j.job_name, p.id, p.name, s.id, s.name, s.kind, s.dated, s.link, s.came_at
  FROM public.jobs_ledger j
  LEFT JOIN public.plan_parts p ON p.id = j.plan_part_id
  LEFT JOIN public.plan_sets s ON s.id = p.current_set_id
  WHERE j.bid_id = ANY (COALESCE(p_bid_ids, '{}'::uuid[]))
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator')
    )
    AND public.can_access_bid_for_pricing(j.bid_id)
  ORDER BY j.bid_id, j.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.list_bid_jobs_plan_state(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_bid_jobs_plan_state(uuid[]) TO authenticated, service_role;
COMMENT ON FUNCTION public.list_bid_jobs_plan_state(uuid[]) IS
  'Plan sets by part (#239, PR 4): for each job opened from the bids given, the part it names and the set that part builds from today (name, kind, date, link), for the office and estimators who may price the bid. The bid form reads it to say when a part moved on past the set the bid was priced on.';

-- ── a job opened from a bid starts its part building from the bid's set ──────────────────────────────────────────
-- AFTER INSERT, since a job's own part references the job row. The set the bid was priced on is the pinned row, else
-- the row carrying plans_link, else plans_link itself as a set named Plans. On a development the job joins a part that
-- already builds from that same set (the same building, already in the register); else a part named after the job is
-- made (or joined, when the site has one by that name) and, when it builds from nothing yet, seeded with the set. The
-- job then names the part, and the existing mirror writes job_plans_link. Best effort: a failure is a warning in the
-- log and the job is saved as it was, the way the client carries the bid's budget.
CREATE OR REPLACE FUNCTION public.jobs_ledger_seed_part_from_bid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bid_number text;
  v_plans_link text;
  v_priced_on uuid;
  v_row_id uuid;
  v_name text;
  v_memo text;
  v_dated date;
  v_link text;
  v_part uuid;
  v_part_name text;
  v_set uuid;
  v_current uuid;
BEGIN
  IF NEW.bid_id IS NULL OR NEW.plan_part_id IS NOT NULL THEN RETURN NEW; END IF;
  BEGIN
    SELECT b.bid_number, btrim(COALESCE(b.plans_link, '')), b.priced_on_set_id INTO v_bid_number, v_plans_link, v_priced_on
    FROM public.bids b WHERE b.id = NEW.bid_id;
    IF NOT FOUND THEN RETURN NEW; END IF;

    SELECT r.id, r.name, r.memo, r.plan_date, r.link INTO v_row_id, v_name, v_memo, v_dated, v_link
    FROM public.bid_plan_sets r WHERE r.id = v_priced_on AND r.bid_id = NEW.bid_id;
    IF v_row_id IS NULL AND v_plans_link <> '' THEN
      SELECT r.id, r.name, r.memo, r.plan_date, r.link INTO v_row_id, v_name, v_memo, v_dated, v_link
      FROM public.bid_plan_sets r
      WHERE r.bid_id = NEW.bid_id AND public.plan_set_link_key(r.link) = public.plan_set_link_key(v_plans_link)
      ORDER BY r.created_at LIMIT 1;
    END IF;
    IF v_row_id IS NULL THEN
      IF v_plans_link = '' THEN RETURN NEW; END IF;
      v_name := 'Plans';
      v_memo := '';
      v_dated := NULL;
      v_link := v_plans_link;
    END IF;
    IF btrim(COALESCE(v_link, '')) = '' THEN RETURN NEW; END IF;

    -- A part on the job's development already building from this set: the job joins it.
    IF NEW.development_id IS NOT NULL THEN
      SELECT p.id INTO v_part
      FROM public.plan_parts p JOIN public.plan_sets s ON s.id = p.current_set_id
      WHERE p.development_id = NEW.development_id AND public.plan_set_link_key(s.link) = public.plan_set_link_key(v_link)
      ORDER BY p.position, p.created_at LIMIT 1;
    END IF;

    IF v_part IS NULL THEN
      v_part_name := left(COALESCE(
        NULLIF(btrim(COALESCE(NEW.job_name, '')), ''),
        'JP' || NULLIF(btrim(COALESCE(NEW.click_number, '')), ''),
        NULLIF(btrim(COALESCE(NEW.hcp_number, '')), ''),
        'Job'), 120);
      IF NEW.development_id IS NOT NULL THEN
        SELECT p.id INTO v_part FROM public.plan_parts p
        WHERE p.development_id = NEW.development_id AND lower(btrim(p.name)) = lower(btrim(v_part_name));
        IF v_part IS NULL THEN
          INSERT INTO public.plan_parts (development_id, name, position, created_by)
          VALUES (NEW.development_id, v_part_name, (SELECT COALESCE(max(p2.position), -1) + 1 FROM public.plan_parts p2 WHERE p2.development_id = NEW.development_id), auth.uid())
          RETURNING id INTO v_part;
        END IF;
      ELSE
        INSERT INTO public.plan_parts (job_id, name, created_by)
        VALUES (NEW.id, v_part_name, auth.uid())
        RETURNING id INTO v_part;
      END IF;

      SELECT p.current_set_id INTO v_current FROM public.plan_parts p WHERE p.id = v_part;
      IF v_current IS NULL THEN
        INSERT INTO public.plan_sets (part_id, name, kind, source, dated, memo, link, created_by)
        VALUES (
          v_part,
          left(v_name, 200),
          'issued',
          'gc',
          v_dated,
          left('From B' || COALESCE(v_bid_number, '?') || ', the set it was priced on' || CASE WHEN COALESCE(v_memo, '') <> '' THEN ' · ' || v_memo ELSE '' END, 2000),
          v_link,
          auth.uid())
        RETURNING id INTO v_set;
        UPDATE public.plan_parts SET current_set_id = v_set, current_set_by = auth.uid(), current_set_at = now() WHERE id = v_part;
      END IF;
    END IF;

    -- The job names its part; the BEFORE UPDATE mirror (jobs_ledger_mirror_plan_part) writes job_plans_link.
    UPDATE public.jobs_ledger SET plan_part_id = v_part WHERE id = NEW.id AND plan_part_id IS NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'plan sets (#239): job % did not take the set its bid % was priced on: %', NEW.id, NEW.bid_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.jobs_ledger_seed_part_from_bid() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.jobs_ledger_seed_part_from_bid() IS
  'Plan sets by part (#239, PR 4): a job opened from a bid joins the development part already building from the set the bid was priced on, or gets a part named after itself seeded with that set, and names it; the mirror then writes job_plans_link. Best effort: a failure warns and leaves the job as it was.';
DROP TRIGGER IF EXISTS jobs_ledger_seed_part_from_bid ON public.jobs_ledger;
CREATE TRIGGER jobs_ledger_seed_part_from_bid
  AFTER INSERT ON public.jobs_ledger
  FOR EACH ROW EXECUTE FUNCTION public.jobs_ledger_seed_part_from_bid();
