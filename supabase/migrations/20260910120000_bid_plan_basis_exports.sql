SET lock_timeout = '3s';

-- Bid basis (v2.3219): when the issued drawings are too rough to bid to, the
-- estimator bids to the marked-up plans and sends them with the proposal.
-- CountTooling exports the marked sheets and posts a manifest back to the
-- Cover Letter tab; each export lands here as one row (the record of WHICH
-- file was sent and WHICH marks were bid to), and the bid carries the letter
-- toggle that inserts the "Bid basis" clause.

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS bid_to_marked_plans boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bids.bid_to_marked_plans IS
  'When true (and a bid_plan_basis_exports row exists), the cover letter carries the Bid basis clause: we bid to our marked-up plans, not the plans as issued.';

CREATE TABLE IF NOT EXISTS public.bid_plan_basis_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  exported_at timestamptz NOT NULL DEFAULT now(),
  exported_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- The file name CountTooling saved under (or the name typed by hand).
  filename text NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 200),
  -- 'reported' = CountTooling posted the manifest; 'manual' = "Mark as attached by hand".
  save_method text NOT NULL DEFAULT 'reported' CHECK (save_method IN ('reported', 'manual')),
  sheet_labels text[] NOT NULL DEFAULT '{}'::text[],
  sheet_count integer NOT NULL DEFAULT 0 CHECK (sheet_count >= 0),
  page_indices integer[] NOT NULL DEFAULT '{}'::integer[],
  mark_totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes_count integer NOT NULL DEFAULT 0 CHECK (notes_count >= 0),
  include_report boolean NOT NULL DEFAULT false,
  file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  ct_project_id text,
  ct_project_name text,
  ct_view_token text,
  ct_pdf_hash text,
  -- The takeoff's last-saved time when it was exported: a later export or a
  -- fresh open with a newer time means "the takeoff moved after you bid".
  ct_updated_at timestamptz,
  -- CountTooling's Canvas JSON snapshot: every page's layers, scales and
  -- rotations plus the palette — re-importable onto the same PDF by hash.
  canvas_snapshot jsonb,
  -- Set on every earlier row when a newer export lands; the current export is the one with NULL.
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bid_plan_basis_exports IS
  'One row per marked-up plans export CountTooling handed to the Cover Letter (the bid basis): file name, sheets, mark totals, and the marks snapshot.';

CREATE INDEX IF NOT EXISTS idx_bid_plan_basis_exports_bid_exported
  ON public.bid_plan_basis_exports (bid_id, exported_at DESC);

ALTER TABLE public.bid_plan_basis_exports ENABLE ROW LEVEL SECURITY;

-- Same predicate as the other bid-scoped cover-letter tables
-- (bid_payment_schedule_rows / bid_count_row_submission_hides).

DROP POLICY IF EXISTS "Bid pricing users can read plan basis exports" ON public.bid_plan_basis_exports;
CREATE POLICY "Bid pricing users can read plan basis exports"
  ON public.bid_plan_basis_exports FOR SELECT
  USING (((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)));

DROP POLICY IF EXISTS "Bid pricing users can insert plan basis exports" ON public.bid_plan_basis_exports;
CREATE POLICY "Bid pricing users can insert plan basis exports"
  ON public.bid_plan_basis_exports FOR INSERT
  WITH CHECK (((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)));

DROP POLICY IF EXISTS "Bid pricing users can update plan basis exports" ON public.bid_plan_basis_exports;
CREATE POLICY "Bid pricing users can update plan basis exports"
  ON public.bid_plan_basis_exports FOR UPDATE
  USING (((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)))
  WITH CHECK ((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))));

DROP POLICY IF EXISTS "Bid pricing users can delete plan basis exports" ON public.bid_plan_basis_exports;
CREATE POLICY "Bid pricing users can delete plan basis exports"
  ON public.bid_plan_basis_exports FOR DELETE
  USING (((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)));

-- Training mode (read_only) and the digital-twin write fence must cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
