-- Bid-scoped "Pricings": let a single bid hold multiple frozen-snapshot copies of a
-- price book (e.g. "Plans" vs "Value Engineered"), priced over the same counts.
--
-- A price_book_versions row with bid_id IS NULL is a shared master TEMPLATE (today's
-- behavior, unchanged). A row with bid_id set is a bid-owned PRICING: an independent
-- copy of a template's entries that the user can value-engineer without touching the
-- master. The existing per-bid overlay tables (bid_pricing_assignments,
-- bid_count_row_custom_prices, bid_count_row_submission_hides) already key on
-- price_book_version_id, so each Pricing's overrides self-isolate with no schema change.
--
-- RLS: price_book_versions uses role-based policies (not per-bid), so adding bid_id
-- needs no policy changes. The clone RPC is SECURITY INVOKER and relies on existing RLS.

ALTER TABLE public.price_book_versions
  ADD COLUMN IF NOT EXISTS bid_id uuid NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_version_id uuid NULL REFERENCES public.price_book_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS include_in_submission boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_price_book_versions_bid_id   ON public.price_book_versions(bid_id);
CREATE INDEX IF NOT EXISTS idx_price_book_versions_bid_sort ON public.price_book_versions(bid_id, sort_order);

COMMENT ON COLUMN public.price_book_versions.bid_id IS
  'NULL = shared master template (service-type catalog). Non-NULL = a bid-owned Pricing (frozen copy).';
COMMENT ON COLUMN public.price_book_versions.source_version_id IS
  'Provenance: the template/Pricing this copy was cloned from. SET NULL if the source is deleted.';
COMMENT ON COLUMN public.price_book_versions.include_in_submission IS
  'Bid Pricings only: whether this Pricing is rendered in the bundled cover-letter submission.';
COMMENT ON COLUMN public.price_book_versions.sort_order IS
  'Bid Pricings only: order within a bid (picker + submission bundle).';

-- Clone a price book version into a bid as a new frozen Pricing.
--   * Copies all price_book_entries (the freeze).
--   * Carries over any existing overlays for (p_bid_id, p_source_version_id):
--       - custom prices / submission hides: straight copy (they reference count rows only).
--       - assignments: copied with price_book_entry_id REMAPPED from the source entry to its
--         freshly-created copy, so assignments resolve to the new version's entries.
-- Covers "from template" (no overlays exist), "duplicate a Pricing", and "convert a legacy
-- bid" (its current global selection's overlays carry over) in one call.
-- SECURITY INVOKER (matches log_bid_pricing_package_send): authorization is enforced by the
-- existing role-based RLS on price_book_versions/entries and can_access_bid_for_pricing() on
-- the overlay tables.
CREATE OR REPLACE FUNCTION public.clone_price_book_version_to_bid(
  p_source_version_id uuid,
  p_bid_id uuid,
  p_name text
) RETURNS uuid
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_new_id uuid;
  v_entry_map jsonb := '{}'::jsonb;
  r record;
  v_new_entry_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_source_version_id IS NULL OR p_bid_id IS NULL THEN
    RAISE EXCEPTION 'clone_price_book_version_to_bid: source version and bid are required';
  END IF;

  -- 1. New bid-scoped Pricing, inheriting the source's service type, appended after existing Pricings.
  INSERT INTO public.price_book_versions
    (name, service_type_id, bid_id, source_version_id, include_in_submission, sort_order)
  SELECT p_name, src.service_type_id, p_bid_id, p_source_version_id, true,
         COALESCE((SELECT max(sort_order) FROM public.price_book_versions WHERE bid_id = p_bid_id), -1) + 1
  FROM public.price_book_versions src
  WHERE src.id = p_source_version_id
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    RAISE EXCEPTION 'clone_price_book_version_to_bid: source version % not found', p_source_version_id;
  END IF;

  -- 2. Freeze: copy entries, recording old entry id -> new entry id.
  FOR r IN
    SELECT * FROM public.price_book_entries WHERE version_id = p_source_version_id
  LOOP
    INSERT INTO public.price_book_entries
      (version_id, fixture_type_id, rough_in_price, top_out_price, trim_set_price, total_price, sequence_order)
    VALUES
      (v_new_id, r.fixture_type_id, r.rough_in_price, r.top_out_price, r.trim_set_price, r.total_price, r.sequence_order)
    RETURNING id INTO v_new_entry_id;
    v_entry_map := v_entry_map || jsonb_build_object(r.id::text, v_new_entry_id::text);
  END LOOP;

  -- 3. Carry over existing per-bid overlays for (bid, source version). No-op for a fresh template.
  INSERT INTO public.bid_count_row_custom_prices (bid_id, count_row_id, price_book_version_id, unit_price)
  SELECT bid_id, count_row_id, v_new_id, unit_price
  FROM public.bid_count_row_custom_prices
  WHERE bid_id = p_bid_id AND price_book_version_id = p_source_version_id;

  INSERT INTO public.bid_count_row_submission_hides (bid_id, count_row_id, price_book_version_id)
  SELECT bid_id, count_row_id, v_new_id
  FROM public.bid_count_row_submission_hides
  WHERE bid_id = p_bid_id AND price_book_version_id = p_source_version_id;

  INSERT INTO public.bid_pricing_assignments
    (bid_id, count_row_id, price_book_entry_id, price_book_version_id, is_fixed_price, unit_price_override)
  SELECT bid_id, count_row_id, (v_entry_map->>price_book_entry_id::text)::uuid, v_new_id, is_fixed_price, unit_price_override
  FROM public.bid_pricing_assignments
  WHERE bid_id = p_bid_id
    AND price_book_version_id = p_source_version_id
    AND v_entry_map ? price_book_entry_id::text;

  RETURN v_new_id;
END;
$$;

ALTER FUNCTION public.clone_price_book_version_to_bid(uuid, uuid, text) OWNER TO postgres;

COMMENT ON FUNCTION public.clone_price_book_version_to_bid(uuid, uuid, text) IS
  'Clone a price book version into a bid as a new frozen Pricing (copies entries + remapped overlays). SECURITY INVOKER — gated by existing RLS.';

GRANT ALL ON FUNCTION public.clone_price_book_version_to_bid(uuid, uuid, text) TO anon;
GRANT ALL ON FUNCTION public.clone_price_book_version_to_bid(uuid, uuid, text) TO authenticated;
GRANT ALL ON FUNCTION public.clone_price_book_version_to_bid(uuid, uuid, text) TO service_role;
