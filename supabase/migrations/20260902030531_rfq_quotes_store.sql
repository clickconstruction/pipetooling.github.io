SET lock_timeout = '3s';

-- Supply House RFQ store, Phase 1a (v2.2629; docs/SUPPLY_HOUSE_RFQ_PLAN.md).
-- Four tables. Design commitments from the 2026-09-01 deep review:
--   * unit prices only — totals recompute against CURRENT quantities; the
--     RFQ keeps a scope SNAPSHOT so compare can show quantity drift;
--   * quote lines key on fixture-name strings (the D22 ledger philosophy);
--     the durable output is supply_house_fixture_prices ("last quoted"),
--     NOT writes into cost math or material_part_prices;
--   * provenance: raw_paste kept verbatim, per-line source + confidence;
--   * price_basis (each/ft/per_100/box+basis_qty) because vendors quote
--     "$368/box of 50" — unit_price_each_cents is always the derived truth.
-- Cost-side data: read AND write restricted to the ledger-writer roles
-- (dev/master/assistant/controller/estimator) — subs/primary never see
-- vendor costs. Token column ships now, used by the Phase 2 link lane.

CREATE TABLE IF NOT EXISTS public.bid_rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  bid_version_id uuid,
  supply_house_id uuid REFERENCES public.supply_houses(id),
  sent_to text,
  scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  needed_by date,
  token text UNIQUE,
  status text NOT NULL DEFAULT 'sent' CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'quoted'::text, 'closed'::text])),
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bid_rfqs_bid_idx ON public.bid_rfqs (bid_id, created_at);

CREATE TABLE IF NOT EXISTS public.bid_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid REFERENCES public.bid_rfqs(id) ON DELETE SET NULL,
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  bid_version_id uuid,
  supply_house_id uuid REFERENCES public.supply_houses(id),
  quoted_by text,
  source text NOT NULL DEFAULT 'typed' CHECK (source = ANY (ARRAY['link'::text, 'pasted'::text, 'typed'::text])),
  received_at timestamptz NOT NULL DEFAULT now(),
  valid_until date,
  freight_cents integer,
  adders_note text,
  raw_paste text,
  note text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bid_quotes_bid_idx ON public.bid_quotes (bid_id, received_at);

CREATE TABLE IF NOT EXISTS public.bid_quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.bid_quotes(id) ON DELETE CASCADE,
  fixture text NOT NULL,
  unit_price_each_cents integer,
  price_basis text NOT NULL DEFAULT 'each' CHECK (price_basis = ANY (ARRAY['each'::text, 'ft'::text, 'per_100'::text, 'box'::text])),
  basis_qty numeric,
  basis_price_cents integer,
  cant_supply boolean NOT NULL DEFAULT false,
  alternate_note text,
  match_confidence text NOT NULL DEFAULT 'manual' CHECK (match_confidence = ANY (ARRAY['exact'::text, 'fuzzy'::text, 'manual'::text])),
  matched_from text,
  picked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bid_quote_lines_quote_idx ON public.bid_quote_lines (quote_id);

CREATE TABLE IF NOT EXISTS public.supply_house_fixture_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_house_id uuid NOT NULL REFERENCES public.supply_houses(id) ON DELETE CASCADE,
  fixture text NOT NULL,
  fixture_key text GENERATED ALWAYS AS (lower(btrim(fixture))) STORED,
  unit_price_each_cents integer NOT NULL,
  quoted_at timestamptz NOT NULL DEFAULT now(),
  source_bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  UNIQUE (supply_house_id, fixture_key)
);

ALTER TABLE public.bid_rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_house_fixture_prices ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bid_rfqs', 'bid_quotes', 'bid_quote_lines', 'supply_house_fixture_prices'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Pricing sharers can read %1$s" ON public.%1$I', t);
    EXECUTE format($p$CREATE POLICY "Pricing sharers can read %1$s" ON public.%1$I FOR SELECT
      USING (EXISTS ( SELECT 1 FROM public.users
        WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])))$p$, t);
    EXECUTE format('DROP POLICY IF EXISTS "Pricing sharers can write %1$s" ON public.%1$I', t);
    EXECUTE format($p$CREATE POLICY "Pricing sharers can write %1$s" ON public.%1$I FOR ALL
      USING (EXISTS ( SELECT 1 FROM public.users
        WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])))
      WITH CHECK (EXISTS ( SELECT 1 FROM public.users
        WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])))$p$, t);
  END LOOP;
END $$;

-- House rules: read-only training mode + twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
