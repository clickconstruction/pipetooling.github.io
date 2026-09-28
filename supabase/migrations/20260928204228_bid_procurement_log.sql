SET lock_timeout = '3s';

-- Bids → Submittals → Procure (v2.4083): the procurement log a GC asks for —
-- per tag, what we ordered and when it lands; and the dated updates we sent.
-- Released comes from the review room's decision, required from the job's stage
-- windows; only the order, the arrival and a note are typed. Additive.

CREATE TABLE IF NOT EXISTS public.bid_procurement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  -- The submittal tag this row rides on (WH-1); NULL for a hand row (an item with no cut sheet).
  tag text NULL CHECK (tag IS NULL OR length(btrim(tag)) BETWEEN 1 AND 40),
  -- Hand rows only: what it is, its lead time and the stage it is needed for.
  label text NOT NULL DEFAULT '' CHECK (length(label) <= 200),
  lead_time_days integer NULL CHECK (lead_time_days IS NULL OR (lead_time_days >= 0 AND lead_time_days <= 730)),
  stage text NULL CHECK (stage IS NULL OR stage IN ('rough_in', 'top_out', 'trim_set')),
  ordered_on date NULL,
  po_ref text NOT NULL DEFAULT '' CHECK (length(po_ref) <= 60),
  -- The supply house's own date, when it differs from ordered + lead time.
  expected_on date NULL,
  delivered_on date NULL,
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.bid_procurement_items IS
  'Procurement log (Submittals → Procure): per submittal tag (or a hand row), the order date, PO, the house''s expected date, delivered date and note. Released and required are derived, not stored.';
CREATE UNIQUE INDEX IF NOT EXISTS uq_bid_procurement_items_bid_tag ON public.bid_procurement_items (bid_id, tag) WHERE tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bid_procurement_items_bid ON public.bid_procurement_items (bid_id, sort_order);

CREATE TABLE IF NOT EXISTS public.bid_procurement_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  sent_by_name text NOT NULL DEFAULT '',
  sent_to text NOT NULL DEFAULT '' CHECK (length(sent_to) <= 300),
  line text NOT NULL DEFAULT '' CHECK (length(line) <= 1000),
  -- The rows as they were sent, and what had changed since the update before.
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.bid_procurement_updates IS
  'Procurement log updates sent to the GC: a dated snapshot of the rows, the changes since the one before, and the one line we wrote.';
CREATE INDEX IF NOT EXISTS idx_bid_procurement_updates_bid_sent ON public.bid_procurement_updates (bid_id, sent_at DESC);

ALTER TABLE public.bid_procurement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_procurement_updates ENABLE ROW LEVEL SECURITY;

-- The same predicate as the other bid-scoped submittal tables.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bid_procurement_items', 'bid_procurement_updates'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Bid pricing users can read %1$s" ON public.%1$I', t);
    EXECUTE format($p$CREATE POLICY "Bid pricing users can read %1$s" ON public.%1$I FOR SELECT
      USING (((EXISTS (SELECT 1 FROM public.users WHERE ((users.id = (SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)))$p$, t);
    EXECUTE format('DROP POLICY IF EXISTS "Bid pricing users can insert %1$s" ON public.%1$I', t);
    EXECUTE format($p$CREATE POLICY "Bid pricing users can insert %1$s" ON public.%1$I FOR INSERT
      WITH CHECK (((EXISTS (SELECT 1 FROM public.users WHERE ((users.id = (SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)))$p$, t);
    EXECUTE format('DROP POLICY IF EXISTS "Bid pricing users can update %1$s" ON public.%1$I', t);
    EXECUTE format($p$CREATE POLICY "Bid pricing users can update %1$s" ON public.%1$I FOR UPDATE
      USING (((EXISTS (SELECT 1 FROM public.users WHERE ((users.id = (SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)))
      WITH CHECK (((EXISTS (SELECT 1 FROM public.users WHERE ((users.id = (SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)))$p$, t);
    EXECUTE format('DROP POLICY IF EXISTS "Bid pricing users can delete %1$s" ON public.%1$I', t);
    EXECUTE format($p$CREATE POLICY "Bid pricing users can delete %1$s" ON public.%1$I FOR DELETE
      USING (((EXISTS (SELECT 1 FROM public.users WHERE ((users.id = (SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)))$p$, t);
  END LOOP;
END $$;

-- Training mode (read_only) and the digital-twin write fence must cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
