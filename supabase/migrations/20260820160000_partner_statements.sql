SET lock_timeout = '3s';

-- Partnerships train PR 3 (PARTNERSHIPS_PLAN.md): the weekly-statement spine.
-- Generalizes the employee pay-period machinery (pay_stubs family) to partner
-- (sub-kind) people instead of building a parallel system:
--
--   1. person_offsets widens for partner postings: new types profit_share /
--      utility_overage, a job_id anchor for §3 postings, a reversal link, and
--      the partial-unique idempotency guarantee (one live profit_share per
--      job+person — reposting is a no-op, reversals are explicit new rows).
--   2. statement_acknowledgments: the §9b mutual co-sign — two timestamps per
--      statement (company / partner), unique per party.
--   3. partnerships.farm_job_ledger_id: which job is "the farm" (§1c) — hours
--      clocked to it price at farm_rate ($0 for Bryan); unset = no farm bucket.
--   4. generate_partner_statement(partnership, week_sunday, override): builds
--      the pay_stubs row + per-day pay_stub_days from APPROVED sessions priced
--      at the partnership's CURRENT rates (stamped into rate_at_time — later
--      rate changes never touch generated statements), attaches pending
--      offsets (deductions up to gross — the DB enforcement triggers stay in
--      charge; the rest stay pending), stamps the company acknowledgment, and
--      logs a partnership_events row. Guarded: unapproved sessions or
--      unreviewed worked jobs in the week block generation unless override
--      (override is logged). Idempotent per (person, week).
--
-- Session-hour classification (documented decision, plan §"Money conventions"):
-- partner statements price approved session hours directly (subs have no
-- people_hours authoritative-total flow) — field = real job (not the farm
-- job), office/estimating = bid-tagged or unassigned, farm = the farm job.

-- 1 ▸ person_offsets widening -------------------------------------------------

ALTER TABLE public.person_offsets DROP CONSTRAINT IF EXISTS person_offsets_type_check;
ALTER TABLE public.person_offsets ADD CONSTRAINT person_offsets_type_check
  CHECK (type = ANY (ARRAY['backcharge'::text, 'damage'::text, 'employee_credit'::text, 'profit_share'::text, 'utility_overage'::text]));

ALTER TABLE public.person_offsets
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL;
ALTER TABLE public.person_offsets
  ADD COLUMN IF NOT EXISTS reversal_of_offset_id uuid REFERENCES public.person_offsets(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.person_offsets.job_id IS
  'For partner profit_share postings (§3): the job the share came from. NULL for classic offsets.';
COMMENT ON COLUMN public.person_offsets.reversal_of_offset_id IS
  'Set on a negating row that reverses an earlier posting (job reopened, share re-run). Postings are never edited or deleted — reversals are new rows.';

-- Idempotency: at most one LIVE (unreversed) profit_share per job + person.
CREATE UNIQUE INDEX IF NOT EXISTS person_offsets_profit_share_once_idx
  ON public.person_offsets (job_id, person_id)
  WHERE type = 'profit_share' AND reversal_of_offset_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_person_offsets_job_id
  ON public.person_offsets (job_id) WHERE job_id IS NOT NULL;

-- 2 ▸ statement acknowledgments ----------------------------------------------

CREATE TABLE IF NOT EXISTS public.statement_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_stub_id uuid NOT NULL REFERENCES public.pay_stubs(id) ON DELETE CASCADE,
  party text NOT NULL CHECK (party IN ('company', 'partner')),
  user_id uuid REFERENCES public.users(id),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pay_stub_id, party)
);

COMMENT ON TABLE public.statement_acknowledgments IS
  'Mutual co-sign on partner weekly statements (§9b of the partner agreement): one company + one partner timestamp per pay stub. Partner-side rows are written by the acknowledge RPC (train PR 4), company-side by generate_partner_statement.';

ALTER TABLE public.statement_acknowledgments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Payroll access manages statement acknowledgments" ON public.statement_acknowledgments;
CREATE POLICY "Payroll access manages statement acknowledgments" ON public.statement_acknowledgments
  FOR ALL USING (public.has_payroll_access()) WITH CHECK (public.has_payroll_access());

GRANT SELECT, INSERT ON TABLE public.statement_acknowledgments TO authenticated;

-- 3 ▸ the farm job anchor ------------------------------------------------------

ALTER TABLE public.partnerships
  ADD COLUMN IF NOT EXISTS farm_job_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.partnerships.farm_job_ledger_id IS
  '§1c: the designated farm job. Approved hours clocked to it price at farm_rate (0 for Bryan) on statements. NULL = no farm bucket; farm-job hours would price as field.';

-- partnership_events grows a statement event type.
ALTER TABLE public.partnership_events DROP CONSTRAINT IF EXISTS partnership_events_event_type_check;
ALTER TABLE public.partnership_events ADD CONSTRAINT partnership_events_event_type_check
  CHECK (event_type IN ('created', 'config_changed', 'status_changed', 'statement_generated'));

