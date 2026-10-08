SET lock_timeout = '3s';

-- A billing-only job, kept off every crew screen (to-dos/gc-mode/mockups/billing-only-job.md on branch
-- spike/gc-mode; the owner's call 1, 2026-10-09: yes, with a service_types flag folded in). GC mode's billing
-- job for a project we build (Owner Billing's O4a, which comes next and is the first to set the column)
-- carries only our bills to the customer. Nobody clocks in on it, schedules it or joins its crew: three
-- guards refuse it, the crew searches leave it out, and its service type stays out of the pickers.
-- Constant defaults make both columns catalog changes, with no rewrite of either table.

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS billing_only boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.jobs_ledger.billing_only IS
  'A job that only carries bills (GC mode''s billing job for a project we build, O4a). Nobody clocks in, schedules or joins its crew: the three guards refuse it, and the crew searches and lists leave it out.';

ALTER TABLE public.service_types
  ADD COLUMN IF NOT EXISTS billing_only boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.service_types.billing_only IS
  'A service type only billing-only jobs carry (GC mode''s General contracting, O4a). The pickers that choose a type for crew work, bids, materials and supply houses leave it out; a job''s own type still reads by id.';

-- The three guards: one function, SECURITY DEFINER so it sees the job whoever inserts. A crew member's own row
-- security may hide the billing job, and then a plain check would let the row through.
CREATE OR REPLACE FUNCTION public.refuse_billing_only_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job uuid := nullif(to_jsonb(NEW) ->> TG_ARGV[0], '')::uuid;
BEGIN
  IF v_job IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = v_job AND billing_only) THEN
    RAISE EXCEPTION 'That job only carries a GC job''s bills. Pick the job the work is on.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clock_sessions_refuse_billing_only ON public.clock_sessions;
CREATE TRIGGER clock_sessions_refuse_billing_only
  BEFORE INSERT OR UPDATE OF job_ledger_id ON public.clock_sessions
  FOR EACH ROW EXECUTE FUNCTION public.refuse_billing_only_job('job_ledger_id');

DROP TRIGGER IF EXISTS job_schedule_blocks_refuse_billing_only ON public.job_schedule_blocks;
CREATE TRIGGER job_schedule_blocks_refuse_billing_only
  BEFORE INSERT OR UPDATE OF job_id ON public.job_schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION public.refuse_billing_only_job('job_id');

DROP TRIGGER IF EXISTS jobs_ledger_team_members_refuse_billing_only ON public.jobs_ledger_team_members;
CREATE TRIGGER jobs_ledger_team_members_refuse_billing_only
  BEFORE INSERT OR UPDATE OF job_id ON public.jobs_ledger_team_members
  FOR EACH ROW EXECUTE FUNCTION public.refuse_billing_only_job('job_id');

-- The flip: on is refused while any of the three tables names the job, and off is always refused, so a GC
-- job's bills never become a crew job by a stray update. Fixing a mistake is a migration.
CREATE OR REPLACE FUNCTION public.jobs_ledger_billing_only_flip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.billing_only AND NOT NEW.billing_only THEN
    RAISE EXCEPTION 'A job that carries a GC job''s bills stays that way.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.billing_only AND NOT OLD.billing_only AND (
    EXISTS (SELECT 1 FROM public.clock_sessions WHERE job_ledger_id = NEW.id)
    OR EXISTS (SELECT 1 FROM public.job_schedule_blocks WHERE job_id = NEW.id)
    OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = NEW.id)
  ) THEN
    RAISE EXCEPTION 'That job has hours, a schedule or a crew, so it cannot only carry bills.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_ledger_billing_only_flip ON public.jobs_ledger;
CREATE TRIGGER jobs_ledger_billing_only_flip
  BEFORE UPDATE OF billing_only ON public.jobs_ledger
  FOR EACH ROW EXECUTE FUNCTION public.jobs_ledger_billing_only_flip();

