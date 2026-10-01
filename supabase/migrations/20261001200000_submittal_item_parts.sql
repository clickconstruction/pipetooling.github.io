SET lock_timeout = '3s';

-- Submittals · the parts of a row (Wendi: "need to show parts not just assemblies"). A submittal
-- row is one fixture tag; its parts are what is bought and what the GC reviews: the bowl, the flush
-- valve, the seat and the carrier, each from its own house, with its own lead time, stage, cut sheet
-- pages and the reviewer's call. A part the GC does not see (trim: stops, supplies, traps) is still
-- bought — `on_submittal` false, "order only". The row keeps its own columns as the roll-up every
-- older reader uses (submitted_label = the parts on the submittal joined with " + ").
-- `procure_key` follows a part from revision to revision so the procurement log's line for it holds.
-- Additive: a row with no parts reads exactly as before.

CREATE TABLE IF NOT EXISTS public.bid_submittal_item_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.bid_submittal_items(id) ON DELETE CASCADE,
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  sequence_order integer NOT NULL DEFAULT 0,
  -- The catalog line as the takeoff or the house's file names it.
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 300),
  manufacturer text NULL CHECK (manufacturer IS NULL OR length(manufacturer) <= 80),
  model text NULL CHECK (model IS NULL OR length(model) <= 120),
  description text NULL CHECK (description IS NULL OR length(description) <= 300),
  -- How many go on one fixture (the takeoff line's quantity × the assembly's).
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity >= 0 AND quantity <= 100000),
  -- The GC reviews it (true) or it is only ordered (false: trim, a part the plans leave to us).
  on_submittal boolean NOT NULL DEFAULT true,
  -- Where it came from: the takeoff, the house's submittal file, typed by hand.
  source text NOT NULL DEFAULT 'takeoff' CHECK (source IN ('takeoff', 'file', 'hand')),
  part_id uuid NULL REFERENCES public.material_parts(id) ON DELETE SET NULL,
  -- The takeoff line (and the assembly item inside it) the part was read from. No FK: lines are rewritten.
  source_line_id uuid NULL,
  source_template_item_id uuid NULL,
  -- The price-book assembly the takeoff priced it inside, by name ("LAV 1 assembly SPACEX").
  assembly text NULL CHECK (assembly IS NULL OR length(assembly) <= 200),
  -- What the takeoff priced in this part's place, when the house's file submits another product.
  priced_label text NULL CHECK (priced_label IS NULL OR length(priced_label) <= 300),
  reason_note text NULL CHECK (reason_note IS NULL OR length(reason_note) <= 500),
  supply_house_id uuid NULL REFERENCES public.supply_houses(id) ON DELETE SET NULL,
  lead_time_days integer NULL CHECK (lead_time_days IS NULL OR (lead_time_days >= 0 AND lead_time_days <= 730)),
  -- When the part is needed on the job; NULL = the fixture's stage.
  stage text NULL CHECK (stage IS NULL OR stage IN ('rough_in', 'top_out', 'trim_set')),
  sheet_file integer NULL CHECK (sheet_file IS NULL OR sheet_file >= 0),
  sheet_pages integer[] NOT NULL DEFAULT '{}',
  -- The reviewer's call on this part (the row carries the roll-up).
  review_decision text NULL CHECK (review_decision IS NULL OR review_decision IN ('approved', 'revise', 'rejected')),
  review_note text NULL,
  reviewed_at timestamptz NULL,
  reviewed_by_name text NULL,
  reviewed_by_email text NULL,
  reviewed_by_person_id uuid NULL REFERENCES public.bid_submittal_people(id) ON DELETE SET NULL,
  decision_source text NOT NULL DEFAULT 'room' CHECK (decision_source IN ('room', 'entered', 'robot', 'carried')),
  decision_entered_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  decision_entered_by_name text NULL,
  -- Follows the part across revisions: the procurement log's line for it.
  procure_key uuid NOT NULL DEFAULT gen_random_uuid(),
  carried_from_part_id uuid NULL REFERENCES public.bid_submittal_item_parts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bid_submittal_item_parts IS
  'Submittals: the parts of a submittal row — each bought on its own (house, lead time, stage, quantity per fixture), each with its cut sheet pages and the reviewer''s call; on_submittal false = order only. The row''s own columns are the roll-up.';

CREATE INDEX IF NOT EXISTS bid_submittal_item_parts_item_idx ON public.bid_submittal_item_parts (item_id, sequence_order);
CREATE INDEX IF NOT EXISTS bid_submittal_item_parts_bid_idx ON public.bid_submittal_item_parts (bid_id);
CREATE INDEX IF NOT EXISTS bid_submittal_item_parts_procure_idx ON public.bid_submittal_item_parts (bid_id, procure_key);

ALTER TABLE public.bid_submittal_item_parts ENABLE ROW LEVEL SECURITY;

-- The bid a row belongs to, so a part's own bid_id can be held to it.
CREATE OR REPLACE FUNCTION public.submittal_item_bid(p_item_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.bid_id FROM public.bid_submittal_items i JOIN public.bid_submittals s ON s.id = i.submittal_id WHERE i.id = p_item_id;
$$;
REVOKE ALL ON FUNCTION public.submittal_item_bid(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submittal_item_bid(uuid) TO authenticated;

-- The same people as the rows, on bids they can price; a part is written only onto a row of its own bid.
DROP POLICY IF EXISTS "Pricing sharers can read bid_submittal_item_parts" ON public.bid_submittal_item_parts;
CREATE POLICY "Pricing sharers can read bid_submittal_item_parts" ON public.bid_submittal_item_parts FOR SELECT
  USING (public.is_pricing_sharer() AND public.can_access_bid_for_pricing(bid_id));
DROP POLICY IF EXISTS "Pricing sharers can write bid_submittal_item_parts" ON public.bid_submittal_item_parts;
CREATE POLICY "Pricing sharers can write bid_submittal_item_parts" ON public.bid_submittal_item_parts FOR ALL
  USING (public.is_pricing_sharer() AND public.can_access_bid_for_pricing(bid_id))
  WITH CHECK (public.is_pricing_sharer() AND public.can_access_bid_for_pricing(bid_id) AND bid_id = public.submittal_item_bid(item_id));

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
