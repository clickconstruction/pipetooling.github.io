SET lock_timeout = '3s';

-- Partnerships train PR 2 (PARTNERSHIPS_PLAN.md): the majority check-off gate.
-- Three nullable anchor columns on jobs_ledger record Robert's §3 "majority of
-- the work" decision — who the partner is, who confirmed it, when. EVERYTHING
-- partner-facing keys on this flag: a job does not exist in a partner's view
-- (costing, profit lines, "Your jobs") until it is set here, and clearing it
-- hides the job again without ever touching postings already made.
--
-- Two RPCs, both dev-gated in-function:
--   set_job_partner_majority(job, person|NULL)  — the toggle; NULL clears.
--   get_partner_job_review_queue(partnership)   — jobs the partner clocked
--     approved hours on, with partner-vs-total hours as the SUGGESTION only
--     (no automatic threshold; the human check is the decision).

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS partner_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL;
ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS partner_confirmed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS partner_confirmed_at timestamptz;

COMMENT ON COLUMN public.jobs_ledger.partner_person_id IS
  'Partner (people.id) confirmed as majority-of-work on this job (§3 of the partner agreement). Gates ALL partner-facing reads and profit-share postings. NULL = not partner-visible.';
COMMENT ON COLUMN public.jobs_ledger.partner_confirmed_by IS
  'users.id who made the majority call (set_job_partner_majority). Cleared when the flag is cleared.';
COMMENT ON COLUMN public.jobs_ledger.partner_confirmed_at IS
  'When the majority call was made. Cleared when the flag is cleared.';

CREATE INDEX IF NOT EXISTS idx_jobs_ledger_partner_person
  ON public.jobs_ledger (partner_person_id)
  WHERE partner_person_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_job_partner_majority(
  p_job_id uuid,
  p_person_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  UPDATE public.jobs_ledger
  SET partner_person_id = p_person_id,
      partner_confirmed_by = CASE WHEN p_person_id IS NULL THEN NULL ELSE auth.uid() END,
      partner_confirmed_at = CASE WHEN p_person_id IS NULL THEN NULL ELSE now() END
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job not found';
  END IF;
END;
$$;

ALTER FUNCTION public.set_job_partner_majority(uuid, uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.set_job_partner_majority(uuid, uuid) IS
  'Dev-only toggle for the partner majority flag on a job. NULL person clears all three anchor columns. Clearing hides the job from the partner but never touches ledger postings — reversals are their own explicit action.';
GRANT ALL ON FUNCTION public.set_job_partner_majority(uuid, uuid) TO anon;
GRANT ALL ON FUNCTION public.set_job_partner_majority(uuid, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.set_job_partner_majority(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_partner_job_review_queue(
  p_partnership_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_person uuid;
  v_user uuid;
  v_rows jsonb;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT p.person_id, pe.account_user_id INTO v_person, v_user
  FROM public.partnerships p
  JOIN public.people pe ON pe.id = p.person_id
  WHERE p.id = p_partnership_id;

  IF v_person IS NULL THEN
    RAISE EXCEPTION 'partnership not found';
  END IF;

  -- No app-user link yet → empty queue with the reason, so the tab can say
  -- "link the person to an app user" instead of showing a silent void.
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'partner_person_id', v_person, 'rows', '[]'::jsonb);
  END IF;

  WITH partner_hours AS (
    SELECT cs.job_ledger_id AS job_id,
           SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS hrs
    FROM public.clock_sessions cs
    WHERE cs.user_id = v_user
      AND cs.job_ledger_id IS NOT NULL
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NOT NULL
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
    GROUP BY 1
  ),
  totals AS (
    SELECT cs.job_ledger_id AS job_id,
           SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS hrs
    FROM public.clock_sessions cs
    WHERE cs.job_ledger_id IN (SELECT job_id FROM partner_hours)
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NOT NULL
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'job_id', j.id,
      'label', COALESCE(
        NULLIF(btrim(COALESCE(j.hcp_number, '')), ''),
        NULLIF(btrim(COALESCE(j.click_number, '')), ''),
        NULLIF(btrim(COALESCE(j.job_name, '')), ''),
        j.id::text
      ),
      'job_name', j.job_name,
      'partner_hours', ROUND(ph.hrs::numeric, 1),
      'total_hours', ROUND(t.hrs::numeric, 1),
      'partner_person_id', j.partner_person_id,
      'confirmed_at', j.partner_confirmed_at,
      'confirmed_by_name', u.name
    ) ORDER BY (j.partner_person_id IS NULL) DESC, ph.hrs DESC), '[]'::jsonb)
  INTO v_rows
  FROM partner_hours ph
  JOIN totals t ON t.job_id = ph.job_id
  JOIN public.jobs_ledger j ON j.id = ph.job_id
  LEFT JOIN public.users u ON u.id = j.partner_confirmed_by;

  RETURN jsonb_build_object('linked', true, 'partner_person_id', v_person, 'rows', v_rows);
END;
$$;

ALTER FUNCTION public.get_partner_job_review_queue(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.get_partner_job_review_queue(uuid) IS
  'Dev-only review queue for the Partnerships → Job review tab: jobs where the partnership''s person has approved clocked hours, with partner-vs-total hours as the suggestion. Unreviewed jobs sort first (most partner hours first).';
GRANT ALL ON FUNCTION public.get_partner_job_review_queue(uuid) TO anon;
GRANT ALL ON FUNCTION public.get_partner_job_review_queue(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_partner_job_review_queue(uuid) TO service_role;