-- The job search gains an opt-in. A second argument with a default would leave two overloads, and a
-- one-argument call would then match both, so the one-argument function goes in the same transaction. Every
-- call that passes only search_text keeps working by name through PostgREST. The body is
-- 20260905220000's, with one line added to the inner WHERE.
DROP FUNCTION IF EXISTS public.search_jobs_ledger(text);
CREATE OR REPLACE FUNCTION public.search_jobs_ledger(search_text text DEFAULT ''::text, include_billing_only boolean DEFAULT false)
RETURNS TABLE(id uuid, service_type_id uuid, service_type_name text, hcp_number text, job_name text, job_address text, click_number text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH q AS (
    SELECT
      coalesce(search_text, '') AS raw,
      public.escape_like_pattern(coalesce(search_text, '')) AS esc,
      -- Legacy "J1004" -> "1004": the remainder after the J, escaped.
      CASE
        WHEN length(coalesce(search_text, '')) >= 2 AND lower(left(search_text, 1)) = 'j'
        THEN public.escape_like_pattern(substring(search_text from 2))
      END AS j_rest
  )
  SELECT
    r.id,
    r.service_type_id,
    r.service_type_name,
    r.hcp_number,
    r.job_name,
    r.job_address,
    r.click_number
  FROM (
    SELECT
      jl.id,
      jl.service_type_id,
      coalesce(stj.name, '')::text AS service_type_name,
      coalesce(jl.hcp_number, '')::text AS hcp_number,
      coalesce(jl.job_name, '')::text AS job_name,
      coalesce(jl.job_address, '')::text AS job_address,
      coalesce(jl.click_number, '')::text AS click_number,
      coalesce(nullif(jl.hcp_number, ''), jl.click_number, '') AS effective_number
    FROM public.jobs_ledger jl
    LEFT JOIN public.service_types stj ON stj.id = jl.service_type_id
    CROSS JOIN q
    WHERE (include_billing_only OR NOT jl.billing_only)
    AND (
      q.raw = ''
      OR jl.hcp_number ILIKE '%' || q.esc || '%'
      OR jl.click_number ILIKE '%' || q.esc || '%'
      OR (
        q.j_rest IS NOT NULL
        AND (
          jl.hcp_number ILIKE '%' || q.j_rest || '%'
          OR jl.click_number ILIKE '%' || q.j_rest || '%'
        )
      )
      OR jl.job_name ILIKE '%' || q.esc || '%'
      OR jl.job_address ILIKE '%' || q.esc || '%'
      OR EXISTS (
        SELECT 1
        FROM public.service_types st
        WHERE st.ledger_job_prefix IS NOT NULL
          AND btrim(st.ledger_job_prefix) <> ''
          AND q.raw <> ''
          AND length(q.raw) > length(btrim(st.ledger_job_prefix))
          AND lower(left(q.raw, length(btrim(st.ledger_job_prefix)))) = lower(btrim(st.ledger_job_prefix))
          AND (
            jl.hcp_number ILIKE '%' || public.escape_like_pattern(substring(q.raw from length(btrim(st.ledger_job_prefix)) + 1)) || '%'
            OR jl.click_number ILIKE '%' || public.escape_like_pattern(substring(q.raw from length(btrim(st.ledger_job_prefix)) + 1)) || '%'
          )
      )
    )
  ) r
  ORDER BY
    (CASE WHEN r.effective_number = '' THEN 1 ELSE 0 END),
    (substring(r.effective_number from '[0-9]+'))::numeric DESC NULLS LAST,
    r.effective_number DESC
  LIMIT 50;
$$;

COMMENT ON FUNCTION public.search_jobs_ledger(text, boolean) IS
  'Search jobs_ledger by HCP / Click number, job name, or address. J prefix and ledger_job_prefix normalized; %/_/\ in the typed text are escaped (escape_like_pattern); ordered by job number NUMERICALLY (first digit run, desc) under LIMIT 50. Leaves billing-only jobs out unless include_billing_only (the money and office searches). Returns service_type_id, service_type_name, click_number. SECURITY DEFINER.';

REVOKE EXECUTE ON FUNCTION public.search_jobs_ledger(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_jobs_ledger(text, boolean) TO authenticated, service_role;

-- My Schedule's + Add job leaves billing-only jobs out: 20260811140701's body, one line added.
CREATE OR REPLACE FUNCTION public.search_jobs_for_self_schedule(p_query text)
RETURNS TABLE (
  id uuid,
  hcp_number text,
  click_number text,
  job_name text,
  job_address text,
  status text,
  customer_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT j.id, j.hcp_number, j.click_number, j.job_name, j.job_address, j.status, j.customer_name
  FROM public.jobs_ledger j
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND j.status IN ('waiting', 'working', 'ready_to_bill', 'billed')
    AND NOT j.billing_only
    AND (
      COALESCE(trim(p_query), '') = ''
      OR j.hcp_number ILIKE '%' || trim(p_query) || '%'
      OR j.click_number ILIKE '%' || trim(p_query) || '%'
      OR j.job_name ILIKE '%' || trim(p_query) || '%'
      OR j.job_address ILIKE '%' || trim(p_query) || '%'
      OR COALESCE(j.customer_name, '') ILIKE '%' || trim(p_query) || '%'
    )
  ORDER BY array_position(ARRAY['waiting','working','ready_to_bill','billed'], j.status),
           NULLIF(j.hcp_number, '') NULLS LAST,
           j.job_name
  LIMIT 20;
$$;
