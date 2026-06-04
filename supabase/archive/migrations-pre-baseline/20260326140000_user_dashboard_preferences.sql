-- Per-user layout for dashboard quick-action buttons (top vs inline with pinned tabs)
CREATE TABLE IF NOT EXISTS public.user_dashboard_preferences (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  quick_buttons_placement text NOT NULL DEFAULT 'top'
    CHECK (quick_buttons_placement IN ('top', 'with_pins'))
);
COMMENT ON TABLE public.user_dashboard_preferences IS 'Per-user dashboard layout: where quick-action buttons (Job, Bid, etc.) appear.';
COMMENT ON COLUMN public.user_dashboard_preferences.quick_buttons_placement IS 'top: above Clock; with_pins: same row as pinned tab links.';

ALTER TABLE public.user_dashboard_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dashboard preferences"
ON public.user_dashboard_preferences FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Realtime so Dashboard can react if placement changes elsewhere (e.g. another tab)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_dashboard_preferences'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_dashboard_preferences;
  END IF;
END
$$;
