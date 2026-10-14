SET lock_timeout = '3s';

-- Combine two CountTooling counts on one bid (v2.5517, PR 1 of 3; the owner's 2026-10-13 ask): two people count parts of
-- one plan in separate CountTooling projects and combine them on one bid. Until now a bid held one CountTooling link
-- (bids.count_tooling_plans_link, overwritten by every import) and a count row did not know where its count came from,
-- so a second counter's copy read as a re-copy: the review proposed replacing the matching counts and removing the
-- other counter's rows. Two additions:
--   1) bid_count_sources: one row per CountTooling project on the bid — the link, its project token (the `t=<uuid>` of
--      the link), the project's name from the copy's heading, the copy's scope, who imported it and when. The first by
--      first_imported_at stays mirrored on bids.count_tooling_plans_link, which every downstream reader keeps using.
--   2) bids_count_rows.source_shares: each project's share of the row's count, {"<source id>": <count>}; NULL means the
--      row has no project (typed by hand, or imported before this and not yet adopted). A row both people counted holds
--      two shares, so a later re-copy of either project moves only its own share.
-- A new table, so the three house calls end it. See docs/migrations/20261014210000_bid_count_sources.md.

-- 1) The projects on a bid.
CREATE TABLE IF NOT EXISTS public.bid_count_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  -- The CountTooling view link as the copy's footer carried it (or as a person pasted it on Edit Bid).
  link text NOT NULL
    CONSTRAINT bid_count_sources_link_shape CHECK (link ~ '^https?://' AND length(link) <= 2000),
  -- The project's own token, the `t=<uuid>` of the link; null for a link typed by hand without one.
  token text
    CONSTRAINT bid_count_sources_token_shape CHECK (token IS NULL OR token ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'),
  -- From the copy's heading `--- Counts, <project> · every sheet · every layer ---`; null for a hand-added link.
  project_name text
    CONSTRAINT bid_count_sources_name_length CHECK (project_name IS NULL OR length(project_name) <= 300),
  -- What the last copy covered: every sheet (all), a part (partial), or no heading (unknown).
  scope text NOT NULL DEFAULT 'unknown'
    CONSTRAINT bid_count_sources_scope_known CHECK (scope IN ('all', 'partial', 'unknown')),
  imported_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  first_imported_at timestamptz NOT NULL DEFAULT now(),
  last_imported_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bid_count_sources_last_after_first CHECK (last_imported_at >= first_imported_at)
);

COMMENT ON TABLE public.bid_count_sources IS
  'Combine two CountTooling counts (v2.5517): one row per CountTooling project on a bid — the view link, its project token (the t=<uuid> of the link), the project''s name from the copy''s heading, the last copy''s scope, who imported it and when. The first by first_imported_at is mirrored on bids.count_tooling_plans_link. Each count row''s share per project lives in bids_count_rows.source_shares, keyed by this id. Read and written by the people who can price the bid (can_access_bid_for_pricing).';

CREATE UNIQUE INDEX IF NOT EXISTS bid_count_sources_bid_token ON public.bid_count_sources (bid_id, token) WHERE token IS NOT NULL;
CREATE INDEX IF NOT EXISTS bid_count_sources_bid ON public.bid_count_sources (bid_id, first_imported_at);

ALTER TABLE public.bid_count_sources ENABLE ROW LEVEL SECURITY;
-- Mirror bid_versions and the pricing overlay tables: gate by per-bid access.
DROP POLICY IF EXISTS bid_count_sources_select ON public.bid_count_sources;
CREATE POLICY bid_count_sources_select ON public.bid_count_sources
  FOR SELECT TO authenticated USING (public.can_access_bid_for_pricing(bid_id));
DROP POLICY IF EXISTS bid_count_sources_insert ON public.bid_count_sources;
CREATE POLICY bid_count_sources_insert ON public.bid_count_sources
  FOR INSERT TO authenticated WITH CHECK (public.can_access_bid_for_pricing(bid_id));
