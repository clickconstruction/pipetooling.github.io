SET lock_timeout = '3s';

-- Burn against the bid, PR 1 (v2.3297): the job budget lives on the job, with a provenance.
--
--   job_budgets — one row per job: kind 'bid' (a snapshot of the linked bid's direct
--   cost, stamped with the bid, the version, when and by whom, and how complete the
--   estimate was) or 'typed' (hours · materials $ · subs $ from the person who scoped
--   the job). No row = the job burns against the assumption (price × (1 − target)).
--
--   bid_estimate_breakdown(p_bid_id)   — the single-bid form of bid_pricing_history's
--     math, with the v2.3291 row rules (task · sub · per 100 ft) and the v2.3294 total
--     (estimator time and team labor are facts, not cost). Returns jsonb.
--   snapshot_job_budget_from_bid(p_job_id, p_bid_id) — links the job to the bid
--     (jobs_ledger.bid_id) and snapshots the breakdown into job_budgets, in one
--     transaction. Refresh = the same call. SECURITY INVOKER: the caller's RLS on
--     jobs_ledger decides who may link; the existing trigger marks the bid
--     started_or_complete.
--   set_typed_job_budget(...)           — the typed path.
--   clear_job_budget(p_job_id)          — back to the assumption (the link stays).
--   suggest_bids_for_job(p_job_id)      — ranked candidates: 1 · a bid value or agreed
--     value equal to the job's price (± $1) · 2 · same GC customer and won · 3 · the same
--     address prefix. At most three; nothing auto-links.
--
-- Additive, idempotent. Push after the client deploy (nothing reads the table until then).

CREATE TABLE IF NOT EXISTS public.job_budgets (
  job_id uuid PRIMARY KEY REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('bid', 'typed')),
  bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  bid_version_id uuid REFERENCES public.bid_versions(id) ON DELETE SET NULL,
  labor_hours numeric NOT NULL DEFAULT 0,
  labor_rate numeric,
  labor_usd numeric NOT NULL DEFAULT 0,
  materials_usd numeric NOT NULL DEFAULT 0,
  subs_usd numeric NOT NULL DEFAULT 0,
  -- equipment + permits + waste + other + driving + travel
  other_usd numeric NOT NULL DEFAULT 0,
  total_direct_usd numeric NOT NULL DEFAULT 0,
  -- { rows_total, rows_with_hours, rate_set, materials_source ('po' | 'takeoff' | 'none'), usable }
  completeness jsonb NOT NULL DEFAULT '{}'::jsonb,
  taken_at timestamptz NOT NULL DEFAULT now(),
  taken_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_budgets_bid_id_idx ON public.job_budgets (bid_id);

COMMENT ON TABLE public.job_budgets IS
  'The job''s direct-cost budget with a provenance (v2.3297): kind bid = a snapshot of the linked bid''s estimate (bid_id, bid_version_id, taken_at/by, completeness); kind typed = hours · materials · subs typed by the person who scoped the job. No row = Burn assumes price × (1 − target). Written by snapshot_job_budget_from_bid / set_typed_job_budget / clear_job_budget.';

ALTER TABLE public.job_budgets ENABLE ROW LEVEL SECURITY;

-- Reads mirror the job: anyone who can read the jobs_ledger row reads its budget.
DROP POLICY IF EXISTS "Job readers read job budgets" ON public.job_budgets;
CREATE POLICY "Job readers read job budgets" ON public.job_budgets
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = job_budgets.job_id));

