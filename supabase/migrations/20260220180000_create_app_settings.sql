-- App settings: key-value store for dev-configurable defaults (e.g. default labor rate)
-- All authenticated users can read; only devs can update

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT NOT NULL PRIMARY KEY,
  value_num NUMERIC(10, 2)
);

COMMENT ON TABLE public.app_settings IS 'App-wide settings (e.g. default labor rate). All can read; dev-only write.';

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read app settings"
ON public.app_settings
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Devs can manage app settings"
ON public.app_settings
FOR ALL
USING (public.is_dev())
WITH CHECK (public.is_dev());
