SET lock_timeout = '3s';

-- Bid GC recipients (bid-recipients train PR 1): every GC a bid was sent to,
-- beyond the single bid-level customer_id. Kills the "Multiple GC's" fake-
-- customer workaround: the bid keeps its primary GC, and this table carries
-- the rest, so followup surfaces can queue a call to each real GC.
-- Sources: 'manual' (Edit Bid "Also sent to" row) and 'version' (synced from
-- bid_versions.customer_id — the multi-GC cover-letter packet overrides,
-- v2.1159). Backfilled below from existing version overrides.

CREATE TABLE IF NOT EXISTS public.bid_gc_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'version')),
  added_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bid_id, customer_id)
);

COMMENT ON TABLE public.bid_gc_recipients IS
  'GCs a bid was sent to beyond the bid-level customer_id (the primary GC is NOT duplicated here). Feeds the Followup lenses so every real GC gets a call-queue entry.';

CREATE INDEX IF NOT EXISTS idx_bid_gc_recipients_bid ON public.bid_gc_recipients (bid_id);
CREATE INDEX IF NOT EXISTS idx_bid_gc_recipients_customer ON public.bid_gc_recipients (customer_id);

ALTER TABLE public.bid_gc_recipients ENABLE ROW LEVEL SECURITY;

-- Same predicate family as the other bid-scoped overlay tables
-- (bid_payment_schedule_rows / bid_count_row_submission_hides).

DROP POLICY IF EXISTS "Bid pricing users can read bid gc recipients" ON public.bid_gc_recipients;
CREATE POLICY "Bid pricing users can read bid gc recipients"
  ON public.bid_gc_recipients FOR SELECT
  USING (((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)));

DROP POLICY IF EXISTS "Bid pricing users can insert bid gc recipients" ON public.bid_gc_recipients;
CREATE POLICY "Bid pricing users can insert bid gc recipients"
  ON public.bid_gc_recipients FOR INSERT
  WITH CHECK (((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)));

DROP POLICY IF EXISTS "Bid pricing users can update bid gc recipients" ON public.bid_gc_recipients;
CREATE POLICY "Bid pricing users can update bid gc recipients"
  ON public.bid_gc_recipients FOR UPDATE
  USING (((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)))
  WITH CHECK ((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role]))))));

DROP POLICY IF EXISTS "Bid pricing users can delete bid gc recipients" ON public.bid_gc_recipients;
CREATE POLICY "Bid pricing users can delete bid gc recipients"
  ON public.bid_gc_recipients FOR DELETE
  USING (((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)));

-- Backfill: existing per-version GC overrides become recipients (skip the
-- bid-level GC — the primary is implied, not duplicated).
INSERT INTO public.bid_gc_recipients (bid_id, customer_id, source)
SELECT DISTINCT v.bid_id, v.customer_id, 'version'
FROM public.bid_versions v
JOIN public.bids b ON b.id = v.bid_id
WHERE v.customer_id IS NOT NULL
  AND v.customer_id IS DISTINCT FROM b.customer_id
ON CONFLICT (bid_id, customer_id) DO NOTHING;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
