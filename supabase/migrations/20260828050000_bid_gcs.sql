SET lock_timeout = '3s';

-- Per-GC bids Phase 4 (docs/PER_GC_BID_PLAN.md): due date, submitted-to, and ITB links are
-- per-GC STATE (not derivable like sent/contact/outcome) — a GC with three versions has ONE
-- due date. `bid_gcs` is their home: one row per (bid, GC), created lazily on first per-GC
-- edit. customer_id NULL = the bid's own GC; shared-letter recipients get rows when edited.
--
-- The bid-level `bids.bid_due_date`/`bid_due_time` become a DERIVED roll-up wherever per-GC
-- dues exist: earliest due among packets with no send ("what's still open"), falling back to
-- the earliest due overall. Bids with no per-GC dues keep their hand-set dates untouched.
-- Board urgency, due chips and lenses keep reading the bid-level columns unchanged.

CREATE TABLE IF NOT EXISTS public.bid_gcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  -- NULL = the bid's own GC (same convention as bid_versions.customer_id).
  customer_id uuid NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  due_date date NULL,
  due_time time NULL,
  submitted_to_name text NULL,
  submitted_to_phone text NULL,
  submitted_to_email text NULL,
  itb_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

-- One row per (bid, GC); the zero-uuid stands in for "own GC" so NULL rows can't double up.
CREATE UNIQUE INDEX IF NOT EXISTS bid_gcs_bid_customer_uniq
  ON public.bid_gcs (bid_id, COALESCE(customer_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS bid_gcs_bid_id_idx ON public.bid_gcs (bid_id);

COMMENT ON TABLE public.bid_gcs IS
  'Per-GC bid state: due date/time, submitted-to, ITB links. customer_id NULL = the bid''s own GC. bids.bid_due_date/_time derive from these (earliest open due) via recompute_bid_due.';

ALTER TABLE public.bid_gcs ENABLE ROW LEVEL SECURITY;

-- Same gate as bid_version_sends: whoever can price the bid can see/edit its per-GC state.
DROP POLICY IF EXISTS "bid_gcs_select" ON public.bid_gcs;
CREATE POLICY "bid_gcs_select" ON public.bid_gcs
  FOR SELECT USING (public.can_access_bid_for_pricing(bid_id));
DROP POLICY IF EXISTS "bid_gcs_insert" ON public.bid_gcs;
CREATE POLICY "bid_gcs_insert" ON public.bid_gcs
  FOR INSERT WITH CHECK (public.can_access_bid_for_pricing(bid_id));
DROP POLICY IF EXISTS "bid_gcs_update" ON public.bid_gcs;
CREATE POLICY "bid_gcs_update" ON public.bid_gcs
  FOR UPDATE USING (public.can_access_bid_for_pricing(bid_id))
  WITH CHECK (public.can_access_bid_for_pricing(bid_id));
DROP POLICY IF EXISTS "bid_gcs_delete" ON public.bid_gcs;
CREATE POLICY "bid_gcs_delete" ON public.bid_gcs
  FOR DELETE USING (public.can_access_bid_for_pricing(bid_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bid_gcs TO authenticated;
GRANT ALL ON public.bid_gcs TO service_role;

-- Read-only (training mode) users: restrictive write policies + statement trigger (CLAUDE.md rule).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();

-- ─────────────────────────────────────────────────────────────────────────────
-- Derived bid-level due: earliest due among packets that have NO send yet (the dues that are
-- still open), falling back to the earliest per-GC due overall. A bid with no per-GC dues is
-- left untouched — hand-set bid_due_date keeps working exactly as before.
-- INVOKER rights: whoever can write bid_gcs / bid_version_sends can already update bids from
-- the same client flows (same posture as sync_bid_date_sent_from_sends).
CREATE OR REPLACE FUNCTION public.recompute_bid_due(p_bid_id uuid) RETURNS void
  LANGUAGE plpgsql
  SET search_path = public
  AS $$
DECLARE
  v_date date;
  v_time time;
BEGIN
  IF p_bid_id IS NULL THEN RETURN; END IF;

  SELECT g.due_date, g.due_time INTO v_date, v_time
    FROM public.bid_gcs g
   WHERE g.bid_id = p_bid_id
     AND g.due_date IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
         FROM public.bid_versions v
         JOIN public.bid_version_sends s ON s.bid_version_id = v.id
        WHERE v.bid_id = p_bid_id
          AND v.customer_id IS NOT DISTINCT FROM g.customer_id
     )
   ORDER BY g.due_date, g.due_time NULLS LAST
   LIMIT 1;

  IF v_date IS NULL THEN
    SELECT g.due_date, g.due_time INTO v_date, v_time
      FROM public.bid_gcs g
     WHERE g.bid_id = p_bid_id
       AND g.due_date IS NOT NULL
     ORDER BY g.due_date, g.due_time NULLS LAST
     LIMIT 1;
  END IF;

  IF v_date IS NULL THEN RETURN; END IF; -- no per-GC dues: hand-set bid dates stay

  UPDATE public.bids b
     SET bid_due_date = v_date,
         bid_due_time = v_time
   WHERE b.id = p_bid_id
     AND (b.bid_due_date IS DISTINCT FROM v_date OR b.bid_due_time IS DISTINCT FROM v_time);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_bid_due_from_bid_gcs() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
  AS $$
BEGIN
  PERFORM public.recompute_bid_due(COALESCE(NEW.bid_id, OLD.bid_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS bid_gcs_sync_bid_due ON public.bid_gcs;
CREATE TRIGGER bid_gcs_sync_bid_due
  AFTER INSERT OR UPDATE OR DELETE ON public.bid_gcs
  FOR EACH ROW EXECUTE FUNCTION public.sync_bid_due_from_bid_gcs();

-- A send changes which dues are "open", so sends recompute too (alongside the existing
-- bid_date_sent sync trigger on this table).
DROP TRIGGER IF EXISTS bid_version_sends_sync_bid_due ON public.bid_version_sends;
CREATE TRIGGER bid_version_sends_sync_bid_due
  AFTER INSERT OR UPDATE OR DELETE ON public.bid_version_sends
  FOR EACH ROW EXECUTE FUNCTION public.sync_bid_due_from_bid_gcs();

-- No backfill: the table starts empty; rows appear lazily on first per-GC edit.
