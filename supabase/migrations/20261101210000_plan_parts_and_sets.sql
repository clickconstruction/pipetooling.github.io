SET lock_timeout = '3s';

-- Plan sets by part (punch list #239, PR 1: the ground). The owner's two cases, 2026-11-01: an updated set arrives
-- halfway through a project, and the crew makes its own as-builts and wants them kept with the build. Today a bid
-- carries set rows (bid_plan_sets, v2.6168) but a job holds one link (jobs_ledger.job_plans_link), nothing carries a
-- set from a bid to the job it becomes, and the Development page's Plans look counts a job's empty Plans folder as a
-- set. The Gun Dog read-out showed the shape: two sets were current at once, for two buildings, and ten jobs read
-- "on an older set" with no door to move them.
--
-- The design (option D of the read-out): a set belongs to a PART of a site — the Lodge, the Bunker, the whole site —
-- and each part has one set it builds from. A job names its part and follows it, so it never needs moving. A job
-- outside any development owns its own part, made the day it is made, so a standalone job gets the same thing. A
-- bid keeps its own rows and pins what it was priced on. An as-built is a set of kind as_built, on the job that made
-- it, marking up the set it built from. The job's old plans link stays and mirrors the current set's link, so the
-- portal, the dashboards and every old read keep working untouched.
-- See docs/migrations/20261101210000_plan_parts_and_sets.md.

-- ── plan_parts ───────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plan_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Exactly one owner: a development (the Lodge, the Bunker, the whole site) or one job outside any development.
  development_id uuid REFERENCES public.developments(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  name text NOT NULL
    CONSTRAINT plan_parts_name_length CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  position integer NOT NULL DEFAULT 0,
  -- The set this part builds from today; who set it and when. The FK lands after plan_sets exists.
  current_set_id uuid,
  current_set_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  current_set_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_parts_one_owner CHECK ((development_id IS NULL) <> (job_id IS NULL))
);

COMMENT ON TABLE public.plan_parts IS
  'Plan sets by part (#239, 2026-11-01): a part of a site that builds from one set of plans at a time — a building or area of a development, or a job outside any development, which owns exactly one part. current_set_id is the set the part builds from today. A job names its part on jobs_ledger.plan_part_id and follows it.';

CREATE UNIQUE INDEX IF NOT EXISTS plan_parts_job_one ON public.plan_parts (job_id) WHERE job_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS plan_parts_development_name ON public.plan_parts (development_id, lower(btrim(name))) WHERE development_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS plan_parts_development ON public.plan_parts (development_id, position, created_at) WHERE development_id IS NOT NULL;

DROP TRIGGER IF EXISTS plan_parts_set_updated_at ON public.plan_parts;
CREATE TRIGGER plan_parts_set_updated_at
  BEFORE UPDATE ON public.plan_parts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── plan_sets ────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plan_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL REFERENCES public.plan_parts(id) ON DELETE CASCADE,
  -- What the office calls it: Issued set, Addendum 2, Permit set, As-built Nov 1.
  name text NOT NULL
    CONSTRAINT plan_sets_name_length CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  -- What kind of set: issued, addendum, bulletin, revised, permit, construction, assembled (ours, from other sets),
  -- as_built (ours, marking up the set we built from).
  kind text NOT NULL DEFAULT 'issued'
    CONSTRAINT plan_sets_kind_known CHECK (kind IN ('issued', 'addendum', 'bulletin', 'revised', 'permit', 'construction', 'assembled', 'as_built')),
  -- Who the set came from.
  source text NOT NULL DEFAULT 'gc'
    CONSTRAINT plan_sets_source_known CHECK (source IN ('gc', 'architect', 'ours')),
  -- The date printed on the sheets; a civil date, no time. Null when nobody read one.
  dated date,
  -- The day it reached us.
  came_at timestamptz NOT NULL DEFAULT now(),
  memo text NOT NULL DEFAULT ''
    CONSTRAINT plan_sets_memo_length CHECK (length(memo) <= 2000),
  -- A Drive folder or file link, the shape bids.plans_link takes; '' while the files are on their way.
  link text NOT NULL DEFAULT ''
    CONSTRAINT plan_sets_link_shape CHECK (link = '' OR (link ~ '^https?://' AND length(link) <= 2000)),
  -- The set this one replaces (an addendum over the issued set), and the set an as-built marks up.
  replaces_set_id uuid REFERENCES public.plan_sets(id) ON DELETE SET NULL,
  marks_up_set_id uuid REFERENCES public.plan_sets(id) ON DELETE SET NULL,
  -- The job that made it: set on an as-built, so it stays with that job even when the part is the site's.
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  -- What plan-fetch's probe last read behind the link, as bid_plan_sets keeps it.
  file_name text
    CONSTRAINT plan_sets_file_name_length CHECK (file_name IS NULL OR length(file_name) <= 300),
  file_size bigint
    CONSTRAINT plan_sets_file_size_nonneg CHECK (file_size IS NULL OR file_size >= 0),
  file_count integer
    CONSTRAINT plan_sets_file_count_nonneg CHECK (file_count IS NULL OR file_count >= 0),
  checked_at timestamptz,
  check_note text
    CONSTRAINT plan_sets_check_note_length CHECK (check_note IS NULL OR length(check_note) <= 500),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.plan_sets IS
  'Plan sets by part (#239, 2026-11-01): one row per set of plans on a part — its name, kind, who it came from, the date on the sheets, the day it came, a memo, its Drive link, the set it replaces or marks up, and the job that made it (an as-built). The part''s current_set_id says which one the part builds from. bids.plans_link and bid_plan_sets stay the bid''s own: a bid pins what it was priced on.';

CREATE INDEX IF NOT EXISTS plan_sets_part ON public.plan_sets (part_id, dated DESC NULLS LAST, came_at DESC);
CREATE INDEX IF NOT EXISTS plan_sets_job ON public.plan_sets (job_id) WHERE job_id IS NOT NULL;

DROP TRIGGER IF EXISTS plan_sets_set_updated_at ON public.plan_sets;
CREATE TRIGGER plan_sets_set_updated_at
  BEFORE UPDATE ON public.plan_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- The part's current set points at one of its own sets.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plan_parts_current_set_id_fkey') THEN
    ALTER TABLE public.plan_parts
      ADD CONSTRAINT plan_parts_current_set_id_fkey FOREIGN KEY (current_set_id) REFERENCES public.plan_sets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── the job names its part ───────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.jobs_ledger ADD COLUMN IF NOT EXISTS plan_part_id uuid REFERENCES public.plan_parts(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.jobs_ledger.plan_part_id IS
  'Plan sets by part (#239): the part of the site this job builds from — a development''s part, or the job''s own part when it is outside any development. Null until the office names one. job_plans_link mirrors the part''s current set''s link (plan_part_mirror_job_links).';
CREATE INDEX IF NOT EXISTS jobs_ledger_plan_part ON public.jobs_ledger (plan_part_id) WHERE plan_part_id IS NOT NULL;

-- ── the mirror: job_plans_link follows the current set ───────────────────────────────────────────────────────────
-- Every old reader of job_plans_link (the trade portal, the dashboards, the job window's Open plans) keeps working:
-- when a part's current set changes, or a job names a part, the job's link becomes that set's link. SECURITY
-- DEFINER, because an estimator may switch a part's set without the right to update jobs_ledger rows directly.
CREATE OR REPLACE FUNCTION public.plan_part_mirror_job_links(p_part_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_link text;
BEGIN
  SELECT s.link INTO v_link
  FROM public.plan_parts p
  JOIN public.plan_sets s ON s.id = p.current_set_id
  WHERE p.id = p_part_id;
  IF v_link IS NULL OR btrim(v_link) = '' THEN
    RETURN;
  END IF;
  UPDATE public.jobs_ledger j
  SET job_plans_link = v_link
  WHERE j.plan_part_id = p_part_id
    AND j.job_plans_link IS DISTINCT FROM v_link;
END;
$$;
REVOKE ALL ON FUNCTION public.plan_part_mirror_job_links(uuid) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.plan_part_mirror_job_links(uuid) IS
  'Plan sets by part (#239): writes the part''s current set''s link onto job_plans_link of every job naming the part. Called by the triggers on plan_parts (current set changed), plan_sets (the current set''s link changed) and jobs_ledger (a job named a part).';

CREATE OR REPLACE FUNCTION public.plan_parts_mirror_on_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.current_set_id IS NOT DISTINCT FROM OLD.current_set_id THEN
    RETURN NEW;
  END IF;
  PERFORM public.plan_part_mirror_job_links(NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS plan_parts_mirror_on_change ON public.plan_parts;
CREATE TRIGGER plan_parts_mirror_on_change
  AFTER UPDATE OF current_set_id ON public.plan_parts
  FOR EACH ROW EXECUTE FUNCTION public.plan_parts_mirror_on_change();

CREATE OR REPLACE FUNCTION public.plan_sets_mirror_on_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.link IS DISTINCT FROM OLD.link THEN
    PERFORM public.plan_part_mirror_job_links(NEW.part_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS plan_sets_mirror_on_change ON public.plan_sets;
CREATE TRIGGER plan_sets_mirror_on_change
  AFTER UPDATE OF link ON public.plan_sets
  FOR EACH ROW EXECUTE FUNCTION public.plan_sets_mirror_on_change();

CREATE OR REPLACE FUNCTION public.jobs_ledger_mirror_plan_part()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_link text;
BEGIN
  IF NEW.plan_part_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.plan_part_id IS NOT DISTINCT FROM OLD.plan_part_id THEN
    RETURN NEW;
  END IF;
  SELECT s.link INTO v_link
  FROM public.plan_parts p
  JOIN public.plan_sets s ON s.id = p.current_set_id
  WHERE p.id = NEW.plan_part_id;
  IF v_link IS NOT NULL AND btrim(v_link) <> '' THEN
    NEW.job_plans_link := v_link;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS jobs_ledger_mirror_plan_part ON public.jobs_ledger;
CREATE TRIGGER jobs_ledger_mirror_plan_part
  BEFORE INSERT OR UPDATE OF plan_part_id ON public.jobs_ledger
  FOR EACH ROW EXECUTE FUNCTION public.jobs_ledger_mirror_plan_part();

-- ── who can see and write ────────────────────────────────────────────────────────────────────────────────────────
-- See a part when you can see its owner under your own RLS: the development row, or the job (the ledger, or its
-- team, as on_site_can_touch_job reads it for the crew). Not SECURITY DEFINER, so the owner's RLS applies.
CREATE OR REPLACE FUNCTION public.plan_part_can_see(p_part_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.plan_parts p
    WHERE p.id = p_part_id
      AND (
        (p.development_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.developments d WHERE d.id = p.development_id))
        OR (p.job_id IS NOT NULL AND public.on_site_can_touch_job(p.job_id))
      )
  )
$$;
COMMENT ON FUNCTION public.plan_part_can_see(uuid) IS 'Plan sets by part (#239): the caller can see the part''s owner — the development row, or the job in the ledger or on its team.';
GRANT EXECUTE ON FUNCTION public.plan_part_can_see(uuid) TO authenticated, service_role;

-- Write a part or a set as the office: the five roles that fill the bid form's Plans section.
CREATE OR REPLACE FUNCTION public.plan_part_can_write(p_part_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT public.plan_part_can_see(p_part_id)
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid())
      AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role]))
$$;
COMMENT ON FUNCTION public.plan_part_can_write(uuid) IS 'Plan sets by part (#239): the caller can see the part and is dev, master, assistant, controller or estimator.';
GRANT EXECUTE ON FUNCTION public.plan_part_can_write(uuid) TO authenticated, service_role;

ALTER TABLE public.plan_parts ENABLE ROW LEVEL SECURITY;

-- The row's own columns, not plan_part_can_see(id): a policy that reads its own table through a function recurses.
DROP POLICY IF EXISTS plan_parts_select ON public.plan_parts;
CREATE POLICY plan_parts_select ON public.plan_parts
  FOR SELECT TO authenticated USING (
    (development_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.developments d WHERE d.id = plan_parts.development_id))
    OR (job_id IS NOT NULL AND public.on_site_can_touch_job(plan_parts.job_id))
  );
