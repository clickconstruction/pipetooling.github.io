SET lock_timeout = '3s';

-- v2.2341: customer-side view counting (CX-audit measurement plan).
-- One row per token-validated load of a public customer surface, inserted
-- SERVER-SIDE by the serving edge function with the service role — no
-- anon-writable path exists, so junk traffic can't inflate counts. Fills the
-- measurement blind spot: user_app_activity_page_daily / ui_nav_clicks only
-- see signed-in users. v1 writes 'portal' only — estimate-accept views were
-- ALREADY recorded (estimate_customer_events.event_type = 'public_link_view',
-- since 20260406, IP/UA + 5s dedupe); the other surfaces are pre-allowed in
-- the CHECK so adding them later is a function edit, not DDL.

CREATE TABLE IF NOT EXISTS public.public_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surface text NOT NULL CHECK (surface IN ('portal', 'estimate_terms', 'contract_accept', 'hazmat_notice')),
  -- portal → customers.id. No FK on purpose: a deleted entity must not erase
  -- the fact that its page was viewed.
  entity_id uuid,
  via text CHECK (via IN ('token', 'slug')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_page_views_occurred_idx
  ON public.public_page_views (occurred_at);
CREATE INDEX IF NOT EXISTS public_page_views_surface_entity_idx
  ON public.public_page_views (surface, entity_id);

ALTER TABLE public.public_page_views ENABLE ROW LEVEL SECURITY;

-- No INSERT/UPDATE/DELETE policies: writes come only from the service role
-- (edge functions), which bypasses RLS. Reads: dev (the usage readout).
DROP POLICY IF EXISTS public_page_views_select ON public.public_page_views;
CREATE POLICY public_page_views_select ON public.public_page_views
  FOR SELECT TO authenticated
  USING (public.is_dev());

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
