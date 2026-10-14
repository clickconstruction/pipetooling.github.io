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

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
