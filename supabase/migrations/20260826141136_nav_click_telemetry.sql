SET lock_timeout = '3s';

-- v2.2334: nav-click telemetry (CX-audit measurement plan, Phase 3).
-- One row per click on instrumented navigation chrome (top nav, gear menu,
-- bottom tabs, dashboard dock/banners/pins/quick buttons). Append-only;
-- complements user_app_activity_page_daily (time-on-page) with the "which
-- control got them there" half. No content data — control kind + target path.

CREATE TABLE IF NOT EXISTS public.ui_nav_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text,
  control text NOT NULL,
  target text NOT NULL,
  from_path text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ui_nav_clicks_occurred_idx
  ON public.ui_nav_clicks (occurred_at);
CREATE INDEX IF NOT EXISTS ui_nav_clicks_control_target_idx
  ON public.ui_nav_clicks (control, target);

ALTER TABLE public.ui_nav_clicks ENABLE ROW LEVEL SECURITY;

-- Writes: each user inserts only their own rows (fire-and-forget from the client).
DROP POLICY IF EXISTS ui_nav_clicks_insert ON public.ui_nav_clicks;
CREATE POLICY ui_nav_clicks_insert ON public.ui_nav_clicks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Reads: dev only for now (the usage readout); widen deliberately if needed.
DROP POLICY IF EXISTS ui_nav_clicks_select ON public.ui_nav_clicks;
CREATE POLICY ui_nav_clicks_select ON public.ui_nav_clicks
  FOR SELECT TO authenticated
  USING (public.is_dev());

-- No UPDATE/DELETE policies: the table is an append-only measurement ledger.

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
