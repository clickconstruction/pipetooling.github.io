SET lock_timeout = '3s';

-- GC mode, the Building lane's U8 (v2.5147): our own crew from its Pipeline job
-- (to-dos/gc-mode/mockups/building-u8.md on branch spike/gc-mode). A trade our own crew does names the
-- Pipeline job it runs on. Then the daily log reads how many of our people clocked in on that job each
-- day, and the stages read that job's percent. One column, its guard and two functions. No table is created.
--
-- PUSH IN A QUIET MOMENT: the foreign key takes a brief SHARE ROW EXCLUSIVE lock on jobs_ledger, which
-- holds the office's job writes for the instant it is added. The new column is null on every row, so
-- there is nothing to scan. The lock timeout above makes it fail fast rather than queue the office.

-- 1) The column: the Pipeline job our own crew's trade runs on. It lets go when the job is deleted.
ALTER TABLE public.gc_trade_packages
  ADD COLUMN IF NOT EXISTS job_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS gc_trade_packages_job_ledger_idx ON public.gc_trade_packages (job_ledger_id)
  WHERE job_ledger_id IS NOT NULL;
COMMENT ON COLUMN public.gc_trade_packages.job_ledger_id IS
  'GC mode (v2.5147, Building U8): the Pipeline job a trade our own crew does (ours) runs on. Its clock-ins are our crew''s head count on the daily log (gc_crew_on_site), and its stage progress is our crew''s percent, which Bill the owner bills from. A signed-in person changes it only through gc_link_crew_job (gc_trade_packages_crew_job_guard). Null: not linked yet. Every reader also asks for ours.';

