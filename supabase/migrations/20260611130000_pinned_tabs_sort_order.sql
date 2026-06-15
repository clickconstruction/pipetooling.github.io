-- Pinned pages Tier 1: user-controllable order + cross-device sync.
-- Self-pins are moving from localStorage into user_pinned_tabs (where dev-assigned pins already
-- live). Add a per-user sort_order and an UPDATE policy so a user can reorder their own pins.

ALTER TABLE public.user_pinned_tabs
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_pinned_tabs_user_sort ON public.user_pinned_tabs(user_id, sort_order);

-- Existing RLS already covers SELECT/INSERT/DELETE of own rows; UPDATE was missing (needed to
-- persist reordering).
DROP POLICY IF EXISTS "Users update own pinned tabs" ON public.user_pinned_tabs;
CREATE POLICY "Users update own pinned tabs" ON public.user_pinned_tabs
  FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
