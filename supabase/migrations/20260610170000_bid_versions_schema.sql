-- Bid Versions: a bid can have multiple named variants, each owning its own takeoff
-- (materials) and an optional pricing (sell prices). A `bid_versions` row is the
-- user-facing variant; the two per-bid takeoff tables and the bid-scoped price book copy
-- become facets that reference it via `bid_version_id`.
--
-- bid_version_id IS NULL everywhere = a bid that has not been split into versions yet
-- (legacy/unversioned "current" state). No backfill: the first split materializes that
-- NULL-tagged data into a named version (see materialize_bid_version, later migration).
--
-- This generalizes the bid-scoped Pricings feature (price_book_versions.bid_id): the
-- pricing copy is now a facet of a bid_version. Labor + cost_estimates + POs stay shared
-- bid-wide (a Version varies takeoff materials + sell prices only).

CREATE TABLE IF NOT EXISTS public.bid_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  include_in_submission boolean NOT NULL DEFAULT true,
  source_bid_version_id uuid NULL REFERENCES public.bid_versions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bid_versions_bid_sort ON public.bid_versions(bid_id, sort_order);

ALTER TABLE public.bid_versions ENABLE ROW LEVEL SECURITY;

-- Mirror the bid-scoped pricing overlay tables: gate by per-bid access.
CREATE POLICY "bid_versions_select" ON public.bid_versions
  FOR SELECT USING (public.can_access_bid_for_pricing(bid_id));
CREATE POLICY "bid_versions_insert" ON public.bid_versions
  FOR INSERT WITH CHECK (public.can_access_bid_for_pricing(bid_id));
CREATE POLICY "bid_versions_update" ON public.bid_versions
  FOR UPDATE USING (public.can_access_bid_for_pricing(bid_id))
  WITH CHECK (public.can_access_bid_for_pricing(bid_id));
CREATE POLICY "bid_versions_delete" ON public.bid_versions
  FOR DELETE USING (public.can_access_bid_for_pricing(bid_id));

-- Takeoff facets gain a nullable version key (NULL = unsplit "current").
ALTER TABLE public.bids_takeoff_rough_part_lines
  ADD COLUMN IF NOT EXISTS bid_version_id uuid NULL REFERENCES public.bid_versions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_btrpl_bid_version ON public.bids_takeoff_rough_part_lines(bid_id, bid_version_id);

ALTER TABLE public.bids_takeoff_template_mappings
  ADD COLUMN IF NOT EXISTS bid_version_id uuid NULL REFERENCES public.bid_versions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_bttm_bid_version ON public.bids_takeoff_template_mappings(bid_id, bid_version_id);

-- Widen the mappings unique constraint to include the version. NULLS NOT DISTINCT (PG15+)
-- preserves the "one mapping per (count_row, template, stage)" guarantee for unsplit
-- (NULL-version) rows, while allowing each Version to map the same fixture/stage.
ALTER TABLE public.bids_takeoff_template_mappings
  DROP CONSTRAINT IF EXISTS bids_takeoff_template_mapping_count_row_id_template_id_stag_key;
ALTER TABLE public.bids_takeoff_template_mappings
  ADD CONSTRAINT bids_takeoff_template_mappings_crid_tid_stage_ver_key
  UNIQUE NULLS NOT DISTINCT (count_row_id, template_id, stage, bid_version_id);

-- Pricing facet references its owning Version (alongside the denormalized bid_id).
ALTER TABLE public.price_book_versions
  ADD COLUMN IF NOT EXISTS bid_version_id uuid NULL REFERENCES public.bid_versions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_price_book_versions_bid_version ON public.price_book_versions(bid_version_id);

-- The active Version for a bid (NULL = unsplit).
ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS selected_bid_version_id uuid NULL REFERENCES public.bid_versions(id) ON DELETE SET NULL;

COMMENT ON TABLE public.bid_versions IS
  'A named variant of a bid (e.g. "To Plans", "Value Engineered"). Owns a takeoff scenario + optional pricing facet. bid_version_id IS NULL on facet rows = the unsplit current state.';
