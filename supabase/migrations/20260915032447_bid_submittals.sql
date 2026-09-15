SET lock_timeout = '3s';

-- Submittals, stage 2 (to-dos/submittals/README.md): the submittal package as
-- rows — one revision per (bid, rev), one item per fixture tag: the specified
-- product, the submitted product (the picked quote line), a status, the
-- estimator's reason and lead time, the cut-sheet pages, and (stage 4) the
-- GC's decision. Plus the private bucket the dropped vendor PDFs and the
-- rendered packages live in.

-- ---------- 1 · revisions ----------

CREATE TABLE IF NOT EXISTS public.bid_submittals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  job_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Plumbing fixtures & equipment',
  rev_number integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  note text,
  -- The rendered package (cover table + stamped sheets) in the bid-submittals bucket, once built.
  package_path text,
  -- The vendor PDFs dropped on this revision: [{ path, house_id, house_name, name, pages, trimmed_at }].
  source_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  shared_at timestamptz,
  shared_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bid_submittals_status_check CHECK (status IN ('draft', 'shared', 'reviewed', 'superseded')),
  CONSTRAINT bid_submittals_bid_rev_key UNIQUE (bid_id, rev_number)
);

COMMENT ON TABLE public.bid_submittals IS
  'Submittals stage 2a (v2.3465): one revision of a bid''s submittal package; items in bid_submittal_items; files in the bid-submittals bucket under <bid_id>/<submittal_id>/.';

CREATE INDEX IF NOT EXISTS bid_submittals_bid_idx ON public.bid_submittals (bid_id);
CREATE INDEX IF NOT EXISTS bid_submittals_job_idx ON public.bid_submittals (job_ledger_id) WHERE job_ledger_id IS NOT NULL;

-- ---------- 2 · items ----------

CREATE TABLE IF NOT EXISTS public.bid_submittal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id uuid NOT NULL REFERENCES public.bid_submittals(id) ON DELETE CASCADE,
  tag text NOT NULL DEFAULT '',
  sequence_order integer NOT NULL DEFAULT 0,
  specified_manufacturer text,
  specified_model text,
  specified_description text,
  submitted_manufacturer text,
  submitted_model text,
  submitted_label text,
  supply_house_id uuid REFERENCES public.supply_houses(id) ON DELETE SET NULL,
  source_quote_line_id uuid REFERENCES public.bid_quote_lines(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'alternate',
  reason_kind text,
  reason_note text,
  lead_time_days integer,
  -- The sheet: an index into the revision's source_files + the 1-based pages that are this tag's sheet.
  sheet_file integer,
  sheet_pages integer[] NOT NULL DEFAULT '{}'::integer[],
  sheet_source text,
  carried_from_item_id uuid REFERENCES public.bid_submittal_items(id) ON DELETE SET NULL,
  -- Stage 4: the GC's decision, typed name and email (decision 6).
  review_decision text,
  review_note text,
  reviewed_by_name text,
  reviewed_by_email text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bid_submittal_items_status_check CHECK (status IN ('as_specified', 'superseded', 'equal', 'alternate', 'design_change', 'missing', 'accessory')),
  CONSTRAINT bid_submittal_items_reason_kind_check CHECK (reason_kind IS NULL OR reason_kind IN ('lead_time', 'discontinued', 'in_stock', 'equal', 'cost', 'other')),
  CONSTRAINT bid_submittal_items_sheet_source_check CHECK (sheet_source IS NULL OR sheet_source IN ('estimator', 'robot', 'house')),
  CONSTRAINT bid_submittal_items_review_decision_check CHECK (review_decision IS NULL OR review_decision IN ('approved', 'revise', 'rejected')),
  CONSTRAINT bid_submittal_items_lead_time_check CHECK (lead_time_days IS NULL OR (lead_time_days >= 0 AND lead_time_days <= 730))
);

COMMENT ON TABLE public.bid_submittal_items IS
  'Submittals stage 2a (v2.3465): one row per fixture tag on a revision — specified vs submitted, status, reason, lead time, sheet pages; stage 4 adds the reviewer''s decision.';

CREATE INDEX IF NOT EXISTS bid_submittal_items_submittal_idx ON public.bid_submittal_items (submittal_id, sequence_order);

-- ---------- 3 · RLS: the pricing sharers, on bids they can price ----------

ALTER TABLE public.bid_submittals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_submittal_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_pricing_sharer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
     WHERE users.id = ( SELECT auth.uid() )
       AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])
  );
$$;

REVOKE ALL ON FUNCTION public.is_pricing_sharer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_pricing_sharer() TO authenticated;

DROP POLICY IF EXISTS "Pricing sharers can read bid_submittals" ON public.bid_submittals;
CREATE POLICY "Pricing sharers can read bid_submittals" ON public.bid_submittals FOR SELECT
  USING (public.is_pricing_sharer() AND public.can_access_bid_for_pricing(bid_id));
DROP POLICY IF EXISTS "Pricing sharers can write bid_submittals" ON public.bid_submittals;
CREATE POLICY "Pricing sharers can write bid_submittals" ON public.bid_submittals FOR ALL
  USING (public.is_pricing_sharer() AND public.can_access_bid_for_pricing(bid_id))
  WITH CHECK (public.is_pricing_sharer() AND public.can_access_bid_for_pricing(bid_id));

CREATE OR REPLACE FUNCTION public.can_access_submittal(p_submittal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bid_submittals s
     WHERE s.id = p_submittal_id
       AND public.can_access_bid_for_pricing(s.bid_id)
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_submittal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_submittal(uuid) TO authenticated;

DROP POLICY IF EXISTS "Pricing sharers can read bid_submittal_items" ON public.bid_submittal_items;
CREATE POLICY "Pricing sharers can read bid_submittal_items" ON public.bid_submittal_items FOR SELECT
  USING (public.is_pricing_sharer() AND public.can_access_submittal(submittal_id));
DROP POLICY IF EXISTS "Pricing sharers can write bid_submittal_items" ON public.bid_submittal_items;
CREATE POLICY "Pricing sharers can write bid_submittal_items" ON public.bid_submittal_items FOR ALL
  USING (public.is_pricing_sharer() AND public.can_access_submittal(submittal_id))
  WITH CHECK (public.is_pricing_sharer() AND public.can_access_submittal(submittal_id));

-- ---------- 4 · the bucket: <bid_id>/<submittal_id>/<file>.pdf, private ----------

INSERT INTO storage.buckets (id, name, public)
VALUES ('bid-submittals', 'bid-submittals', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS bid_submittals_docs_select ON storage.objects;
CREATE POLICY bid_submittals_docs_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'bid-submittals'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_pricing_sharer()
    AND public.can_access_bid_for_pricing(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS bid_submittals_docs_insert ON storage.objects;
CREATE POLICY bid_submittals_docs_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bid-submittals'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_pricing_sharer()
    AND public.can_access_bid_for_pricing(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS bid_submittals_docs_update ON storage.objects;
CREATE POLICY bid_submittals_docs_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'bid-submittals'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_pricing_sharer()
    AND public.can_access_bid_for_pricing(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS bid_submittals_docs_delete ON storage.objects;
CREATE POLICY bid_submittals_docs_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'bid-submittals'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_pricing_sharer()
    AND public.can_access_bid_for_pricing(((storage.foldername(name))[1])::uuid)
  );

-- House rules: read-only training mode + twin write fence cover the new tables.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