DROP POLICY IF EXISTS bid_count_sources_update ON public.bid_count_sources;
CREATE POLICY bid_count_sources_update ON public.bid_count_sources
  FOR UPDATE TO authenticated USING (public.can_access_bid_for_pricing(bid_id)) WITH CHECK (public.can_access_bid_for_pricing(bid_id));
DROP POLICY IF EXISTS bid_count_sources_delete ON public.bid_count_sources;
CREATE POLICY bid_count_sources_delete ON public.bid_count_sources
  FOR DELETE TO authenticated USING (public.can_access_bid_for_pricing(bid_id));

REVOKE ALL ON TABLE public.bid_count_sources FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bid_count_sources TO authenticated;
GRANT ALL ON TABLE public.bid_count_sources TO service_role;

-- 2) Each project's share of a count row.
ALTER TABLE public.bids_count_rows ADD COLUMN IF NOT EXISTS source_shares jsonb;

COMMENT ON COLUMN public.bids_count_rows.source_shares IS
  'Combine two CountTooling counts (v2.5517): each CountTooling project''s share of this row''s count, {"<bid_count_sources id>": <count>}. NULL = no project (typed by hand, or imported before v2.5517 and not yet adopted). A row both people counted holds two shares; a re-copy of one project moves only its own share and removes only the rows that are its alone.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bids_count_rows_source_shares_object' AND conrelid = 'public.bids_count_rows'::regclass) THEN
    ALTER TABLE public.bids_count_rows ADD CONSTRAINT bids_count_rows_source_shares_object
      CHECK (source_shares IS NULL OR jsonb_typeof(source_shares) = 'object') NOT VALID;
  END IF;
END $$;
ALTER TABLE public.bids_count_rows VALIDATE CONSTRAINT bids_count_rows_source_shares_object;

