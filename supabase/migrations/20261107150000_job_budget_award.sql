SET lock_timeout = '3s';

-- The budgets at award (punch list #234, PR 1a). Every project leaves award with one hours baseline,
-- frozen, and its source: the bid's Labor rows when usable, else the labor book's assumed hours (hours
-- per $1k from similar projects), else a typed figure. Two changes to job_budgets (v2.3297):
--
--   kind gains 'book' — the book's assumed hours as a row of its own, so the Costs strip, the
--   Pipeline's burning card and the superintendent's line read a number marked a guess instead of
--   nothing. A book row keeps the job's bid link (the bid was sent without hours; filling its Labor
--   rows makes the bid the pick).
--
--   awarded_* — the award snapshot: the kind, hours and dollars the job left award with, who froze
--   it and when. Written once by award_job_baseline and never updated: Refresh from bid moves the
--   live row (kind, labor_hours, …) and the score (PR 4) reads the award's.
--
--   set_book_job_budget(job, hours, rate, book jsonb) — the book path, as set_typed_job_budget is the typed one.
--   award_job_baseline(job, source, bid, hours, rate, book, note) — the one call the award window and
--   the Quickfill deck line make: writes the live row by its source, then stamps the award once.
--
-- Additive, idempotent. docs/migrations/20261107150000_job_budget_award.md.

ALTER TABLE public.job_budgets DROP CONSTRAINT IF EXISTS job_budgets_kind_check;
ALTER TABLE public.job_budgets ADD CONSTRAINT job_budgets_kind_check CHECK (kind IN ('bid', 'typed', 'book'));

ALTER TABLE public.job_budgets
  ADD COLUMN IF NOT EXISTS awarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS awarded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS awarded_kind text,
  ADD COLUMN IF NOT EXISTS awarded_labor_hours numeric,
  ADD COLUMN IF NOT EXISTS awarded_labor_usd numeric,
  ADD COLUMN IF NOT EXISTS awarded_materials_usd numeric,
  ADD COLUMN IF NOT EXISTS awarded_total_direct_usd numeric,
  ADD COLUMN IF NOT EXISTS awarded_detail jsonb;

ALTER TABLE public.job_budgets DROP CONSTRAINT IF EXISTS job_budgets_awarded_kind_check;
ALTER TABLE public.job_budgets ADD CONSTRAINT job_budgets_awarded_kind_check CHECK (awarded_kind IS NULL OR awarded_kind IN ('bid', 'typed', 'book'));

COMMENT ON COLUMN public.job_budgets.awarded_at IS 'Punch list #234 PR 1a: when the award snapshot was frozen. Written once by award_job_baseline; Refresh from bid never moves it.';
COMMENT ON COLUMN public.job_budgets.awarded_kind IS 'The source the job left award with: bid | book | typed. The score reads this row''s awarded_* figures, never the live ones.';
COMMENT ON COLUMN public.job_budgets.awarded_detail IS 'What the award figure was computed from: the bid''s completeness, the book''s hours per $1k and sample, or the typed note.';

-- ---------------------------------------------------------------------------
-- set_book_job_budget: the book's assumed hours as the job's budget, marked a guess.
-- p_book: { hours_per_thousand, n, price_usd, scope } as the Labor tab's reading has them.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_book_job_budget(
  p_job_id uuid,
  p_labor_hours numeric,
  p_labor_rate numeric,
  p_book jsonb DEFAULT '{}'::jsonb
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
  v_bid_id uuid;
  v_row public.job_budgets;
BEGIN
  IF NOT public.can_write_job_budget(p_job_id) THEN
    RAISE EXCEPTION 'You cannot change this job''s budget' USING ERRCODE = '42501';
  END IF;
  IF v_hours <= 0 THEN
    RAISE EXCEPTION 'The book''s hours must be more than zero' USING ERRCODE = '22023';
  END IF;
  -- The bid link stays on a book row: the bid was sent without hours, and filling its Labor rows makes it the pick.
  SELECT j.bid_id INTO v_bid_id FROM public.jobs_ledger j WHERE j.id = p_job_id;
  INSERT INTO public.job_budgets AS jb (job_id, kind, bid_id, bid_version_id, labor_hours, labor_rate, labor_usd, materials_usd, subs_usd, other_usd, total_direct_usd, completeness, taken_at, taken_by, note)
  VALUES (
    p_job_id, 'book', v_bid_id, NULL,
    v_hours, NULLIF(v_rate, 0), v_hours * v_rate, 0, 0, 0,
    v_hours * v_rate,
    jsonb_build_object('rows_total', 0, 'rows_with_hours', 0, 'rate_set', v_rate > 0, 'materials_source', 'none', 'usable', false, 'book', COALESCE(p_book, '{}'::jsonb)),
    now(), (SELECT auth.uid()), NULL
  )
  ON CONFLICT (job_id) DO UPDATE SET
    kind = EXCLUDED.kind,
    bid_id = COALESCE(EXCLUDED.bid_id, jb.bid_id),
    bid_version_id = NULL,
    labor_hours = EXCLUDED.labor_hours,
    labor_rate = EXCLUDED.labor_rate,
    labor_usd = EXCLUDED.labor_usd,
    materials_usd = 0,
    subs_usd = 0,
    other_usd = 0,
    total_direct_usd = EXCLUDED.total_direct_usd,
    completeness = EXCLUDED.completeness,
    taken_at = EXCLUDED.taken_at,
    taken_by = EXCLUDED.taken_by,
    note = NULL,
    updated_at = now()
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END;
$$;

