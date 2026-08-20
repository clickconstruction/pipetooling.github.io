SET lock_timeout = '3s';

-- Partnerships train PR 6 (PARTNERSHIPS_PLAN.md): the §4h transfer.
-- "Time involved for estimates on successful projects awarded shall be
-- deducted from the project as a direct job expense, at $35/hr."
--
-- The partner is paid once for estimating either way (their bid-tagged hours
-- ride the weekly statement as office pay). What moves is the COST: on an
-- awarded job, those hours become a sourced `jobs_ledger_materials` row (the
-- "direct expenses / other job charges" bucket the §3 split already reads),
-- so the job's profit carries the true cost of winning it. Lost bids stay
-- overhead — covered by the company's 22% first cut.
--
--   get_partner_bid_estimating_hours(job) — the dev picker: bids the flagged
--     partner clocked approved estimating hours on, with where (if anywhere)
--     each bid's transfer has already landed.
--   apply_bid_estimating_hours_to_job(job, bid) — writes the sourced row.
--     Idempotent per (job, bid) via a partial-unique index; a bid's transfer
--     can land on ONE job only (unique on source_bid_id).

ALTER TABLE public.jobs_ledger_materials
  ADD COLUMN IF NOT EXISTS source_bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.jobs_ledger_materials.source_bid_id IS
  '§4h estimating-transfer source: the bid whose partner estimating hours priced this row. NULL for manual charges. One transfer per bid (unique).';

CREATE UNIQUE INDEX IF NOT EXISTS jobs_ledger_materials_source_bid_once_idx
  ON public.jobs_ledger_materials (source_bid_id)
  WHERE source_bid_id IS NOT NULL;

ALTER TABLE public.partnership_events DROP CONSTRAINT IF EXISTS partnership_events_event_type_check;
ALTER TABLE public.partnership_events ADD CONSTRAINT partnership_events_event_type_check
  CHECK (event_type IN ('created', 'config_changed', 'status_changed', 'statement_generated', 'profit_share_posted', 'profit_share_reversed', 'estimating_transferred'));

CREATE OR REPLACE FUNCTION public.get_partner_bid_estimating_hours(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_j public.jobs_ledger%ROWTYPE;
  v_p public.partnerships%ROWTYPE;
  v_user uuid;
  v_rows jsonb;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  SELECT * INTO v_j FROM public.jobs_ledger WHERE id = p_job_id;
  IF NOT FOUND OR v_j.partner_person_id IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;
  SELECT * INTO v_p FROM public.partnerships WHERE person_id = v_j.partner_person_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false);
  END IF;
  SELECT account_user_id INTO v_user FROM public.people WHERE id = v_p.person_id;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'bid_id', b.id,
    'bid_name', COALESCE(NULLIF(btrim(COALESCE(b.project_name, '')), ''), b.id::text),
    'hours', ROUND(bh.hrs::numeric, 1),
    'rate', v_p.estimating_rate,
    'amount', ROUND((bh.hrs * v_p.estimating_rate)::numeric, 2),
    'applied_job_id', m.job_id,
    'applied_here', (m.job_id = p_job_id)
  ) ORDER BY bh.hrs DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT cs.bid_id, SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS hrs
    FROM public.clock_sessions cs
    WHERE cs.user_id = v_user
      AND cs.bid_id IS NOT NULL
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
    GROUP BY cs.bid_id
    HAVING SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at))) > 0
  ) bh
  JOIN public.bids b ON b.id = bh.bid_id
  LEFT JOIN public.jobs_ledger_materials m ON m.source_bid_id = bh.bid_id;

  RETURN jsonb_build_object('exists', true, 'est_transfer_on', (v_p.modules ->> 'est_transfer') = 'true', 'rows', v_rows);
