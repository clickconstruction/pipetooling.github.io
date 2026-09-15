SET lock_timeout = '3s';

-- Submittals, stage 1 (to-dos/submittals/README.md): the plan's fixture
-- schedule becomes data. One row per (bid, tag) — the SPECIFIED make and
-- model — so the quote compare can say whether a pick is as specified, an
-- alternate, superseded, an equal, a design change, or missing; and the
-- estimator's reason and lead time ride the picked quote line.

-- ---------- 1 · the specified product per tag ----------

CREATE TABLE IF NOT EXISTS public.bid_specified_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  tag text NOT NULL,
  -- The count-row fixture name this tag maps to (snapshot text, like the RFQ store); null until matched.
  fixture text,
  manufacturer text,
  model text,
  description text,
  source text NOT NULL DEFAULT 'pasted',
  confirmed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bid_specified_products_source_check CHECK (source IN ('pasted', 'robot', 'typed')),
  CONSTRAINT bid_specified_products_bid_tag_key UNIQUE (bid_id, tag)
);

COMMENT ON TABLE public.bid_specified_products IS
  'Submittals stage 1 (v2.3460): the plan schedule''s specified make/model per fixture tag, pasted, typed, or read by a robot (unconfirmed until confirmed_at).';

CREATE INDEX IF NOT EXISTS bid_specified_products_bid_idx ON public.bid_specified_products (bid_id);

ALTER TABLE public.bid_specified_products ENABLE ROW LEVEL SECURITY;

-- Same audience as the RFQ store: the pricing-side roles, on bids they can price.
DROP POLICY IF EXISTS "Pricing sharers can read bid_specified_products" ON public.bid_specified_products;
CREATE POLICY "Pricing sharers can read bid_specified_products" ON public.bid_specified_products FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.users
     WHERE users.id = ( SELECT auth.uid() )
       AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])
  ) AND public.can_access_bid_for_pricing(bid_id));

DROP POLICY IF EXISTS "Pricing sharers can write bid_specified_products" ON public.bid_specified_products;
CREATE POLICY "Pricing sharers can write bid_specified_products" ON public.bid_specified_products FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users
     WHERE users.id = ( SELECT auth.uid() )
       AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])
  ) AND public.can_access_bid_for_pricing(bid_id))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
     WHERE users.id = ( SELECT auth.uid() )
       AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])
  ) AND public.can_access_bid_for_pricing(bid_id));

-- ---------- 2 · the pick's reason and lead time ----------

ALTER TABLE public.bid_quote_lines
  ADD COLUMN IF NOT EXISTS alternate_reason_kind text,
  ADD COLUMN IF NOT EXISTS alternate_reason_note text,
  ADD COLUMN IF NOT EXISTS lead_time_days integer,
  ADD COLUMN IF NOT EXISTS availability text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bid_quote_lines_alternate_reason_kind_check') THEN
    ALTER TABLE public.bid_quote_lines
      ADD CONSTRAINT bid_quote_lines_alternate_reason_kind_check
      CHECK (alternate_reason_kind IS NULL OR alternate_reason_kind IN ('lead_time', 'discontinued', 'in_stock', 'equal', 'cost', 'other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bid_quote_lines_availability_check') THEN
    ALTER TABLE public.bid_quote_lines
      ADD CONSTRAINT bid_quote_lines_availability_check
      CHECK (availability IS NULL OR availability IN ('in_stock', 'lead_time', 'discontinued', 'unknown'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bid_quote_lines_lead_time_days_check') THEN
    ALTER TABLE public.bid_quote_lines
      ADD CONSTRAINT bid_quote_lines_lead_time_days_check
      CHECK (lead_time_days IS NULL OR (lead_time_days >= 0 AND lead_time_days <= 730));
  END IF;
END $$;

COMMENT ON COLUMN public.bid_quote_lines.alternate_reason_kind IS
  'Submittals stage 1 (v2.3460): why the estimator picked a product that differs from the schedule — lead_time · discontinued · in_stock · equal · cost · other. Distinct from pick_reason (the robot''s why-this-house).';
COMMENT ON COLUMN public.bid_quote_lines.lead_time_days IS
  'Submittals stage 1 (v2.3460): lead time in days, typed by the estimator from the quote or the call (0 = in stock).';

-- House rules: read-only training mode + twin write fence cover the new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
