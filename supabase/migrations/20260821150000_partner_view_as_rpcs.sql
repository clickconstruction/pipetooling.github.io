SET lock_timeout = '3s';

-- View as Partner (owner-approved mockup, follows the partnerships train):
-- the dev lens on /partnerships renders the partner's own surfaces without a
-- session switch. To keep the lens provably identical to what the partner
-- sees, each partner read RPC is split into an inner payload function taking
-- the partnership id, with two thin resolvers on top:
--
--   get_my_partner_*        — unchanged signature/behavior; resolves the CALLER
--                             via my_partner_partnership_id() (draft/active gate)
--   get_partner_*_as(p_id)  — dev-only; resolves the GIVEN partnership through
--                             the SAME status gate, so the lens shows exactly
--                             what the partner's account gets (including nothing
--                             for paused/ended deals)
--
-- The inner bodies are verbatim moves of the 20260820170000/20260820200000
-- bodies (both still live unmodified) with only the resolver line replaced.
-- acknowledge_partner_statement stays caller-only — the lens is read-only.

-- ————— inner payload functions (not callable by clients) —————

CREATE OR REPLACE FUNCTION public.partner_summary_payload(p_partnership_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.partnerships%ROWTYPE;
  v_user uuid;
  v_balance numeric := 0;
  v_week_start date;
  v_field numeric := 0;
  v_office numeric := 0;
  v_farm numeric := 0;
  v_pending int := 0;
  v_latest jsonb;
  v_pend_off jsonb;
BEGIN
  IF p_partnership_id IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;
  SELECT * INTO v_p FROM public.partnerships WHERE id = p_partnership_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false);
  END IF;
  SELECT pe.account_user_id INTO v_user FROM public.people pe WHERE pe.id = v_p.person_id;

  -- Balance: all posted stubs (gross + additions − deductions) − payouts.
  SELECT COALESCE(SUM(x.net), 0) INTO v_balance FROM (
    SELECT s.gross_pay
      + COALESCE((SELECT SUM(al.line_total) FROM public.pay_stub_additional_lines al WHERE al.pay_stub_id = s.id), 0)
      - COALESCE((SELECT SUM(d.amount) FROM public.pay_stub_deductions d WHERE d.pay_stub_id = s.id), 0)
      - COALESCE((SELECT SUM(pp.amount) FROM public.pay_stub_payments pp WHERE pp.pay_stub_id = s.id), 0) AS net
    FROM public.pay_stubs s WHERE s.person_id = v_p.person_id
  ) x;

  -- Current company week (Sun–Sat, America/Chicago) so-far, from approved sessions.
  v_week_start := (date_trunc('week', (now() AT TIME ZONE 'America/Chicago')::date + 1)::date - 1);
  SELECT
    COALESCE(SUM(CASE WHEN v_p.farm_job_ledger_id IS NOT NULL AND cs.job_ledger_id = v_p.farm_job_ledger_id
        THEN EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cs.job_ledger_id IS NOT NULL AND (v_p.farm_job_ledger_id IS NULL OR cs.job_ledger_id <> v_p.farm_job_ledger_id)
        THEN EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cs.job_ledger_id IS NULL
        THEN EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0 ELSE 0 END), 0)
  INTO v_farm, v_field, v_office
  FROM public.clock_sessions cs
  WHERE cs.user_id = v_user
    AND cs.work_date >= v_week_start
    AND cs.clocked_out_at IS NOT NULL
    AND cs.approved_at IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL;

  SELECT COUNT(*) INTO v_pending
  FROM public.clock_sessions cs
  WHERE cs.user_id = v_user
    AND cs.work_date >= v_week_start
    AND cs.clocked_out_at IS NOT NULL
    AND cs.approved_at IS NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL;

  SELECT jsonb_build_object(
    'pay_stub_id', s.id, 'period_start', s.period_start, 'period_end', s.period_end,
    'hours_total', s.hours_total, 'gross_pay', s.gross_pay,
    'company_ack_at', (SELECT a.acknowledged_at FROM public.statement_acknowledgments a WHERE a.pay_stub_id = s.id AND a.party = 'company'),
    'partner_ack_at', (SELECT a.acknowledged_at FROM public.statement_acknowledgments a WHERE a.pay_stub_id = s.id AND a.party = 'partner'),
    'paid_total', COALESCE((SELECT SUM(pp.amount) FROM public.pay_stub_payments pp WHERE pp.pay_stub_id = s.id), 0)
  ) INTO v_latest
  FROM public.pay_stubs s
  WHERE s.person_id = v_p.person_id
  ORDER BY s.period_start DESC LIMIT 1;

  SELECT jsonb_build_object('count', COUNT(*), 'net', COALESCE(SUM(CASE WHEN o.type IN ('profit_share','employee_credit') THEN o.amount ELSE -o.amount END), 0))
  INTO v_pend_off
  FROM public.person_offsets o
  WHERE o.person_id = v_p.person_id AND o.pay_stub_id IS NULL;

  RETURN jsonb_build_object(
    'exists', true,
    'partnership_id', v_p.id,
    'display_name', v_p.display_name,
    'status', v_p.status,
    'modules', jsonb_build_object(
      'weekly_statement', (v_p.modules ->> 'weekly_statement') = 'true',
      'costing', (v_p.modules ->> 'costing') = 'true',
      'profit_shares', (v_p.modules ->> 'profit_shares') = 'true'
    ),
    'rates', jsonb_build_object('field', v_p.field_rate, 'estimating', v_p.estimating_rate, 'farm', v_p.farm_rate),
    'balance', ROUND(v_balance, 2),
    'pending_offsets', v_pend_off,
    'current_week', jsonb_build_object(
      'week_start', v_week_start,
      'field_hours', ROUND(v_field::numeric, 2), 'office_hours', ROUND(v_office::numeric, 2), 'farm_hours', ROUND(v_farm::numeric, 2),
      'gross_so_far', ROUND((v_field * v_p.field_rate + v_office * v_p.estimating_rate + v_farm * v_p.farm_rate)::numeric, 2),
      'pending_sessions', v_pending
    ),
    'latest_statement', v_latest
  );