-- A new part: the office, on a development or a job it can see (the row does not exist yet, so the owner is checked).
DROP POLICY IF EXISTS plan_parts_insert ON public.plan_parts;
CREATE POLICY plan_parts_insert ON public.plan_parts
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid())
      AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role]))
    AND (
      (development_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.developments d WHERE d.id = development_id))
      OR (job_id IS NOT NULL AND public.on_site_can_touch_job(job_id))
    )
  );
DROP POLICY IF EXISTS plan_parts_update ON public.plan_parts;
CREATE POLICY plan_parts_update ON public.plan_parts
  FOR UPDATE TO authenticated USING (public.plan_part_can_write(id)) WITH CHECK (public.plan_part_can_write(id));
DROP POLICY IF EXISTS plan_parts_delete ON public.plan_parts;
CREATE POLICY plan_parts_delete ON public.plan_parts
  FOR DELETE TO authenticated USING (public.plan_part_can_write(id));

ALTER TABLE public.plan_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_sets_select ON public.plan_sets;
CREATE POLICY plan_sets_select ON public.plan_sets
  FOR SELECT TO authenticated USING (public.plan_part_can_see(part_id));
-- A new set: the office on any part it can see; a crew member an as-built on a job they are on (the part is the job's).
DROP POLICY IF EXISTS plan_sets_insert ON public.plan_sets;
CREATE POLICY plan_sets_insert ON public.plan_sets
  FOR INSERT TO authenticated WITH CHECK (
    public.plan_part_can_write(part_id)
    OR (
      kind = 'as_built' AND source = 'ours' AND job_id IS NOT NULL
      AND public.plan_part_can_see(part_id)
      AND EXISTS (SELECT 1 FROM public.jobs_ledger_team_members m WHERE m.job_id = plan_sets.job_id AND m.user_id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = plan_sets.job_id AND j.plan_part_id = plan_sets.part_id)
    )
  );
DROP POLICY IF EXISTS plan_sets_update ON public.plan_sets;
CREATE POLICY plan_sets_update ON public.plan_sets
  FOR UPDATE TO authenticated USING (
    public.plan_part_can_write(part_id)
    OR (kind = 'as_built' AND created_by = (SELECT auth.uid()))
  ) WITH CHECK (
    public.plan_part_can_write(part_id)
    OR (kind = 'as_built' AND created_by = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS plan_sets_delete ON public.plan_sets;
CREATE POLICY plan_sets_delete ON public.plan_sets
  FOR DELETE TO authenticated USING (
    public.plan_part_can_write(part_id)
    OR (kind = 'as_built' AND created_by = (SELECT auth.uid()))
  );

REVOKE ALL ON TABLE public.plan_parts FROM anon;
REVOKE ALL ON TABLE public.plan_sets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.plan_parts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.plan_sets TO authenticated;
GRANT ALL ON TABLE public.plan_parts TO service_role;
GRANT ALL ON TABLE public.plan_sets TO service_role;

-- House rules: read-only training mode + the digital-twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