-- 3) A new version of the bid clones its count rows (20261002130000's body, unchanged but for the new column): the
--    clone carries each row's shares, since a version lives on the same bid and the shares name the bid's own projects.
--    A duplicate to another service type (duplicate_bid_to_service_type) leaves source_shares behind on purpose: it is a
--    new bid, and the shares would name projects that bid does not have (src/lib/bids/bidCopySql.test.ts lists it).
CREATE OR REPLACE FUNCTION public.clone_count_rows_to_bid_version(
  p_bid_id uuid,
  p_source_bid_version_id uuid,   -- NULL = the unsplit rows
  p_target_bid_version_id uuid
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_map jsonb := '{}'::jsonb;
  r record;
  v_new_id uuid;
  v_n integer := 0;
BEGIN
  IF p_bid_id IS NULL OR p_target_bid_version_id IS NULL THEN
    RAISE EXCEPTION 'clone_count_rows_to_bid_version: bid and target version required';
  END IF;

  FOR r IN
    SELECT * FROM public.bids_count_rows
     WHERE bid_id = p_bid_id AND bid_version_id IS NOT DISTINCT FROM p_source_bid_version_id
     ORDER BY sequence_order, id
  LOOP
    INSERT INTO public.bids_count_rows (bid_id, bid_version_id, fixture, count, group_tag, page, sequence_order, unit, source_shares)
    VALUES (p_bid_id, p_target_bid_version_id, r.fixture, r.count, r.group_tag, r.page, r.sequence_order, r.unit, r.source_shares)
    RETURNING id INTO v_new_id;
    v_map := v_map || jsonb_build_object(r.id::text, v_new_id::text);
    v_n := v_n + 1;
  END LOOP;

  IF v_n = 0 THEN RETURN 0; END IF;

  -- Version-scoped children: takeoff mappings + rough-in lines of the TARGET version.
  UPDATE public.bids_takeoff_template_mappings m
     SET count_row_id = (v_map->>m.count_row_id::text)::uuid
   WHERE m.bid_id = p_bid_id AND m.bid_version_id = p_target_bid_version_id
     AND v_map ? m.count_row_id::text;
  UPDATE public.bids_takeoff_rough_part_lines l
     SET count_row_id = (v_map->>l.count_row_id::text)::uuid
   WHERE l.bid_id = p_bid_id AND l.bid_version_id = p_target_bid_version_id
     AND v_map ? l.count_row_id::text;

  -- Pricing-scoped children: the TARGET version's price scenarios' custom prices / hides / assignments.
  UPDATE public.bid_count_row_custom_prices c
     SET count_row_id = (v_map->>c.count_row_id::text)::uuid
   WHERE c.bid_id = p_bid_id
     AND c.price_book_version_id IN (SELECT id FROM public.price_book_versions WHERE bid_id = p_bid_id AND bid_version_id = p_target_bid_version_id)
     AND v_map ? c.count_row_id::text;
  UPDATE public.bid_count_row_submission_hides h
     SET count_row_id = (v_map->>h.count_row_id::text)::uuid
   WHERE h.bid_id = p_bid_id
     AND h.price_book_version_id IN (SELECT id FROM public.price_book_versions WHERE bid_id = p_bid_id AND bid_version_id = p_target_bid_version_id)
     AND v_map ? h.count_row_id::text;
  UPDATE public.bid_pricing_assignments a
     SET count_row_id = (v_map->>a.count_row_id::text)::uuid
   WHERE a.bid_id = p_bid_id
     AND a.price_book_version_id IN (SELECT id FROM public.price_book_versions WHERE bid_id = p_bid_id AND bid_version_id = p_target_bid_version_id)
     AND v_map ? a.count_row_id::text;

  -- Stage boxes on a fixture (v2.4388): each clone carries its source row's box. A box on a line,
  -- or on a part inside a bundle line, follows its line in create_bid_version, which holds the
  -- line map.
  INSERT INTO public.bid_takeoff_stage_splits (bid_id, count_row_id, line_id, part_id, rough_in, top_out, trim_set, source)
  SELECT p_bid_id, m.value::uuid, NULL, NULL, s.rough_in, s.top_out, s.trim_set, s.source
    FROM jsonb_each_text(v_map) m
    JOIN public.bid_takeoff_stage_splits s ON s.count_row_id = m.key::uuid AND s.line_id IS NULL;

  -- Quoted fixture costs (v2.4413): each clone carries its source row's cost. A package (lot) gets
  -- an id of its own in the copy, because the app reverts a package by lot_group_id: with a shared
  -- id, reverting it in one version would take it from the other. The table's own policy lets
  -- fewer roles write than may make a version (no primary, no superintendent), so the copy is made
  -- only for a caller who may write a quoted cost; for the others the version is made without.
  IF public.can_write_bid_custom_costs() THEN
    WITH lots AS MATERIALIZED (
      SELECT d.lot_group_id AS old_id, gen_random_uuid() AS new_id
        FROM (SELECT DISTINCT c.lot_group_id
                FROM jsonb_each_text(v_map) m
                JOIN public.bid_count_row_custom_costs c ON c.count_row_id = m.key::uuid
               WHERE c.lot_group_id IS NOT NULL) d
    )
    INSERT INTO public.bid_count_row_custom_costs (bid_id, count_row_id, unit_materials_cents, source, quote_line_id, lot_group_id, house_name, applied_by, applied_at)
    SELECT p_bid_id, m.value::uuid, c.unit_materials_cents, c.source, c.quote_line_id, lots.new_id, c.house_name, c.applied_by, c.applied_at
      FROM jsonb_each_text(v_map) m
      JOIN public.bid_count_row_custom_costs c ON c.count_row_id = m.key::uuid
      LEFT JOIN lots ON lots.old_id = c.lot_group_id;
  END IF;

  RETURN v_n;
END;
$$;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
