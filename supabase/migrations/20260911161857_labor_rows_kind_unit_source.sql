SET lock_timeout = '3s';

-- Bids → Labor refresh, PR 2 (v2.3289): the data the New view was pretending.
--
--   1. labor_book_entries.unit  ('each' | 'per_100ft')  — footage rows carry labor per 100 ft.
--      labor_book_entries.kind  ('fixture' | 'task')    — a task is fixed hours, not × count.
--   2. cost_estimate_labor_rows.kind   ('fixture' | 'task' | 'sub')
--      cost_estimate_labor_rows.unit   ('each' | 'per_100ft')
--      cost_estimate_labor_rows.source ('book' | 'alias' | 'typed' | 'robot', NULL = legacy/unknown)
--      cost_estimate_labor_rows.source_note — free text ("Toilet · Robot Default", "learned on B375").
--      Existing is_fixed rows become kind = 'task'; is_fixed stays (Old reads it).
--   3. app_settings 'labor_burden_factor_v1' — the multiplier on the recorded field wage
--      (1.20 until someone sets it; the crew-rate card reads it in PR 4).
--   4. VIEW cost_estimate_direct_costs — the five direct-cost tables as one list with a
--      kind column. The tables stay; readers get one shape. security_invoker, so the
--      caller's RLS on each table still applies.
--
-- Additive and idempotent. Deploy the client first (the old client ignores the columns).

ALTER TABLE public.labor_book_entries ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'each';
ALTER TABLE public.labor_book_entries ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'fixture';
ALTER TABLE public.labor_book_entries DROP CONSTRAINT IF EXISTS labor_book_entries_unit_check;
ALTER TABLE public.labor_book_entries ADD CONSTRAINT labor_book_entries_unit_check CHECK (unit IN ('each', 'per_100ft'));
ALTER TABLE public.labor_book_entries DROP CONSTRAINT IF EXISTS labor_book_entries_kind_check;
ALTER TABLE public.labor_book_entries ADD CONSTRAINT labor_book_entries_kind_check CHECK (kind IN ('fixture', 'task'));
COMMENT ON COLUMN public.labor_book_entries.unit IS 'each: hours × count. per_100ft: hours × count ÷ 100 (footage rows).';
COMMENT ON COLUMN public.labor_book_entries.kind IS 'fixture: hours per unit. task: fixed hours for the line (not × count).';

ALTER TABLE public.cost_estimate_labor_rows ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'fixture';
ALTER TABLE public.cost_estimate_labor_rows ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'each';
ALTER TABLE public.cost_estimate_labor_rows ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.cost_estimate_labor_rows ADD COLUMN IF NOT EXISTS source_note text;
ALTER TABLE public.cost_estimate_labor_rows DROP CONSTRAINT IF EXISTS cost_estimate_labor_rows_kind_check;
ALTER TABLE public.cost_estimate_labor_rows ADD CONSTRAINT cost_estimate_labor_rows_kind_check CHECK (kind IN ('fixture', 'task', 'sub'));
ALTER TABLE public.cost_estimate_labor_rows DROP CONSTRAINT IF EXISTS cost_estimate_labor_rows_unit_check;
ALTER TABLE public.cost_estimate_labor_rows ADD CONSTRAINT cost_estimate_labor_rows_unit_check CHECK (unit IN ('each', 'per_100ft'));
ALTER TABLE public.cost_estimate_labor_rows DROP CONSTRAINT IF EXISTS cost_estimate_labor_rows_source_check;
ALTER TABLE public.cost_estimate_labor_rows ADD CONSTRAINT cost_estimate_labor_rows_source_check CHECK (source IS NULL OR source IN ('book', 'alias', 'typed', 'robot'));
COMMENT ON COLUMN public.cost_estimate_labor_rows.kind IS 'fixture: count × hours per unit. task: fixed hours (is_fixed mirrors it). sub: a subcontractor line — no field hours of ours; priced under direct costs.';
COMMENT ON COLUMN public.cost_estimate_labor_rows.unit IS 'each, or per_100ft for footage rows (hours × count ÷ 100).';
COMMENT ON COLUMN public.cost_estimate_labor_rows.source IS 'Where the hours came from: book (matched by name), alias (matched by alias or code), typed (a person), robot. NULL = written before v2.3289.';
COMMENT ON COLUMN public.cost_estimate_labor_rows.source_note IS 'Free text beside source: the entry and book, or what was learned and where.';

UPDATE public.cost_estimate_labor_rows SET kind = 'task' WHERE is_fixed AND kind = 'fixture';

INSERT INTO public.app_settings (key, value_num)
VALUES ('labor_burden_factor_v1', 1.20)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE VIEW public.cost_estimate_direct_costs
WITH (security_invoker = true)
AS
SELECT 'equipment'::text AS kind, id, cost_estimate_id, note, rough_in, top_out, trim_set, sequence_order, created_at, updated_at FROM public.cost_estimate_equipment_rows
UNION ALL
SELECT 'permit'::text,    id, cost_estimate_id, note, rough_in, top_out, trim_set, sequence_order, created_at, updated_at FROM public.cost_estimate_permit_rows
UNION ALL
SELECT 'sub'::text,       id, cost_estimate_id, note, rough_in, top_out, trim_set, sequence_order, created_at, updated_at FROM public.cost_estimate_subcontractor_rows
UNION ALL
SELECT 'waste'::text,     id, cost_estimate_id, note, rough_in, top_out, trim_set, sequence_order, created_at, updated_at FROM public.cost_estimate_waste_rows
UNION ALL
SELECT 'other'::text,     id, cost_estimate_id, note, rough_in, top_out, trim_set, sequence_order, created_at, updated_at FROM public.cost_estimate_other_rows;

COMMENT ON VIEW public.cost_estimate_direct_costs IS
  'The five direct-cost tables of a cost estimate (equipment, permit, sub, waste, other) as one list with a kind column (v2.3289). Read-only; write the underlying table. security_invoker — the caller''s RLS applies.';

GRANT SELECT ON public.cost_estimate_direct_costs TO authenticated;