COMMENT ON FUNCTION public.set_book_job_budget(uuid, numeric, numeric, jsonb) IS
  'Punch list #234 PR 1a: the labor book''s assumed hours (hours per $1k × the price) as the job''s budget, kind book — a guess, read as one. Labor only; materials, subs and other burn against the assumption. The job''s bid link stays.';

GRANT EXECUTE ON FUNCTION public.set_book_job_budget(uuid, numeric, numeric, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- award_job_baseline: the one press. Writes the live row by its source, then stamps the award once.
--   p_source 'bid'   → snapshot_job_budget_from_bid(job, p_bid_id)
--   p_source 'book'  → set_book_job_budget(job, p_labor_hours, p_labor_rate, p_book)
--   p_source 'typed' → set_typed_job_budget(job, p_labor_hours, p_labor_rate, 0, 0, 0, p_note)
-- A job already awarded keeps its award; the live row still moves, so the press that catches an
-- older project (the Quickfill deck line) freezes what it writes as that project's award.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_job_baseline(
  p_job_id uuid,
  p_source text,
  p_bid_id uuid DEFAULT NULL,
  p_labor_hours numeric DEFAULT NULL,
  p_labor_rate numeric DEFAULT NULL,
  p_book jsonb DEFAULT '{}'::jsonb,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_bid_id uuid := p_bid_id;
  v_row public.job_budgets;
BEGIN
  IF NOT public.can_write_job_budget(p_job_id) THEN
    RAISE EXCEPTION 'You cannot change this job''s budget' USING ERRCODE = '42501';
  END IF;
  IF p_source NOT IN ('bid', 'book', 'typed') THEN
    RAISE EXCEPTION 'The baseline''s source must be bid, book or typed' USING ERRCODE = '22023';
  END IF;
  IF p_source = 'bid' THEN
    IF v_bid_id IS NULL THEN
      SELECT j.bid_id INTO v_bid_id FROM public.jobs_ledger j WHERE j.id = p_job_id;
    END IF;
    IF v_bid_id IS NULL THEN
      RAISE EXCEPTION 'No bid is linked to this job' USING ERRCODE = '22023';
    END IF;
    PERFORM public.snapshot_job_budget_from_bid(p_job_id, v_bid_id);
  ELSIF p_source = 'book' THEN
    PERFORM public.set_book_job_budget(p_job_id, p_labor_hours, p_labor_rate, p_book);
  ELSE
    PERFORM public.set_typed_job_budget(p_job_id, p_labor_hours, p_labor_rate, 0, 0, 0, p_note);
  END IF;
  -- The award is written once: the first press freezes it, every later press leaves it.
  UPDATE public.job_budgets jb
     SET awarded_at = now(),
         awarded_by = (SELECT auth.uid()),
         awarded_kind = jb.kind,
         awarded_labor_hours = jb.labor_hours,
         awarded_labor_usd = jb.labor_usd,
         awarded_materials_usd = jb.materials_usd,
         awarded_total_direct_usd = jb.total_direct_usd,
         awarded_detail = jb.completeness || jsonb_build_object('note', jb.note, 'bid_id', jb.bid_id),
         updated_at = now()
   WHERE jb.job_id = p_job_id AND jb.awarded_at IS NULL;
  SELECT * INTO v_row FROM public.job_budgets WHERE job_id = p_job_id;
  RETURN to_jsonb(v_row);
END;
$$;

COMMENT ON FUNCTION public.award_job_baseline(uuid, text, uuid, numeric, numeric, jsonb, text) IS
  'Punch list #234 PR 1a: the baseline a project leaves award with — the live job_budgets row written by its source (bid → snapshot_job_budget_from_bid, book → set_book_job_budget, typed → set_typed_job_budget), then the awarded_* snapshot stamped once and never moved. SECURITY INVOKER over can_write_job_budget.';

GRANT EXECUTE ON FUNCTION public.award_job_baseline(uuid, text, uuid, numeric, numeric, jsonb, text) TO authenticated;
