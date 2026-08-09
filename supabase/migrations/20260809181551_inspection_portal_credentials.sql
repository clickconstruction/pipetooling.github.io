SET lock_timeout = '3s';

-- Permit portal upgrade for the Jobs → Inspections tab:
-- 1) inspection_quick_links grows cities[] (searchable "which city is this portal for")
--    and notes (e.g. "site currently down") — both readable by all authenticated,
--    same as the existing link columns.
-- 2) New inspection_portal_credentials holds the shared portal login per link,
--    readable/writable ONLY by the roles that use the Inspections tab
--    (dev, master_technician, assistant, controller, primary) — unlike the
--    all-authenticated quick-links table.

ALTER TABLE public.inspection_quick_links
  ADD COLUMN IF NOT EXISTS cities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.inspection_quick_links.cities IS 'Cities served by this permit portal; drives the city search on the Inspections tab.';
COMMENT ON COLUMN public.inspection_quick_links.notes IS 'Free-text note shown on the portal card (e.g. outage warnings).';

-- Role gate: the Inspections-tab audience. can_manage_inspection_types() predates
-- the controller role; this function includes it.
CREATE OR REPLACE FUNCTION public.can_view_inspection_portal_credentials() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  );
$$;

CREATE TABLE IF NOT EXISTS public.inspection_portal_credentials (
  quick_link_id uuid PRIMARY KEY REFERENCES public.inspection_quick_links(id) ON DELETE CASCADE,
  username text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inspection_portal_credentials IS 'Shared login for a permit portal quick link. RLS-restricted to Inspections-tab roles (dev/master/assistant/controller/primary), unlike the all-authenticated parent table.';

ALTER TABLE public.inspection_portal_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inspections tab roles can read portal credentials" ON public.inspection_portal_credentials;
CREATE POLICY "Inspections tab roles can read portal credentials"
  ON public.inspection_portal_credentials FOR SELECT
  USING (public.can_view_inspection_portal_credentials());

DROP POLICY IF EXISTS "Inspections tab roles can manage portal credentials" ON public.inspection_portal_credentials;
CREATE POLICY "Inspections tab roles can manage portal credentials"
  ON public.inspection_portal_credentials FOR ALL
  USING (public.can_view_inspection_portal_credentials())
  WITH CHECK (public.can_view_inspection_portal_credentials());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_portal_credentials TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
