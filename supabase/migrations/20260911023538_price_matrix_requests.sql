SET lock_timeout = '3s';

-- Robot price matrix, PR 1 of 5 (docs/PRICE_MATRIX_PLAN.md).
--
-- A pricing twin reads a bid's supply-house fixture quotes (PDFs behind the
-- Drive links on the bid's Price-requests table) and writes them onto the
-- EXISTING quote store as structured kits: one `kit` line carrying the
-- fixture's $/each subtotal, component lines that carry a role (bowl · seat ·
-- flush valve · carrier …) and usually no price of their own, separately
-- priced components (the carrier from the second sheet), and option groups
-- (six RPZ sizes — pick one, never sum). Wendi queues the job, the twin claims
-- it, and her corrections become the twin's rulebook.
--
-- Additive only. The old client ignores every new column; the compare kernel
-- treats a quote with no roles exactly as before. Push after the v2.NNNN
-- client deploys; the twin-mcp verbs that write these rows ship in PR 3.

-- ---------------------------------------------------------------------------
-- 1. bid_quote_lines — roles, option groups, provenance, the robot's reason
-- ---------------------------------------------------------------------------
ALTER TABLE public.bid_quote_lines
  ADD COLUMN IF NOT EXISTS component_role text,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS option_group text,
  ADD COLUMN IF NOT EXISTS option_label text,
  ADD COLUMN IF NOT EXISTS option_chosen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS page_ref text,
  ADD COLUMN IF NOT EXISTS pick_reason text,
  ADD COLUMN IF NOT EXISTS pick_source text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bid_quote_lines_component_role_check') THEN
    ALTER TABLE public.bid_quote_lines
      ADD CONSTRAINT bid_quote_lines_component_role_check CHECK (
        component_role IS NULL OR component_role IN (
          'kit', 'bowl', 'seat', 'flush_valve', 'carrier', 'faucet', 'drain', 'trap',
          'supply', 'stops', 'trim', 'mixing_valve', 'accessory', 'freight', 'loose'
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bid_quote_lines_pick_source_check') THEN
    ALTER TABLE public.bid_quote_lines
      ADD CONSTRAINT bid_quote_lines_pick_source_check CHECK (pick_source IS NULL OR pick_source IN ('human', 'robot'));
  END IF;
END $$;

COMMENT ON COLUMN public.bid_quote_lines.component_role IS
  'Price matrix PR 1 — the part this line plays in its fixture''s kit. `kit` = the vendor''s per-fixture subtotal line (the $/each); other roles are components (usually unpriced when a kit line exists); `loose` = belongs to no fixture. Mirrors COMPONENT_ROLES in src/lib/rfq/quoteKits.ts.';
COMMENT ON COLUMN public.bid_quote_lines.label IS
  'Price matrix PR 1 — the vendor''s description of the part ("Josam 12704 vertical WC carrier, no side inlets").';
COMMENT ON COLUMN public.bid_quote_lines.option_group IS
  'Price matrix PR 1 — alternatives share a group ("size"); exactly one should end up option_chosen. A group is never summed — the compare shows the range until a choice is made.';
COMMENT ON COLUMN public.bid_quote_lines.page_ref IS
  'Price matrix PR 1 — where in the quote this line came from ("p. 3", "carrier sheet").';
COMMENT ON COLUMN public.bid_quote_lines.pick_reason IS
  'Price matrix PR 1 — why this line is picked, in plain words ("cheapest complete kit"; "only house with the carrier"). Written by the robot; humans may overwrite.';
COMMENT ON COLUMN public.bid_quote_lines.pick_source IS
  'Price matrix PR 1 — human | robot. Who made the current pick; the Scoreboard compares the two.';

-- ---------------------------------------------------------------------------
-- 2. bid_quotes — the robot as a source, and what it read
-- ---------------------------------------------------------------------------
ALTER TABLE public.bid_quotes
  ADD COLUMN IF NOT EXISTS source_doc_url text,
  ADD COLUMN IF NOT EXISTS robot_request_id uuid;

ALTER TABLE public.bid_quotes DROP CONSTRAINT IF EXISTS bid_quotes_source_check;
ALTER TABLE public.bid_quotes
  ADD CONSTRAINT bid_quotes_source_check CHECK (source = ANY (ARRAY['link'::text, 'pasted'::text, 'typed'::text, 'robot'::text]));

COMMENT ON COLUMN public.bid_quotes.source_doc_url IS
  'Price matrix PR 1 — the file the robot read for this quote (a Drive link from the bid''s Price-requests table). Null for human-entered quotes.';
COMMENT ON COLUMN public.bid_quotes.robot_request_id IS
  'Price matrix PR 1 — the bid_price_matrix_requests row this robot quote was written for.';

-- ---------------------------------------------------------------------------
-- 3. The request queue — one row per "price it with the robot"
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bid_price_matrix_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  bid_version_id uuid,
  requested_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  -- [{count_row_id, fixture, count, unit}] — the fixture rows at queue time; the robot prices these, never the live bid.
  scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{rfq_id, supply_house_id, house_name, url}] — the folder/file links from the Price-requests table the robot may read.
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'working', 'ready', 'blocked', 'cancelled', 'done')),
  claimed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  heartbeat_at timestamptz,
  finished_at timestamptz,
  reviewed_at timestamptz,
  summary text,
  -- {houses_read, pages_read, rows_priced, rows_asked, total_cents_at_counts, expired_houses:[...]} — the robot's report, for the card and the Scoreboard.
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bid_price_matrix_requests_bid_idx ON public.bid_price_matrix_requests (bid_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS bid_price_matrix_requests_queue_idx ON public.bid_price_matrix_requests (status, requested_at) WHERE status IN ('queued', 'working');

COMMENT ON TABLE public.bid_price_matrix_requests IS
  'Price matrix PR 1 — Wendi''s "price it with the robot" asks. The pricing twin claims queued → working (next_price_matrix), writes robot quotes onto bid_quotes/bid_quote_lines, then flips ready (finish_price_matrix). blocked = it could not read a source; cancelled = taken back before the robot started writing; done = the estimator reviewed it.';

-- ---------------------------------------------------------------------------
-- 4. The rulebook and the teaching
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fixture_component_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The rule in plain words — the robot reads these verbatim before it structures a quote.
  rule text NOT NULL,
  kind text NOT NULL DEFAULT 'placement'
    CHECK (kind IN ('placement', 'sheet', 'option_default', 'required_role')),
  -- Optional structured hints: which fixtures it applies to (a case-insensitive pattern on the row name) and which role it concerns.
  fixture_pattern text,
  role text,
  active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'human' CHECK (source IN ('human', 'robot')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  source_bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  mirror_note text,
  times_used integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fixture_component_rules_active_idx ON public.fixture_component_rules (active, kind);

COMMENT ON TABLE public.fixture_component_rules IS
  'Price matrix PR 1 — the pricing twin''s rulebook: what belongs to what ("an untagged lav carrier goes with the wall-hung lavatory that still needs one"), where to look ("SEE THE CARRIER AND DRAIN QUOTE" = the second sheet, same tag), defaults for plan-decided options, and roles a fixture kind must price. Humans add rules from the compare grid (remember this); the robot adds them with a mirror_note, the way it extends its book.';

CREATE TABLE IF NOT EXISTS public.fixture_component_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.bid_price_matrix_requests(id) ON DELETE SET NULL,
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  quote_line_id uuid REFERENCES public.bid_quote_lines(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('move', 'unpick', 'repick', 'not_a_component', 'choose_option')),
  from_fixture text,
  to_fixture text,
  from_role text,
  to_role text,
  remember boolean NOT NULL DEFAULT false,
  rule_text text,
  rule_id uuid REFERENCES public.fixture_component_rules(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  digested_at timestamptz
);
CREATE INDEX IF NOT EXISTS fixture_component_corrections_undigested_idx ON public.fixture_component_corrections (created_at) WHERE digested_at IS NULL;

COMMENT ON TABLE public.fixture_component_corrections IS
  'Price matrix PR 1 — every time the estimator moves a line to another fixture, unpicks or repicks, marks a line as no fixture''s part, or chooses an option in the compare grid. The pricing twin digests these next session (digested_at) and answers with a receipt; remember = true also minted a rule (rule_id).';

-- ---------------------------------------------------------------------------
-- 5. Twin kind — a pricer is refused every bid verb
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS twin_kind text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_twin_kind_check') THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_twin_kind_check CHECK (twin_kind IS NULL OR twin_kind IN ('estimator', 'pricer'));
  END IF;
END $$;

COMMENT ON COLUMN public.users.twin_kind IS
  'Price matrix PR 1 — for digital twins only. estimator (the bid robots; null reads as estimator) | pricer (reads supply-house quotes, writes robot quotes; twin-mcp refuses it every bid verb, and the bid dispatchers never hand it a shell).';

-- ---------------------------------------------------------------------------
-- 6. RLS — the same five roles that own the quote store
-- ---------------------------------------------------------------------------
ALTER TABLE public.bid_price_matrix_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixture_component_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixture_component_corrections ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bid_price_matrix_requests', 'fixture_component_rules', 'fixture_component_corrections'] LOOP
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

GRANT ALL ON public.bid_price_matrix_requests TO service_role;
GRANT ALL ON public.fixture_component_rules TO service_role;
GRANT ALL ON public.fixture_component_corrections TO service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