-- Writes mirror the job's office writers (dev · master technician · assistant-like), on a job they can read.
CREATE OR REPLACE FUNCTION public.can_write_job_budget(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT (public.is_dev() OR public.is_assistant()
          OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'))
     AND EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id);
$$;

DROP POLICY IF EXISTS "Job writers manage job budgets" ON public.job_budgets;
CREATE POLICY "Job writers manage job budgets" ON public.job_budgets
  FOR ALL USING (public.can_write_job_budget(job_id)) WITH CHECK (public.can_write_job_budget(job_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_budgets TO authenticated;

-- ---------------------------------------------------------------------------
-- bid_estimate_breakdown: what the bid's Cost Estimate tab says the job will cost.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bid_estimate_breakdown(p_bid_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  ce record;
  v_bid record;
  v_hours_rough numeric := 0;
  v_hours_top numeric := 0;
  v_hours_trim numeric := 0;
  v_hours numeric := 0;
  v_rows_total integer := 0;
  v_rows_with_hours integer := 0;
  v_rate numeric;
  v_labor numeric := 0;
  v_po_materials numeric := 0;
  v_takeoff_materials numeric := 0;
  v_materials numeric := 0;
  v_materials_source text := 'none';
  v_subs numeric := 0;
  v_equipment numeric := 0;
  v_permits numeric := 0;
  v_waste numeric := 0;
  v_other_rows numeric := 0;
  v_distance numeric := 0;
  v_hours_per_trip numeric;
  v_rate_per_mile numeric;
  v_driving numeric := 0;
  v_travel numeric := 0;
  v_other numeric := 0;
  v_total numeric := 0;
  v_count_rows integer := 0;
  v_usable boolean := false;
  v_has_ce boolean := false;
BEGIN
  SELECT b.id, b.bid_value, b.agreed_value, b.distance_from_office, b.project_name, b.bid_number
    INTO v_bid FROM public.bids b WHERE b.id = p_bid_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT c.* INTO ce FROM public.cost_estimates c WHERE c.bid_id = p_bid_id;
  v_has_ce := FOUND;
  SELECT COUNT(*) INTO v_count_rows FROM public.bids_count_rows cr WHERE cr.bid_id = p_bid_id;

  IF v_has_ce THEN
    -- Labor hours: the one reading rule (v2.3291) — sub 0 · task/fixed 1 · per 100 ft count ÷ 100 · else count.
    SELECT
      COALESCE(SUM(m.mult * r.rough_in_hrs_per_unit), 0),
      COALESCE(SUM(m.mult * r.top_out_hrs_per_unit), 0),
      COALESCE(SUM(m.mult * r.trim_set_hrs_per_unit), 0),
      COUNT(*) FILTER (WHERE COALESCE(r.kind, 'fixture') <> 'sub'),
      COUNT(*) FILTER (WHERE COALESCE(r.kind, 'fixture') <> 'sub' AND (r.rough_in_hrs_per_unit > 0 OR r.top_out_hrs_per_unit > 0 OR r.trim_set_hrs_per_unit > 0))
      INTO v_hours_rough, v_hours_top, v_hours_trim, v_rows_total, v_rows_with_hours
    FROM public.cost_estimate_labor_rows r
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN COALESCE(r.kind, 'fixture') = 'sub' THEN 0
        WHEN r.is_fixed OR COALESCE(r.kind, 'fixture') = 'task' THEN 1
        WHEN COALESCE(r.unit, 'each') = 'per_100ft' THEN COALESCE(r.count, 0) / 100.0
        ELSE COALESCE(r.count, 0)
      END AS mult
    ) m
    WHERE r.cost_estimate_id = ce.id;
    v_hours := v_hours_rough + v_hours_top + v_hours_trim;
    v_rate := ce.labor_rate;
    v_labor := v_hours * COALESCE(v_rate, 0);

    -- Materials: the three stage POs when they exist, else the base takeoff's rough lines × counts.
    SELECT COALESCE(SUM(i.price_at_time * i.quantity), 0) INTO v_po_materials
      FROM public.purchase_order_items i
     WHERE i.purchase_order_id IN (ce.purchase_order_id_rough_in, ce.purchase_order_id_top_out, ce.purchase_order_id_trim_set);
    SELECT COALESCE(SUM(l.quantity * l.unit_price * COALESCE(cr.count, 0)), 0) INTO v_takeoff_materials
      FROM public.bids_takeoff_rough_part_lines l
      JOIN public.bids_count_rows cr ON cr.id = l.count_row_id
     WHERE l.bid_id = p_bid_id AND l.bid_version_id IS NULL;
    IF v_po_materials > 0 THEN
      v_materials := v_po_materials; v_materials_source := 'po';
    ELSIF v_takeoff_materials > 0 THEN
      v_materials := v_takeoff_materials; v_materials_source := 'takeoff';
    END IF;

    -- The five direct-cost tables (blanks and negatives read as 0, as on the tab).
    SELECT COALESCE(SUM(GREATEST(s.rough_in, 0) + GREATEST(s.top_out, 0) + GREATEST(s.trim_set, 0)), 0) INTO v_subs FROM public.cost_estimate_subcontractor_rows s WHERE s.cost_estimate_id = ce.id;
    SELECT COALESCE(SUM(GREATEST(e.rough_in, 0) + GREATEST(e.top_out, 0) + GREATEST(e.trim_set, 0)), 0) INTO v_equipment FROM public.cost_estimate_equipment_rows e WHERE e.cost_estimate_id = ce.id;
    SELECT COALESCE(SUM(GREATEST(p.rough_in, 0) + GREATEST(p.top_out, 0) + GREATEST(p.trim_set, 0)), 0) INTO v_permits FROM public.cost_estimate_permit_rows p WHERE p.cost_estimate_id = ce.id;
    SELECT COALESCE(SUM(GREATEST(w.rough_in, 0) + GREATEST(w.top_out, 0) + GREATEST(w.trim_set, 0)), 0) INTO v_waste FROM public.cost_estimate_waste_rows w WHERE w.cost_estimate_id = ce.id;
    SELECT COALESCE(SUM(GREATEST(o.rough_in, 0) + GREATEST(o.top_out, 0) + GREATEST(o.trim_set, 0)), 0) INTO v_other_rows FROM public.cost_estimate_other_rows o WHERE o.cost_estimate_id = ce.id;

    -- Driving and travel, the tab's defaults ($0.70/mi, 2 h per trip, 1 person, 1 night).
    v_distance := COALESCE(NULLIF(regexp_replace(COALESCE(v_bid.distance_from_office, ''), '[^0-9.]', '', 'g'), '')::numeric, 0);
    v_hours_per_trip := COALESCE(NULLIF(ce.hours_per_trip, 0), 2.0);
    v_rate_per_mile := COALESCE(ce.driving_cost_rate, 0.70);
    v_driving := CASE WHEN v_hours_per_trip > 0 THEN (v_hours / v_hours_per_trip) * v_rate_per_mile * v_distance ELSE 0 END;
    v_travel := COALESCE(ce.travel_people, 1) * COALESCE(ce.travel_nights, 1) * (COALESCE(ce.travel_meals_rate, 0) + COALESCE(ce.travel_hotel_rate, 0));
  END IF;

  v_other := v_equipment + v_permits + v_waste + v_other_rows + v_driving + v_travel;
  v_total := v_labor + v_materials + v_subs + v_other;
  v_usable := v_has_ce AND v_rows_total > 0 AND v_rows_with_hours::numeric / v_rows_total >= 0.9 AND COALESCE(v_rate, 0) > 0;

  RETURN jsonb_build_object(
    'bid_id', p_bid_id,
    'bid_number', v_bid.bid_number,
    'project_name', v_bid.project_name,
    'bid_value', v_bid.bid_value,
    'agreed_value', v_bid.agreed_value,
    'has_estimate', v_has_ce,
    'labor_hours', v_hours,
    'labor_hours_by_stage', jsonb_build_object('rough', v_hours_rough, 'top', v_hours_top, 'trim', v_hours_trim),
    'labor_rate', v_rate,
    'labor_usd', v_labor,
    'materials_usd', v_materials,
    'subs_usd', v_subs,
    'equipment_usd', v_equipment,
    'permits_usd', v_permits,
    'waste_usd', v_waste,
    'other_rows_usd', v_other_rows,
    'driving_usd', v_driving,
    'travel_usd', v_travel,
    'other_usd', v_other,
    'total_direct_usd', v_total,
    'count_rows', v_count_rows,
    'completeness', jsonb_build_object(
      'rows_total', v_rows_total,
      'rows_with_hours', v_rows_with_hours,
      'rate_set', COALESCE(v_rate, 0) > 0,
      'materials_source', v_materials_source,
      'usable', v_usable
    )
  );
END;
$$;

COMMENT ON FUNCTION public.bid_estimate_breakdown(uuid) IS
  'v2.3297: the bid''s direct cost as the Cost Estimate tab reads it — labor hours (task · sub · per-100-ft rules) × labor_rate, materials (stage POs, else the base takeoff''s rough lines), the five direct-cost tables, driving, travel — and a completeness report. Estimator time and team labor are not cost (v2.3294). SECURITY INVOKER.';

GRANT EXECUTE ON FUNCTION public.bid_estimate_breakdown(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- snapshot_job_budget_from_bid: link + snapshot in one transaction (refresh = the same call).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snapshot_job_budget_from_bid(p_job_id uuid, p_bid_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_job record;
  v_breakdown jsonb;
  v_version_id uuid;
  v_row public.job_budgets;
BEGIN
  IF NOT public.can_write_job_budget(p_job_id) THEN
    RAISE EXCEPTION 'You cannot change this job''s budget' USING ERRCODE = '42501';
  END IF;
  SELECT j.id, j.bid_id INTO v_job FROM public.jobs_ledger j WHERE j.id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_job.bid_id IS NOT NULL AND v_job.bid_id <> p_bid_id THEN
    RAISE EXCEPTION 'This job is linked to a different bid — unlink it on the job first' USING ERRCODE = '23505';
  END IF;
  IF v_job.bid_id IS NULL THEN
    UPDATE public.jobs_ledger SET bid_id = p_bid_id WHERE id = p_job_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'You cannot link this job' USING ERRCODE = '42501';
    END IF;
  END IF;
  v_breakdown := public.bid_estimate_breakdown(p_bid_id);
  IF v_breakdown IS NULL THEN
    RAISE EXCEPTION 'Bid not found' USING ERRCODE = 'P0002';
  END IF;
  -- The active version's id when the bid has versions; the unsplit base otherwise.
  SELECT v.id INTO v_version_id FROM public.bid_versions v WHERE v.bid_id = p_bid_id ORDER BY v.created_at DESC NULLS LAST LIMIT 1;

  INSERT INTO public.job_budgets AS jb (job_id, kind, bid_id, bid_version_id, labor_hours, labor_rate, labor_usd, materials_usd, subs_usd, other_usd, total_direct_usd, completeness, taken_at, taken_by, note)
  VALUES (
    p_job_id, 'bid', p_bid_id, v_version_id,
    (v_breakdown->>'labor_hours')::numeric,
    (v_breakdown->>'labor_rate')::numeric,
    (v_breakdown->>'labor_usd')::numeric,
    (v_breakdown->>'materials_usd')::numeric,
    (v_breakdown->>'subs_usd')::numeric,
    (v_breakdown->>'other_usd')::numeric,
    (v_breakdown->>'total_direct_usd')::numeric,
    COALESCE(v_breakdown->'completeness', '{}'::jsonb),
    now(), (SELECT auth.uid()), NULL
  )
  ON CONFLICT (job_id) DO UPDATE SET
    kind = EXCLUDED.kind,
    bid_id = EXCLUDED.bid_id,
    bid_version_id = EXCLUDED.bid_version_id,
    labor_hours = EXCLUDED.labor_hours,
    labor_rate = EXCLUDED.labor_rate,
    labor_usd = EXCLUDED.labor_usd,
    materials_usd = EXCLUDED.materials_usd,
    subs_usd = EXCLUDED.subs_usd,
    other_usd = EXCLUDED.other_usd,
    total_direct_usd = EXCLUDED.total_direct_usd,
    completeness = EXCLUDED.completeness,
    taken_at = EXCLUDED.taken_at,
    taken_by = EXCLUDED.taken_by,
    note = NULL,
    updated_at = now()
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row) || jsonb_build_object('breakdown', v_breakdown);
END;
$$;

COMMENT ON FUNCTION public.snapshot_job_budget_from_bid(uuid, uuid) IS
  'v2.3297: link the job to the bid (jobs_ledger.bid_id, when unset) and snapshot bid_estimate_breakdown into job_budgets as kind bid — one transaction; calling again refreshes the snapshot. SECURITY INVOKER: the caller''s jobs_ledger RLS decides.';

GRANT EXECUTE ON FUNCTION public.snapshot_job_budget_from_bid(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- set_typed_job_budget / clear_job_budget: the typed path and the way back.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_typed_job_budget(
  p_job_id uuid,
  p_labor_hours numeric,
  p_labor_rate numeric,
  p_materials_usd numeric,
  p_subs_usd numeric,
  p_other_usd numeric DEFAULT 0,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_hours numeric := GREATEST(COALESCE(p_labor_hours, 0), 0);
  v_rate numeric := GREATEST(COALESCE(p_labor_rate, 0), 0);
  v_materials numeric := GREATEST(COALESCE(p_materials_usd, 0), 0);
  v_subs numeric := GREATEST(COALESCE(p_subs_usd, 0), 0);
  v_other numeric := GREATEST(COALESCE(p_other_usd, 0), 0);
  v_row public.job_budgets;
BEGIN
  IF NOT public.can_write_job_budget(p_job_id) THEN
    RAISE EXCEPTION 'You cannot change this job''s budget' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.job_budgets AS jb (job_id, kind, bid_id, bid_version_id, labor_hours, labor_rate, labor_usd, materials_usd, subs_usd, other_usd, total_direct_usd, completeness, taken_at, taken_by, note)
  VALUES (
    p_job_id, 'typed', NULL, NULL,
    v_hours, NULLIF(v_rate, 0), v_hours * v_rate, v_materials, v_subs, v_other,
    v_hours * v_rate + v_materials + v_subs + v_other,
    jsonb_build_object('rows_total', 0, 'rows_with_hours', 0, 'rate_set', v_rate > 0, 'materials_source', CASE WHEN v_materials > 0 THEN 'typed' ELSE 'none' END, 'usable', v_hours > 0 AND v_rate > 0),
    now(), (SELECT auth.uid()), NULLIF(btrim(COALESCE(p_note, '')), '')
  )
  ON CONFLICT (job_id) DO UPDATE SET
    kind = EXCLUDED.kind,
    bid_id = NULL,
    bid_version_id = NULL,
    labor_hours = EXCLUDED.labor_hours,
    labor_rate = EXCLUDED.labor_rate,
    labor_usd = EXCLUDED.labor_usd,
    materials_usd = EXCLUDED.materials_usd,
    subs_usd = EXCLUDED.subs_usd,
    other_usd = EXCLUDED.other_usd,
    total_direct_usd = EXCLUDED.total_direct_usd,
    completeness = EXCLUDED.completeness,
    taken_at = EXCLUDED.taken_at,
    taken_by = EXCLUDED.taken_by,
    note = EXCLUDED.note,
    updated_at = now()
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END;
$$;

COMMENT ON FUNCTION public.set_typed_job_budget(uuid, numeric, numeric, numeric, numeric, numeric, text) IS
  'v2.3297: the typed budget — hours × the rate the caller passes (the company crew rate), materials, subs, other — as kind typed. Replaces a bid snapshot; the job''s bid link is untouched.';

GRANT EXECUTE ON FUNCTION public.set_typed_job_budget(uuid, numeric, numeric, numeric, numeric, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_job_budget(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_write_job_budget(p_job_id) THEN
    RAISE EXCEPTION 'You cannot change this job''s budget' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.job_budgets WHERE job_id = p_job_id;
END;
$$;

COMMENT ON FUNCTION public.clear_job_budget(uuid) IS 'v2.3297: drop the job''s budget row — Burn goes back to the assumption. The bid link (jobs_ledger.bid_id) stays.';

GRANT EXECUTE ON FUNCTION public.clear_job_budget(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- suggest_bids_for_job: ranked candidates. Nothing auto-links.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.suggest_bids_for_job(p_job_id uuid)
RETURNS TABLE (
  bid_id uuid,
  bid_number text,
  project_name text,
  bid_value numeric,
  agreed_value numeric,
  outcome text,
  customer_name text,
  rank integer,
  reason text,
  has_estimate boolean,
  estimate_hours numeric,
  linked_jobs integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH j AS (
    SELECT jl.id, jl.revenue, jl.gc_customer_id, jl.customer_id, lower(btrim(jl.job_address)) AS addr
    FROM public.jobs_ledger jl WHERE jl.id = p_job_id
  ),
  ranked AS (
    SELECT b.id,
      CASE
        WHEN j.revenue IS NOT NULL AND j.revenue > 0
             AND (ABS(COALESCE(b.agreed_value, b.bid_value) - j.revenue) <= 1 OR ABS(COALESCE(b.bid_value, 0) - j.revenue) <= 1) THEN 1
        WHEN b.outcome IN ('won', 'started_or_complete') AND b.customer_id IS NOT NULL AND b.customer_id IN (j.gc_customer_id, j.customer_id) THEN 2
        WHEN length(j.addr) >= 8 AND b.address IS NOT NULL AND lower(left(btrim(b.address), 12)) = left(j.addr, 12) THEN 3
      END AS rank
    FROM public.bids b CROSS JOIN j
  )
  SELECT b.id, b.bid_number, b.project_name, b.bid_value, b.agreed_value, b.outcome,
         c.name AS customer_name,
         r.rank,
         CASE r.rank WHEN 1 THEN 'matches the job''s price to the dollar' WHEN 2 THEN 'same GC, won' ELSE 'same address' END AS reason,
         (ce.id IS NOT NULL) AS has_estimate,
         COALESCE((SELECT SUM(CASE
             WHEN COALESCE(lr.kind, 'fixture') = 'sub' THEN 0
             WHEN lr.is_fixed OR COALESCE(lr.kind, 'fixture') = 'task' THEN 1
             WHEN COALESCE(lr.unit, 'each') = 'per_100ft' THEN COALESCE(lr.count, 0) / 100.0
             ELSE COALESCE(lr.count, 0) END * (lr.rough_in_hrs_per_unit + lr.top_out_hrs_per_unit + lr.trim_set_hrs_per_unit))
           FROM public.cost_estimate_labor_rows lr WHERE lr.cost_estimate_id = ce.id), 0)::numeric AS estimate_hours,
         (SELECT COUNT(*)::integer FROM public.jobs_ledger jx WHERE jx.bid_id = b.id) AS linked_jobs
  FROM ranked r
  JOIN public.bids b ON b.id = r.id
  LEFT JOIN public.customers c ON c.id = b.customer_id
  LEFT JOIN public.cost_estimates ce ON ce.bid_id = b.id
  WHERE r.rank IS NOT NULL
  ORDER BY r.rank, b.created_at DESC NULLS LAST
  LIMIT 3;
$$;

COMMENT ON FUNCTION public.suggest_bids_for_job(uuid) IS
  'v2.3297: up to three bids that could be this job''s — 1 · bid value / agreed value equals the job''s price (± $1) · 2 · same GC customer and won · 3 · same address prefix. Read-only; the person links.';

GRANT EXECUTE ON FUNCTION public.suggest_bids_for_job(uuid) TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
