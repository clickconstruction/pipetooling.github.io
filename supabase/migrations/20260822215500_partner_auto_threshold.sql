SET lock_timeout = '3s';

-- Automatic threshold for the Partnerships → Job review tab (v2.2107).
--
-- When a partnership sets auto_threshold_pct, the office client auto-confirms
-- any queued job whose partner share of approved labor hours reaches that
-- percentage — stamped as automatic (partner_confirmed_auto_pct), never as a
-- person. Human override always wins: an explicit clear stamps
-- partner_auto_exempt_at and the rule (enforced HERE, in the RPC) never
-- re-adds an exempted job; a manual confirm clears the exemption.

ALTER TABLE public.partnerships
  ADD COLUMN IF NOT EXISTS auto_threshold_pct integer
  CHECK (auto_threshold_pct IS NULL OR (auto_threshold_pct >= 1 AND auto_threshold_pct <= 100));

COMMENT ON COLUMN public.partnerships.auto_threshold_pct IS
  'Automatic §3 threshold (1-100, NULL = off): when the partner''s share of a job''s approved labor hours reaches this percent, the office client auto-confirms the job via set_job_partner_majority(p_auto_pct). Human clears exempt a job from the rule permanently.';

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS partner_confirmed_auto_pct integer;
ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS partner_auto_exempt_at timestamptz;

COMMENT ON COLUMN public.jobs_ledger.partner_confirmed_auto_pct IS
  'NULL = the majority call was made by a person. Set = it was made by the automatic threshold rule, at this threshold percent (the UI shows "auto >= N%"). Cleared when the flag is cleared.';
COMMENT ON COLUMN public.jobs_ledger.partner_auto_exempt_at IS
  'Stamped whenever the majority flag is explicitly cleared: the automatic threshold rule must never re-add this job. Cleared by a MANUAL re-confirm (a human re-decided).';

-- Replace the 2-arg toggle with a 3-arg version (default keeps existing
-- clients working; PostgREST named-arg calls resolve either way once the old
-- overload is gone).
DROP FUNCTION IF EXISTS public.set_job_partner_majority(uuid, uuid);

CREATE OR REPLACE FUNCTION public.set_job_partner_majority(
  p_job_id uuid,
  p_person_id uuid DEFAULT NULL,
  p_auto_pct integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF p_person_id IS NULL THEN
    -- Explicit clear: hide the job and exempt it from the auto rule forever
    -- (until a human confirms it again by hand).
    UPDATE public.jobs_ledger
    SET partner_person_id = NULL,
        partner_confirmed_by = NULL,
        partner_confirmed_at = NULL,
        partner_confirmed_auto_pct = NULL,
        partner_auto_exempt_at = now()
    WHERE id = p_job_id;
  ELSIF p_auto_pct IS NOT NULL THEN
    -- Auto-confirm: skip (no error) when a human cleared this job before, or
    -- when any partner is already set — the rule never overrides people.
    UPDATE public.jobs_ledger
    SET partner_person_id = p_person_id,
        partner_confirmed_by = auth.uid(),
        partner_confirmed_at = now(),
        partner_confirmed_auto_pct = p_auto_pct
    WHERE id = p_job_id
      AND partner_auto_exempt_at IS NULL
      AND partner_person_id IS NULL;
    RETURN;
  ELSE
    -- Manual confirm: a human re-decided — clear any auto exemption.
    UPDATE public.jobs_ledger
    SET partner_person_id = p_person_id,
        partner_confirmed_by = auth.uid(),
        partner_confirmed_at = now(),
        partner_confirmed_auto_pct = NULL,
        partner_auto_exempt_at = NULL
    WHERE id = p_job_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job not found';
  END IF;
END;
$$;

ALTER FUNCTION public.set_job_partner_majority(uuid, uuid, integer) OWNER TO postgres;
COMMENT ON FUNCTION public.set_job_partner_majority(uuid, uuid, integer) IS
  'Dev-only toggle for the partner majority flag on a job. NULL person clears all anchors and stamps partner_auto_exempt_at (the auto rule never re-adds). p_auto_pct marks the confirm as made by the automatic threshold rule; auto calls silently skip exempted or already-assigned jobs. Manual confirms clear the exemption.';
GRANT ALL ON FUNCTION public.set_job_partner_majority(uuid, uuid, integer) TO anon;
GRANT ALL ON FUNCTION public.set_job_partner_majority(uuid, uuid, integer) TO authenticated;
GRANT ALL ON FUNCTION public.set_job_partner_majority(uuid, uuid, integer) TO service_role;

-- Queue rows gain the auto stamp + exemption flag so the tab can label
-- auto-added rows and explain why a qualifying job isn't being re-added.
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
      'confirmed_by_name', u.name,
      'confirmed_auto_pct', j.partner_confirmed_auto_pct,
      'auto_exempt', (j.partner_auto_exempt_at IS NOT NULL)
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
  'Dev-only review queue for the Partnerships → Job review tab: jobs where the partnership''s person has approved clocked hours, with partner-vs-total hours as the suggestion, the auto-threshold stamp, and the human-clear exemption flag. Unreviewed jobs sort first (most partner hours first).';
GRANT ALL ON FUNCTION public.get_partner_job_review_queue(uuid) TO anon;
GRANT ALL ON FUNCTION public.get_partner_job_review_queue(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_partner_job_review_queue(uuid) TO service_role;