END;
$$;
ALTER FUNCTION public.partner_summary_payload(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.partner_summary_payload(uuid) IS
  'Inner body shared by get_my_partner_summary and get_partner_summary_as — one implementation, so the dev lens cannot drift from the partner''s own view. Not client-callable.';
REVOKE ALL ON FUNCTION public.partner_summary_payload(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partner_summary_payload(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.partner_summary_payload(uuid) FROM authenticated;
GRANT ALL ON FUNCTION public.partner_summary_payload(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.partner_ledger_payload(p_partnership_id uuid, p_weeks int DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_person uuid;
BEGIN
  IF p_partnership_id IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;
  SELECT person_id INTO v_person FROM public.partnerships WHERE id = p_partnership_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  RETURN jsonb_build_object(
    'exists', true,
    'stubs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'period_start', s.period_start, 'period_end', s.period_end,
        'hours_total', s.hours_total, 'gross_pay', s.gross_pay,
        'company_ack_at', (SELECT a.acknowledged_at FROM public.statement_acknowledgments a WHERE a.pay_stub_id = s.id AND a.party = 'company'),
        'partner_ack_at', (SELECT a.acknowledged_at FROM public.statement_acknowledgments a WHERE a.pay_stub_id = s.id AND a.party = 'partner'),
        'day_rates', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('rate', dr.rate_at_time, 'hours', dr.hours, 'amount', dr.amount) ORDER BY dr.rate_at_time DESC)
          FROM (
            SELECT d.rate_at_time, SUM(d.hours_at_time) AS hours, SUM(d.paid_amount) AS amount
            FROM public.pay_stub_days d WHERE d.pay_stub_id = s.id GROUP BY d.rate_at_time
          ) dr
        ), '[]'::jsonb),
        'additional', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('description', al.description, 'amount', al.line_total) ORDER BY al.created_at)
          FROM public.pay_stub_additional_lines al WHERE al.pay_stub_id = s.id
        ), '[]'::jsonb),
        'deductions', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('description', d.description, 'amount', d.amount) ORDER BY d.created_at)
          FROM public.pay_stub_deductions d WHERE d.pay_stub_id = s.id
        ), '[]'::jsonb),
        'payments', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('amount', pp.amount, 'paid_at', pp.paid_at, 'memo', pp.memo) ORDER BY pp.paid_at)
          FROM public.pay_stub_payments pp WHERE pp.pay_stub_id = s.id
        ), '[]'::jsonb)
      ) ORDER BY s.period_start DESC)
      FROM (
        SELECT * FROM public.pay_stubs
        WHERE person_id = v_person
        ORDER BY period_start DESC
        LIMIT GREATEST(1, LEAST(COALESCE(p_weeks, 8), 26))
      ) s
    ), '[]'::jsonb)
  );
