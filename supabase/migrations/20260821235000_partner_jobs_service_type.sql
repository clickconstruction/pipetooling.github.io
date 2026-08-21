SET lock_timeout = '3s';

-- Partner "Your jobs" rows carry the job's service type so the client can
-- render the trade pill (PLUM 789) — v2.2015 added pills on the office Job
-- review tab; this brings the partner-facing card (and the View-as lens,
-- which delegates to the same payload) in line.
--
-- Replaces ONLY partner_jobs_payload (the shared inner body from
-- 20260821150000_partner_view_as_rpcs.sql) — get_my_partner_jobs and
-- get_partner_jobs_as are thin wrappers over it and need no change.
-- Additive: one new key ('service_type_name', null when the job has no
-- service type); older clients ignore it, newer clients fail soft without it.

CREATE OR REPLACE FUNCTION public.partner_jobs_payload(p_partnership_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.partnerships%ROWTYPE;
  v_rows jsonb;
BEGIN
  IF p_partnership_id IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;
  SELECT * INTO v_p FROM public.partnerships WHERE id = p_partnership_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'job_id', j.id,
    'label', COALESCE(NULLIF(btrim(COALESCE(j.hcp_number, '')), ''), NULLIF(btrim(COALESCE(j.click_number, '')), ''), NULLIF(btrim(COALESCE(j.job_name, '')), ''), j.id::text),
    'job_name', j.job_name,
    'status', j.status,
    'confirmed_at', j.partner_confirmed_at,
    'service_type_name', st.name,
    'profit_share', (
      SELECT o.amount FROM public.person_offsets o
      WHERE o.job_id = j.id AND o.person_id = v_p.person_id AND o.type = 'profit_share' AND o.reversal_of_offset_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.person_offsets r WHERE r.reversal_of_offset_id = o.id)
      LIMIT 1
    )
  ) ORDER BY j.partner_confirmed_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_rows
  FROM public.jobs_ledger j
  LEFT JOIN public.service_types st ON st.id = j.service_type_id
  WHERE j.partner_person_id = v_p.person_id;

  RETURN jsonb_build_object('exists', true, 'costing_on', (v_p.modules ->> 'costing') = 'true', 'rows', v_rows);
END;
$$;
ALTER FUNCTION public.partner_jobs_payload(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.partner_jobs_payload(uuid) IS
  'Inner body shared by get_my_partner_jobs and get_partner_jobs_as. Not client-callable.';
REVOKE ALL ON FUNCTION public.partner_jobs_payload(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partner_jobs_payload(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.partner_jobs_payload(uuid) FROM authenticated;
GRANT ALL ON FUNCTION public.partner_jobs_payload(uuid) TO service_role;