END;
$$;
ALTER FUNCTION public.get_partner_bid_estimating_hours(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.get_partner_bid_estimating_hours(uuid) IS
  'Dev-only §4h picker for a partner-flagged job: the partner''s approved bid-tagged estimating hours per bid, priced at the partnership estimating rate, with any already-applied transfer location.';
GRANT ALL ON FUNCTION public.get_partner_bid_estimating_hours(uuid) TO anon;
GRANT ALL ON FUNCTION public.get_partner_bid_estimating_hours(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_partner_bid_estimating_hours(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_bid_estimating_hours_to_job(p_job_id uuid, p_bid_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_j public.jobs_ledger%ROWTYPE;
  v_p public.partnerships%ROWTYPE;
  v_user uuid;
  v_hours numeric;
  v_amount numeric;
  v_bid_name text;
  v_id uuid;
  v_existing record;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  SELECT * INTO v_j FROM public.jobs_ledger WHERE id = p_job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'job not found'; END IF;
  IF v_j.partner_person_id IS NULL THEN RAISE EXCEPTION 'job has no partner majority flag'; END IF;
  SELECT * INTO v_p FROM public.partnerships WHERE person_id = v_j.partner_person_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'flagged person has no partnership'; END IF;
  IF (v_p.modules ->> 'est_transfer') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'estimate-hours transfer is off for this partnership';
  END IF;
  SELECT account_user_id INTO v_user FROM public.people WHERE id = v_p.person_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'partner person has no linked app user'; END IF;

  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0), 0)
  INTO v_hours
  FROM public.clock_sessions cs
  WHERE cs.user_id = v_user
    AND cs.bid_id = p_bid_id
    AND cs.clocked_out_at IS NOT NULL
    AND cs.approved_at IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL;

  IF v_hours <= 0 THEN
    RAISE EXCEPTION 'no approved estimating hours on that bid for this partner';
  END IF;
  v_hours := ROUND(v_hours::numeric, 1);
  v_amount := ROUND((v_hours * v_p.estimating_rate)::numeric, 2);
  SELECT COALESCE(NULLIF(btrim(COALESCE(project_name, '')), ''), id::text) INTO v_bid_name FROM public.bids WHERE id = p_bid_id;

  BEGIN
    INSERT INTO public.jobs_ledger_materials (job_id, description, amount, sequence_order, source_bid_id)
    VALUES (p_job_id,
            'Estimating at award — ' || v_hours || ' h × $' || v_p.estimating_rate || ' (§4h, bid ' || v_bid_name || ')',
            v_amount,
            COALESCE((SELECT MAX(sequence_order) + 1 FROM public.jobs_ledger_materials WHERE job_id = p_job_id), 0),
            p_bid_id)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id, job_id, amount INTO v_existing FROM public.jobs_ledger_materials WHERE source_bid_id = p_bid_id;
    RETURN jsonb_build_object('already', true, 'row_id', v_existing.id, 'job_id', v_existing.job_id, 'amount', v_existing.amount);
  END;

  INSERT INTO public.partnership_events (partnership_id, event_type, patch, actor_user_id)
  VALUES (v_p.id, 'estimating_transferred',
          jsonb_build_object('job_id', p_job_id, 'bid_id', p_bid_id, 'hours', v_hours, 'amount', v_amount, 'row_id', v_id),
          auth.uid());

  RETURN jsonb_build_object('already', false, 'row_id', v_id, 'hours', v_hours, 'amount', v_amount);
END;
$$;
ALTER FUNCTION public.apply_bid_estimating_hours_to_job(uuid, uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.apply_bid_estimating_hours_to_job(uuid, uuid) IS
  'Dev-only §4h transfer: the partner''s approved bid-tagged hours × the partnership estimating rate become a sourced direct-expense row on the awarded job. One transfer per bid (unique on source_bid_id); reapply returns the existing row.';
GRANT ALL ON FUNCTION public.apply_bid_estimating_hours_to_job(uuid, uuid) TO anon;
GRANT ALL ON FUNCTION public.apply_bid_estimating_hours_to_job(uuid, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.apply_bid_estimating_hours_to_job(uuid, uuid) TO service_role;
