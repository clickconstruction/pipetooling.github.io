SET lock_timeout = '3s';

-- Plan sets on a bid (the owner's 2026-10-30 ask, item 3 of the Bids tab day): a bid can carry more than one set of
-- plans — the issued set, an addendum, a permit set, a GC's marked copy — each with its own name, memo, date and
-- link, and the file's name and size read from Drive, so the Bid Board's plans press can offer them by name. Until
-- now a bid held one link, bids.plans_link, which the robots read and the Plans panel searches; that column stays as
-- it is and keeps meaning the set the robot reads. A bid whose plans_link is on none of its rows still reads as one
-- set, the link on the bid itself (the fail-soft the CountTooling projects use), so nothing is backfilled.
-- A new table, so the three house calls end it. See docs/migrations/20261030200000_bid_plan_sets.md.

CREATE TABLE IF NOT EXISTS public.bid_plan_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  -- What the office calls the set: Issued set, Addendum 2, Permit set, GC's marked copy.
  name text NOT NULL
    CONSTRAINT bid_plan_sets_name_length CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  -- A line about the set: what changed, who sent it, what to watch for.
  memo text NOT NULL DEFAULT ''
    CONSTRAINT bid_plan_sets_memo_length CHECK (length(memo) <= 2000),
  -- The set's own date, as printed on it or as it came in; a civil date, no time.
  plan_date date,
  -- A Drive folder or file link, as the bid's plans_link is; the robots read Drive and nothing else.
  link text NOT NULL
    CONSTRAINT bid_plan_sets_link_shape CHECK (link ~ '^https?://' AND length(link) <= 2000),
  -- What plan-fetch's probe read behind the link: one PDF's name, or "N PDFs" for a folder; the bytes in all;
  -- how many PDFs; when it looked; and its note when it could not read the link.
  file_name text
    CONSTRAINT bid_plan_sets_file_name_length CHECK (file_name IS NULL OR length(file_name) <= 300),
  file_size bigint
    CONSTRAINT bid_plan_sets_file_size_nonneg CHECK (file_size IS NULL OR file_size >= 0),
  file_count integer
    CONSTRAINT bid_plan_sets_file_count_nonneg CHECK (file_count IS NULL OR file_count >= 0),
  checked_at timestamptz,
  check_note text
    CONSTRAINT bid_plan_sets_check_note_length CHECK (check_note IS NULL OR length(check_note) <= 500),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bid_plan_sets IS
  'Plan sets on a bid (2026-10-30): one row per set of plans a bid carries — its name, memo, date and Drive link, with the file''s name, size and PDF count as plan-fetch''s probe last read them. bids.plans_link stays the set the robot reads and the Plans panel searches; a bid whose plans_link is on none of these rows reads as one set, the link on the bid itself. Read by everyone who can see the bid for pricing; written by estimator and up.';

CREATE INDEX IF NOT EXISTS bid_plan_sets_bid ON public.bid_plan_sets (bid_id, plan_date DESC NULLS LAST, created_at DESC);

DROP TRIGGER IF EXISTS bid_plan_sets_set_updated_at ON public.bid_plan_sets;
CREATE TRIGGER bid_plan_sets_set_updated_at
  BEFORE UPDATE ON public.bid_plan_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.bid_plan_sets ENABLE ROW LEVEL SECURITY;

-- Read with the bid: the same gate as bid_versions, bid_count_sources and the pricing overlay tables.
DROP POLICY IF EXISTS bid_plan_sets_select ON public.bid_plan_sets;
CREATE POLICY bid_plan_sets_select ON public.bid_plan_sets
  FOR SELECT TO authenticated USING (public.can_access_bid_for_pricing(bid_id));

-- Write as estimator and up (the roles that fill the bid form's Plans section), on a bid they can see.
DROP POLICY IF EXISTS bid_plan_sets_insert ON public.bid_plan_sets;
CREATE POLICY bid_plan_sets_insert ON public.bid_plan_sets
  FOR INSERT TO authenticated WITH CHECK (
    public.can_access_bid_for_pricing(bid_id)
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid())
      AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role]))
  );
DROP POLICY IF EXISTS bid_plan_sets_update ON public.bid_plan_sets;
CREATE POLICY bid_plan_sets_update ON public.bid_plan_sets
  FOR UPDATE TO authenticated USING (
    public.can_access_bid_for_pricing(bid_id)
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid())
      AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role]))
  ) WITH CHECK (
    public.can_access_bid_for_pricing(bid_id)
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid())
      AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role]))
  );
DROP POLICY IF EXISTS bid_plan_sets_delete ON public.bid_plan_sets;
CREATE POLICY bid_plan_sets_delete ON public.bid_plan_sets
  FOR DELETE TO authenticated USING (
    public.can_access_bid_for_pricing(bid_id)
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid())
      AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role]))
  );

REVOKE ALL ON TABLE public.bid_plan_sets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bid_plan_sets TO authenticated;
GRANT ALL ON TABLE public.bid_plan_sets TO service_role;

-- House rules: read-only training mode + the digital-twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
