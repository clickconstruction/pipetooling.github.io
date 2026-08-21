SET lock_timeout = '3s';

-- Partner "Full ledger" (owner request): the partner card's week view kept a
-- 26-week ceiling on get_my_partner_ledger — fine for the ‹ › cards, but the
-- partner should be able to see their COMPLETE ledger on demand. The cap on
-- the shared inner payload rises to 520 weeks (10 years of Sun–Sat
-- statements); both resolvers (get_my_partner_ledger and the dev lens's
-- get_partner_ledger_as) inherit it. Body verbatim from 20260821150000
-- otherwise.

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
        LIMIT GREATEST(1, LEAST(COALESCE(p_weeks, 8), 520))
      ) s
    ), '[]'::jsonb)
  );
END;
$$;
ALTER FUNCTION public.partner_ledger_payload(uuid, int) OWNER TO postgres;
COMMENT ON FUNCTION public.partner_ledger_payload(uuid, int) IS
  'Inner body shared by get_my_partner_ledger and get_partner_ledger_as (cap 520 weeks — the partner Full ledger view). Not client-callable.';
