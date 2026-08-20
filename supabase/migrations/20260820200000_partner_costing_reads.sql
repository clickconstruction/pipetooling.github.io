SET lock_timeout = '3s';

-- Partnerships train PR 7 (PARTNERSHIPS_PLAN.md): the §5 transparency window.
-- Two partner-facing SECURITY DEFINER RPCs, caller-resolved like PR 4's, and
-- filtered HARD on the majority flag — a job that isn't checked off for this
-- partner does not exist here. Wage privacy: labor appears as HOURS PER
-- PERSON only, never wages; dollars appear only for invoices/charges/direct
-- rows, which §5 explicitly grants (supply house invoices and pricing,
-- banking records, reported hours).
--
--   get_my_partner_jobs()             — the "Your jobs" list
--   get_my_partner_job_costing(job)   — one checked-off job's cost sheet

CREATE OR REPLACE FUNCTION public.get_my_partner_jobs()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid uuid;
  v_p public.partnerships%ROWTYPE;
  v_rows jsonb;
BEGIN
  v_pid := public.my_partner_partnership_id();
  IF v_pid IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;
  SELECT * INTO v_p FROM public.partnerships WHERE id = v_pid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'job_id', j.id,
    'label', COALESCE(NULLIF(btrim(COALESCE(j.hcp_number, '')), ''), NULLIF(btrim(COALESCE(j.click_number, '')), ''), NULLIF(btrim(COALESCE(j.job_name, '')), ''), j.id::text),
    'job_name', j.job_name,
    'status', j.status,
    'confirmed_at', j.partner_confirmed_at,
    'profit_share', (
      SELECT o.amount FROM public.person_offsets o
      WHERE o.job_id = j.id AND o.person_id = v_p.person_id AND o.type = 'profit_share' AND o.reversal_of_offset_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.person_offsets r WHERE r.reversal_of_offset_id = o.id)
      LIMIT 1
    )
  ) ORDER BY j.partner_confirmed_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_rows
  FROM public.jobs_ledger j
  WHERE j.partner_person_id = v_p.person_id;

  RETURN jsonb_build_object('exists', true, 'costing_on', (v_p.modules ->> 'costing') = 'true', 'rows', v_rows);
END;
$$;
ALTER FUNCTION public.get_my_partner_jobs() OWNER TO postgres;
COMMENT ON FUNCTION public.get_my_partner_jobs() IS
  'The caller-partner''s checked-off jobs (majority flag = the §5 window) with status and any live profit-share posting. Nothing else is visible.';
GRANT ALL ON FUNCTION public.get_my_partner_jobs() TO anon;
GRANT ALL ON FUNCTION public.get_my_partner_jobs() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_partner_jobs() TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_partner_job_costing(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid uuid;
  v_p public.partnerships%ROWTYPE;
  v_j public.jobs_ledger%ROWTYPE;
BEGIN
  v_pid := public.my_partner_partnership_id();
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'not a partner';
  END IF;
  SELECT * INTO v_p FROM public.partnerships WHERE id = v_pid;
  IF (v_p.modules ->> 'costing') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'job costing is not enabled for this partnership';
  END IF;
  SELECT * INTO v_j FROM public.jobs_ledger WHERE id = p_job_id;
  IF NOT FOUND OR v_j.partner_person_id IS DISTINCT FROM v_p.person_id THEN
    RAISE EXCEPTION 'job not available';
  END IF;

  RETURN jsonb_build_object(
    'job_id', v_j.id,
    'label', COALESCE(NULLIF(btrim(COALESCE(v_j.hcp_number, '')), ''), NULLIF(btrim(COALESCE(v_j.click_number, '')), ''), NULLIF(btrim(COALESCE(v_j.job_name, '')), ''), v_j.id::text),
    'job_name', v_j.job_name,
    'status', v_j.status,
    'revenue', v_j.revenue,
    'as_of', now(),
    'hours', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', h.name, 'hours', ROUND(h.hrs::numeric, 1)) ORDER BY h.hrs DESC)
      FROM (
        SELECT u.name, SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS hrs
        FROM public.clock_sessions cs
        JOIN public.users u ON u.id = cs.user_id
        WHERE cs.job_ledger_id = p_job_id
          AND cs.clocked_out_at IS NOT NULL
          AND cs.approved_at IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
        GROUP BY u.name
      ) h
    ), '[]'::jsonb),
    'supply_invoices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'vendor', sh.name, 'invoice_number', shi.invoice_number, 'invoice_date', shi.invoice_date,
        'invoice_amount', shi.amount, 'pct', al.pct,
        'allocated', ROUND((COALESCE(shi.amount, 0) * COALESCE(al.pct, 0) / 100.0)::numeric, 2)
      ) ORDER BY shi.invoice_date DESC NULLS LAST)
      FROM public.supply_house_invoice_job_allocations al
      JOIN public.supply_house_invoices shi ON shi.id = al.invoice_id
      LEFT JOIN public.supply_houses sh ON sh.id = shi.supply_house_id
      WHERE al.job_id = p_job_id
    ), '[]'::jsonb),
    'card_charges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'counterparty', mt.counterparty_name, 'posted_at', mt.posted_at, 'allocated', ROUND(ABS(a.amount)::numeric, 2)
      ) ORDER BY mt.posted_at DESC NULLS LAST)
      FROM public.mercury_transaction_job_allocations a
      JOIN public.mercury_transactions mt ON mt.id = a.mercury_transaction_id
      WHERE a.job_id = p_job_id
    ), '[]'::jsonb),
    'direct', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('description', m.description, 'amount', m.amount) ORDER BY m.sequence_order)
      FROM public.jobs_ledger_materials m
      WHERE m.job_id = p_job_id
    ), '[]'::jsonb)
  );
END;
$$;
ALTER FUNCTION public.get_my_partner_job_costing(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.get_my_partner_job_costing(uuid) IS
  'One checked-off job''s §5 cost sheet for the caller-partner: reported hours per person (no wages), supply invoice allocations, card-charge allocations, direct rows (incl. §4h), freshness stamp. Hard-gated on the majority flag + modules.costing.';
GRANT ALL ON FUNCTION public.get_my_partner_job_costing(uuid) TO anon;
GRANT ALL ON FUNCTION public.get_my_partner_job_costing(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_my_partner_job_costing(uuid) TO service_role;
