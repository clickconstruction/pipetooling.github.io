SET lock_timeout = '3s';

-- RFQ Round 2, Rung G (v2.2655 — owner approved option (a) 2026-09-02;
-- docs/APPLY_PICKS_TO_COSTS_DECISION.md + canvas artboard 10).
--
-- Two pieces:
-- 1. Lot capture on quote lines: vendors' best prices are often package
--    prices — lines sharing a lot_id carry ONE lot_total_cents and no
--    per-line unit price. Compare treats lots atomically; apply
--    allocates the total (proportional to takeoff materials, editable).
-- 2. bid_count_row_custom_costs — the cost-side sibling of the
--    sale-side bid_count_row_custom_prices. BUILD CORRECTION to the
--    decision doc: the workbench row cost blends labor + materials
--    (lineCostForRow), so this overrides the row's MATERIALS component
--    only (unit_materials_cents × live count, pre-tax; the takeoff tax
--    branch applies on top). Labor is never touched by a vendor quote.
--    Provenance is a row tag ("cost from Ferguson · 9/2"); revert
--    deletes the row — lot groups revert together via lot_group_id.

ALTER TABLE public.bid_quote_lines
  ADD COLUMN IF NOT EXISTS lot_id uuid,
  ADD COLUMN IF NOT EXISTS lot_total_cents integer;

CREATE INDEX IF NOT EXISTS bid_quote_lines_lot_idx
  ON public.bid_quote_lines (lot_id) WHERE lot_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.bid_count_row_custom_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  count_row_id uuid NOT NULL,
  unit_materials_cents integer NOT NULL CHECK (unit_materials_cents >= 0),
  source text NOT NULL DEFAULT 'quoted' CHECK (source = ANY (ARRAY['quoted'::text])),
  quote_line_id uuid REFERENCES public.bid_quote_lines(id) ON DELETE SET NULL,
  lot_group_id uuid,
  house_name text,
  applied_by uuid REFERENCES public.users(id),
  applied_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bid_id, count_row_id)
);

CREATE INDEX IF NOT EXISTS bid_count_row_custom_costs_bid_idx
  ON public.bid_count_row_custom_costs (bid_id);

ALTER TABLE public.bid_count_row_custom_costs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE verb text;
BEGIN
  FOREACH verb IN ARRAY ARRAY['select', 'insert', 'update', 'delete'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS bid_count_row_custom_costs_%s ON public.bid_count_row_custom_costs', verb);
    EXECUTE format(
      $p$CREATE POLICY bid_count_row_custom_costs_%s ON public.bid_count_row_custom_costs FOR %s %s (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = ( SELECT auth.uid() )
            AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])
        )
      )$p$,
      verb, upper(verb), CASE WHEN verb = 'insert' THEN 'WITH CHECK' ELSE 'USING' END
    );
  END LOOP;
END $$;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
