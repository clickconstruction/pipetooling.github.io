SET lock_timeout = '3s';

-- Ledger notes (owner-approved mockup "Ledger Notes"): dated memos that
-- annotate the partnership ledger without touching the money. Office-authored
-- (dev-only RLS); a note marked partner_visible reaches the partner ONLY
-- through partner_ledger_payload (RPC-first house rule) and renders in their
-- Full ledger. No amounts, no balance impact — pure annotation rows.

CREATE TABLE IF NOT EXISTS public.partnership_ledger_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  note_date date NOT NULL,
  memo text NOT NULL,
  partner_visible boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partnership_ledger_notes_partnership_date_idx
  ON public.partnership_ledger_notes (partnership_id, note_date);

ALTER TABLE public.partnership_ledger_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Devs manage partnership ledger notes" ON public.partnership_ledger_notes;
CREATE POLICY "Devs manage partnership ledger notes"
  ON public.partnership_ledger_notes FOR ALL
  USING (public.is_dev())
  WITH CHECK (public.is_dev());

COMMENT ON TABLE public.partnership_ledger_notes IS
  'Dated annotation memos on a partnership ledger. Office-only writes; partner_visible notes reach the partner via partner_ledger_payload.';

-- partner_ledger_payload: add partner-visible notes. Body otherwise verbatim
-- from 20260821200000 (offsets + deduction links, cap 520).
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
    'notes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('note_date', n.note_date, 'memo', n.memo) ORDER BY n.note_date)
      FROM public.partnership_ledger_notes n
      WHERE n.partnership_id = p_partnership_id AND n.partner_visible
    ), '[]'::jsonb),
    'offsets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id, 'type', o.type, 'amount', o.amount,
        'occurred_date', o.occurred_date, 'description', o.description
      ) ORDER BY o.occurred_date)
      FROM public.person_offsets o
      WHERE o.person_id = v_person
    ), '[]'::jsonb),
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
          SELECT jsonb_agg(jsonb_build_object('description', d.description, 'amount', d.amount, 'person_offset_id', d.person_offset_id) ORDER BY d.created_at)
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
  'Inner body shared by get_my_partner_ledger and get_partner_ledger_as (cap 520; offsets, deduction links, partner-visible notes). Not client-callable.';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