END;
$$;
ALTER FUNCTION public.partner_ledger_payload(uuid, int) OWNER TO postgres;
COMMENT ON FUNCTION public.partner_ledger_payload(uuid, int) IS
  'Inner body shared by get_my_partner_ledger and get_partner_ledger_as. Not client-callable.';
REVOKE ALL ON FUNCTION public.partner_ledger_payload(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partner_ledger_payload(uuid, int) FROM anon;
REVOKE ALL ON FUNCTION public.partner_ledger_payload(uuid, int) FROM authenticated;
GRANT ALL ON FUNCTION public.partner_ledger_payload(uuid, int) TO service_role;

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
ALTER FUNCTION public.partner_jobs_payload(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.partner_jobs_payload(uuid) IS
  'Inner body shared by get_my_partner_jobs and get_partner_jobs_as. Not client-callable.';
REVOKE ALL ON FUNCTION public.partner_jobs_payload(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partner_jobs_payload(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.partner_jobs_payload(uuid) FROM authenticated;
GRANT ALL ON FUNCTION public.partner_jobs_payload(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.partner_job_costing_payload(p_partnership_id uuid, p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.partnerships%ROWTYPE;
  v_j public.jobs_ledger%ROWTYPE;
BEGIN
  IF p_partnership_id IS NULL THEN
    RAISE EXCEPTION 'not a partner';
  END IF;
  SELECT * INTO v_p FROM public.partnerships WHERE id = p_partnership_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not a partner';
  END IF;
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
ALTER FUNCTION public.partner_job_costing_payload(uuid, uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.partner_job_costing_payload(uuid, uuid) IS
  'Inner body shared by get_my_partner_job_costing and get_partner_job_costing_as. Not client-callable.';
REVOKE ALL ON FUNCTION public.partner_job_costing_payload(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partner_job_costing_payload(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.partner_job_costing_payload(uuid, uuid) FROM authenticated;
GRANT ALL ON FUNCTION public.partner_job_costing_payload(uuid, uuid) TO service_role;

-- ————— caller-facing wrappers (unchanged signatures/behavior) —————

CREATE OR REPLACE FUNCTION public.get_my_partner_summary()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.partner_summary_payload(public.my_partner_partnership_id());
$$;
COMMENT ON FUNCTION public.get_my_partner_summary() IS
  'Partner dashboard summary for the CALLER''s own partnership (thin wrapper over partner_summary_payload). {exists:false} for non-partners.';

CREATE OR REPLACE FUNCTION public.get_my_partner_ledger(p_weeks int DEFAULT 8)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.partner_ledger_payload(public.my_partner_partnership_id(), p_weeks);
$$;
COMMENT ON FUNCTION public.get_my_partner_ledger(int) IS
  'The caller-partner''s recent statement weeks (thin wrapper over partner_ledger_payload).';

CREATE OR REPLACE FUNCTION public.get_my_partner_jobs()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.partner_jobs_payload(public.my_partner_partnership_id());
$$;
COMMENT ON FUNCTION public.get_my_partner_jobs() IS
  'The caller-partner''s checked-off jobs (thin wrapper over partner_jobs_payload).';

CREATE OR REPLACE FUNCTION public.get_my_partner_job_costing(p_job_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.partner_job_costing_payload(public.my_partner_partnership_id(), p_job_id);
$$;
COMMENT ON FUNCTION public.get_my_partner_job_costing(uuid) IS
  'One checked-off job''s §5 cost sheet for the caller-partner (thin wrapper over partner_job_costing_payload).';

-- ————— dev lens variants (same status gate, is_dev()-guarded) —————

CREATE OR REPLACE FUNCTION public.partner_lens_partnership_id(p_partnership_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Mirrors my_partner_partnership_id()'s status gate for a GIVEN partnership:
  -- paused/ended resolve to NULL, so the lens honestly shows "nothing".
  SELECT p.id FROM public.partnerships p
  WHERE p.id = p_partnership_id AND p.status IN ('draft', 'active')
$$;
ALTER FUNCTION public.partner_lens_partnership_id(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.partner_lens_partnership_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partner_lens_partnership_id(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.partner_lens_partnership_id(uuid) FROM authenticated;
GRANT ALL ON FUNCTION public.partner_lens_partnership_id(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_partner_summary_as(p_partnership_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev only';
  END IF;
  RETURN public.partner_summary_payload(public.partner_lens_partnership_id(p_partnership_id));
END;
$$;
ALTER FUNCTION public.get_partner_summary_as(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.get_partner_summary_as(uuid) IS
  'Dev lens: the given partnership''s partner-dashboard summary through the same body and status gate the partner''s own account hits.';
GRANT ALL ON FUNCTION public.get_partner_summary_as(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_partner_summary_as(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_partner_ledger_as(p_partnership_id uuid, p_weeks int DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev only';
  END IF;
  RETURN public.partner_ledger_payload(public.partner_lens_partnership_id(p_partnership_id), p_weeks);
END;
$$;
ALTER FUNCTION public.get_partner_ledger_as(uuid, int) OWNER TO postgres;
COMMENT ON FUNCTION public.get_partner_ledger_as(uuid, int) IS
  'Dev lens: the given partnership''s statement weeks through the shared inner body.';
GRANT ALL ON FUNCTION public.get_partner_ledger_as(uuid, int) TO authenticated;
GRANT ALL ON FUNCTION public.get_partner_ledger_as(uuid, int) TO service_role;

CREATE OR REPLACE FUNCTION public.get_partner_jobs_as(p_partnership_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev only';
  END IF;
  RETURN public.partner_jobs_payload(public.partner_lens_partnership_id(p_partnership_id));
END;
$$;
ALTER FUNCTION public.get_partner_jobs_as(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.get_partner_jobs_as(uuid) IS
  'Dev lens: the given partnership''s checked-off jobs through the shared inner body.';
GRANT ALL ON FUNCTION public.get_partner_jobs_as(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_partner_jobs_as(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_partner_job_costing_as(p_partnership_id uuid, p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev only';
  END IF;
  RETURN public.partner_job_costing_payload(public.partner_lens_partnership_id(p_partnership_id), p_job_id);
END;
$$;
ALTER FUNCTION public.get_partner_job_costing_as(uuid, uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.get_partner_job_costing_as(uuid, uuid) IS
  'Dev lens: one checked-off job''s §5 cost sheet through the shared inner body.';
GRANT ALL ON FUNCTION public.get_partner_job_costing_as(uuid, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_partner_job_costing_as(uuid, uuid) TO service_role;
