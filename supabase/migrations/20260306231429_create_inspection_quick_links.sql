-- Inspection quick links: editable permit/inspection portal links (replaces hardcoded list)
-- Access: dev, master_technician, assistant, primary (same as Inspections tab, reuses can_manage_inspection_types)

-- ============================================================================
-- inspection_quick_links table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inspection_quick_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_quick_links_sequence ON public.inspection_quick_links(sequence_order);

ALTER TABLE public.inspection_quick_links ENABLE ROW LEVEL SECURITY;

-- Trigger: update updated_at
CREATE TRIGGER set_inspection_quick_links_updated_at
  BEFORE UPDATE ON public.inspection_quick_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- SELECT: all authenticated
CREATE POLICY "All authenticated can read inspection quick links"
ON public.inspection_quick_links
FOR SELECT
USING (auth.role() = 'authenticated');

-- INSERT/UPDATE/DELETE: dev, master, assistant, primary
CREATE POLICY "Inspections tab users can manage inspection quick links"
ON public.inspection_quick_links
FOR ALL
USING (public.can_manage_inspection_types())
WITH CHECK (public.can_manage_inspection_types());

-- ============================================================================
-- Seed inspection quick links (7 current values)
-- ============================================================================

INSERT INTO public.inspection_quick_links (label, url, sequence_order) VALUES
  ('City of New Braunfels', 'https://nbpermits.nbtexas.org/publicaccess/template/Login.aspx', 0),
  ('Alamo Heights', 'https://www.mgoconnect.org/cp/portal', 1),
  ('Shavano Park', 'https://www.mgoconnect.org/cp/portal', 2),
  ('Terrell Hills', 'https://www.mgoconnect.org/cp/portal', 3),
  ('City of San Antonio', 'https://aca-prod.accela.com/COSA/Login.aspx', 4),
  ('City of Kyle', 'https://kyletx-energovpub.tylerhost.net/apps/selfservice#/home', 5),
  ('City of Schertz', 'https://development.schertz.com/Portal/', 6);

COMMENT ON TABLE public.inspection_quick_links IS 'Editable permit/inspection portal links. Managed by anyone who can see Jobs Inspections tab.';;