-- 4 ▸ generate_partner_statement ----------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_partner_statement(
  p_partnership_id uuid,
  p_week_start date,
  p_override boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.partnerships%ROWTYPE;
  v_person_name text;
  v_user uuid;
  v_week_end date;
  v_existing uuid;
  v_unapproved int;
  v_unreviewed int;
  v_stub uuid;
  v_field numeric := 0;
  v_office numeric := 0;
  v_farm numeric := 0;
  v_gross numeric := 0;
  v_hours numeric := 0;
  v_deducted numeric := 0;
  v_added numeric := 0;
  v_skipped int := 0;
  r record;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT * INTO v_p FROM public.partnerships WHERE id = p_partnership_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'partnership not found';
  END IF;
  IF (v_p.modules ->> 'weekly_statement') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'weekly statements are off for this partnership';
  END IF;
  IF EXTRACT(DOW FROM p_week_start) <> 0 THEN
    RAISE EXCEPTION 'week must start on a Sunday (company pay weeks are Sun–Sat)';
  END IF;
  v_week_end := p_week_start + 6;

  SELECT pe.name, pe.account_user_id INTO v_person_name, v_user
  FROM public.people pe WHERE pe.id = v_p.person_id;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'partner person has no linked app user';
  END IF;

  -- Idempotent per person + week.
  SELECT id INTO v_existing FROM public.pay_stubs
  WHERE person_id = v_p.person_id AND period_start = p_week_start AND period_end = v_week_end
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('pay_stub_id', v_existing, 'already', true);
  END IF;

  -- Guards (unless override, which is logged).
  SELECT COUNT(*) INTO v_unapproved
  FROM public.clock_sessions cs
  WHERE cs.user_id = v_user
    AND cs.work_date BETWEEN p_week_start AND v_week_end
    AND cs.clocked_out_at IS NOT NULL
    AND cs.approved_at IS NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL;

  SELECT COUNT(DISTINCT cs.job_ledger_id) INTO v_unreviewed
  FROM public.clock_sessions cs
  JOIN public.jobs_ledger j ON j.id = cs.job_ledger_id
  WHERE cs.user_id = v_user
    AND cs.work_date BETWEEN p_week_start AND v_week_end
    AND cs.job_ledger_id IS NOT NULL
    AND cs.clocked_out_at IS NOT NULL
    AND cs.approved_at IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
    AND (v_p.farm_job_ledger_id IS NULL OR cs.job_ledger_id <> v_p.farm_job_ledger_id)
    AND j.partner_person_id IS DISTINCT FROM v_p.person_id;

  IF NOT p_override THEN
    IF v_unapproved > 0 THEN
      RAISE EXCEPTION 'blocked: % session(s) pending approval in this week (override to generate anyway)', v_unapproved;
    END IF;
    IF v_unreviewed > 0 THEN
      RAISE EXCEPTION 'blocked: % worked job(s) not reviewed for partner majority (override to generate anyway)', v_unreviewed;
    END IF;
  END IF;

  -- Create the stub shell first (updated with totals below).
  INSERT INTO public.pay_stubs (person_name, person_id, period_start, period_end, hours_total, gross_pay, created_by)
  VALUES (v_person_name, v_p.person_id, p_week_start, v_week_end, 0, 0, auth.uid())
  RETURNING id INTO v_stub;

  -- Per-day buckets from APPROVED sessions, priced at the partnership's
  -- current rates — stamped into rate_at_time so later changes never reprice.
  FOR r IN
    SELECT cs.work_date,
      SUM(CASE WHEN v_p.farm_job_ledger_id IS NOT NULL AND cs.job_ledger_id = v_p.farm_job_ledger_id
               THEN EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0 ELSE 0 END) AS farm_hrs,
      SUM(CASE WHEN cs.job_ledger_id IS NOT NULL AND (v_p.farm_job_ledger_id IS NULL OR cs.job_ledger_id <> v_p.farm_job_ledger_id)
               THEN EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0 ELSE 0 END) AS field_hrs,
      SUM(CASE WHEN cs.job_ledger_id IS NULL
               THEN EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0 ELSE 0 END) AS office_hrs
    FROM public.clock_sessions cs
    WHERE cs.user_id = v_user
      AND cs.work_date BETWEEN p_week_start AND v_week_end
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
    GROUP BY cs.work_date
    ORDER BY cs.work_date
  LOOP
    IF r.field_hrs > 0 THEN
      INSERT INTO public.pay_stub_days (pay_stub_id, person_name, person_id, work_date, hours_at_time, rate_at_time, paid_amount)
      VALUES (v_stub, v_person_name, v_p.person_id, r.work_date, ROUND(r.field_hrs::numeric, 2), v_p.field_rate, ROUND((r.field_hrs * v_p.field_rate)::numeric, 2));
      v_field := v_field + r.field_hrs;
    END IF;
    IF r.office_hrs > 0 THEN
      INSERT INTO public.pay_stub_days (pay_stub_id, person_name, person_id, work_date, hours_at_time, rate_at_time, paid_amount)
      VALUES (v_stub, v_person_name, v_p.person_id, r.work_date, ROUND(r.office_hrs::numeric, 2), v_p.estimating_rate, ROUND((r.office_hrs * v_p.estimating_rate)::numeric, 2));
      v_office := v_office + r.office_hrs;
    END IF;
    IF r.farm_hrs > 0 THEN
      INSERT INTO public.pay_stub_days (pay_stub_id, person_name, person_id, work_date, hours_at_time, rate_at_time, paid_amount)
      VALUES (v_stub, v_person_name, v_p.person_id, r.work_date, ROUND(r.farm_hrs::numeric, 2), v_p.farm_rate, ROUND((r.farm_hrs * v_p.farm_rate)::numeric, 2));
      v_farm := v_farm + r.farm_hrs;
    END IF;
  END LOOP;

  v_hours := ROUND((v_field + v_office + v_farm)::numeric, 2);
  v_gross := ROUND((v_field * v_p.field_rate + v_office * v_p.estimating_rate + v_farm * v_p.farm_rate)::numeric, 2);

  UPDATE public.pay_stubs SET hours_total = v_hours, gross_pay = v_gross WHERE id = v_stub;

  -- Attach pending offsets. Positive-to-partner types become additional lines;
  -- charge types become deductions, attached oldest-first only while the DB's
  -- gross-pay enforcement allows — the rest stay pending for a later week.
  FOR r IN
    SELECT * FROM public.person_offsets
    WHERE person_id = v_p.person_id AND pay_stub_id IS NULL AND occurred_date <= v_week_end
    ORDER BY occurred_date, created_at
  LOOP
    IF r.type IN ('profit_share', 'employee_credit') THEN
      INSERT INTO public.pay_stub_additional_lines (pay_stub_id, description, quantity, rate, created_by)
      VALUES (v_stub, COALESCE(r.description, r.type), 1, r.amount, auth.uid());
      UPDATE public.person_offsets SET pay_stub_id = v_stub WHERE id = r.id;
      v_added := v_added + r.amount;
    ELSE
      IF v_deducted + r.amount <= v_gross + v_added THEN
        INSERT INTO public.pay_stub_deductions (pay_stub_id, amount, source, person_offset_id, description, created_by)
        VALUES (v_stub, r.amount, 'offset', r.id, COALESCE(r.description, r.type), auth.uid());
        UPDATE public.person_offsets SET pay_stub_id = v_stub WHERE id = r.id;
        v_deducted := v_deducted + r.amount;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    END IF;
  END LOOP;

  -- Company side of the §9b co-sign.
  INSERT INTO public.statement_acknowledgments (pay_stub_id, party, user_id)
  VALUES (v_stub, 'company', auth.uid())
  ON CONFLICT (pay_stub_id, party) DO NOTHING;

  -- Audit trail (override is visible here forever).
  INSERT INTO public.partnership_events (partnership_id, event_type, patch, actor_user_id)
  VALUES (p_partnership_id, 'statement_generated',
          jsonb_build_object('pay_stub_id', v_stub, 'week_start', p_week_start, 'override', p_override,
                             'unapproved_at_generate', v_unapproved, 'unreviewed_at_generate', v_unreviewed),
          auth.uid());

  RETURN jsonb_build_object(
    'pay_stub_id', v_stub, 'already', false,
    'hours_total', v_hours, 'gross_pay', v_gross,
    'field_hours', ROUND(v_field::numeric, 2), 'office_hours', ROUND(v_office::numeric, 2), 'farm_hours', ROUND(v_farm::numeric, 2),
    'deductions_attached', v_deducted, 'additions_attached', v_added, 'offsets_left_pending', v_skipped,
    'override', p_override
  );
END;
$$;

ALTER FUNCTION public.generate_partner_statement(uuid, date, boolean) OWNER TO postgres;
COMMENT ON FUNCTION public.generate_partner_statement(uuid, date, boolean) IS
  'Dev-only: builds a partner weekly statement (pay_stubs + pay_stub_days at partnership rates, offsets attached, company acknowledgment, event log). Guarded on unapproved sessions and unreviewed worked jobs unless override (logged). Idempotent per person+week.';
GRANT ALL ON FUNCTION public.generate_partner_statement(uuid, date, boolean) TO anon;
GRANT ALL ON FUNCTION public.generate_partner_statement(uuid, date, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.generate_partner_statement(uuid, date, boolean) TO service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