-- 2) The guard. A wrong link changes what the owner's bill reads for our crew, so a signed-in person changes the
-- column only inside gc_link_crew_job, which turns this transaction's gc.crew_job_write flag on for its UPDATE and
-- off after it (the award guard's shape, 20261010025000). Two writes pass without it: the key letting go inside its
-- own trigger (the job's ON DELETE SET NULL), and server code with no person (auth.uid() IS NULL: the service
-- role, a migration, a bed's fixtures). No role is named, so a dev's plain UPDATE is refused too, and Building's
-- door changes only gc_link_crew_job's gate.
CREATE OR REPLACE FUNCTION public.gc_trade_packages_crew_job_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_changed := NEW.job_ledger_id IS NOT NULL;
  ELSE
    v_changed := NEW.job_ledger_id IS DISTINCT FROM OLD.job_ledger_id;
  END IF;
  IF v_changed AND current_setting('gc.crew_job_write', true) IS DISTINCT FROM 'on'
     AND pg_trigger_depth() < 2 AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Our crew''s Pipeline job changes only through Pick its Pipeline job on Draws.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.gc_trade_packages_crew_job_guard() IS
  'GC mode (v2.5147, Building U8): the trigger that lets a signed-in person change gc_trade_packages.job_ledger_id only inside gc_link_crew_job, which sets gc.crew_job_write for its UPDATE. A cascade passes (pg_trigger_depth() > 1), and so does server code with no person (auth.uid() IS NULL). No role is named.';

-- Every row of every INSERT and UPDATE, not UPDATE OF, so no other trigger's change slips past it.
CREATE OR REPLACE TRIGGER gc_trade_packages_crew_job_guard BEFORE INSERT OR UPDATE ON public.gc_trade_packages
  FOR EACH ROW EXECUTE FUNCTION public.gc_trade_packages_crew_job_guard();

-- 3) Link our crew's trade to its Pipeline job, or let go of it (p_job_ledger_id null). SECURITY
-- INVOKER, so the trade's own policy decides who may write it as well.
CREATE OR REPLACE FUNCTION public.gc_link_crew_job(p_package_id uuid, p_job_ledger_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ours boolean;
  v_billing_only boolean;
BEGIN
  -- The table's read-only blocks and the twin fence refuse the write too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot link a Pipeline job.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot link a Pipeline job.' USING ERRCODE = '42501';
  END IF;
  -- Building is a dev's while it is built. Its door changes this gate.
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev links our crew''s Pipeline job while Building is built.' USING ERRCODE = '42501';
  END IF;

  SELECT k.ours INTO v_ours FROM public.gc_trade_packages k WHERE k.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No trade with that id.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_ours THEN
    RAISE EXCEPTION 'Only a trade our own crew does has a Pipeline job.' USING ERRCODE = '22023';
  END IF;

  IF p_job_ledger_id IS NOT NULL THEN
    SELECT j.billing_only INTO v_billing_only FROM public.jobs_ledger j WHERE j.id = p_job_ledger_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No Pipeline job with that id.' USING ERRCODE = 'P0002';
    END IF;
    -- Nobody clocks in on a billing-only job (20261009130000), so it would never count anyone.
    IF v_billing_only THEN
      RAISE EXCEPTION 'That job is for billing only. Nobody clocks in on it. Pick the job our crew works on.' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM set_config('gc.crew_job_write', 'on', true);
  UPDATE public.gc_trade_packages SET job_ledger_id = p_job_ledger_id WHERE id = p_package_id;
  PERFORM set_config('gc.crew_job_write', '', true);
END;
$$;

REVOKE ALL ON FUNCTION public.gc_link_crew_job(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_link_crew_job(uuid, uuid) TO authenticated;
COMMENT ON FUNCTION public.gc_link_crew_job(uuid, uuid) IS
  'GC mode (v2.5147, Building U8): names the Pipeline job a trade our own crew does runs on, or lets go of it (null). Refuses a training account, a digital twin, anyone but a dev while Building is built, a trade we hire, a job that does not exist and a billing-only job. Writes under gc.crew_job_write, the flag gc_trade_packages_crew_job_guard reads. SECURITY INVOKER: the trade''s own policy applies too.';

-- 4) How many of our people clocked in on our crew's Pipeline job, a trade and a day at a time. Counts
-- only, never a name, an hour or pay, so its door can open wider than clock_sessions' own policy.
-- A person counts once a day however many times they punched. A punch counts while it waits for
-- approval. A revoked or rejected session does not count, nor a salary day the app fills in itself
-- (origin 'salary_schedule'), nor a quick add (office minutes for an off-hours call, not time on
-- site), nor a sample account or a digital twin. work_date is the company's day, as the log's is.
CREATE OR REPLACE FUNCTION public.gc_crew_on_site(p_project_id uuid, p_from date, p_to date)
RETURNS TABLE (package_id uuid, work_date date, people integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Building is a dev's while it is built. Its door changes this gate and keeps the twin out.
  IF NOT public.is_dev() OR public.is_digital_twin() THEN
    RAISE EXCEPTION 'Only a dev reads our crew''s clock-ins on a GC job while Building is built.' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'Say the first and the last day to count.' USING ERRCODE = '22023';
  END IF;
  -- A long job reads in pages (the io's 92-day pages), so no one call scans a year of punches.
  IF p_to - p_from > 91 THEN
    RAISE EXCEPTION 'Count at most 92 days at a time.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT k.id, s.work_date, count(DISTINCT s.user_id)::integer
  FROM public.gc_trade_packages k
  JOIN public.clock_sessions s ON s.job_ledger_id = k.job_ledger_id
  JOIN public.users u ON u.id = s.user_id
  WHERE k.project_id = p_project_id
    AND k.ours
    AND s.work_date BETWEEN p_from AND p_to
    AND s.revoked_at IS NULL
    AND s.rejected_at IS NULL
    AND s.origin = 'user_punch'
    AND s.quick_add_minutes IS NULL
    AND NOT COALESCE(u.is_sample, false)
    AND NOT COALESCE(u.is_digital_twin, false)
  GROUP BY k.id, s.work_date
  ORDER BY s.work_date, k.id;
END;
$$;

REVOKE ALL ON FUNCTION public.gc_crew_on_site(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_crew_on_site(uuid, date, date) TO authenticated;
COMMENT ON FUNCTION public.gc_crew_on_site(uuid, date, date) IS
  'GC mode (v2.5147, Building U8): for each trade our own crew does on a GC project, how many people clocked in on its Pipeline job each day from p_from to p_to (at most 92 days). Counts only: no names, hours or pay. Counts a punch waiting for approval; leaves out revoked and rejected sessions, salary days, quick adds, sample accounts and digital twins. A dev only while Building is built, never a twin. SECURITY DEFINER: it reads clock_sessions past its own policy, which is why it returns counts and nothing else.';
