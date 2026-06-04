-- Create prospects table for CRM-style prospect tracking
-- Columns: warmth_value, prospect_fit_status, company_name, contact_name, phone_number, links_to_website

CREATE TABLE IF NOT EXISTS public.prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  warmth_value TEXT,
  prospect_fit_status TEXT,
  company_name TEXT,
  contact_name TEXT,
  phone_number TEXT,
  links_to_website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prospects_master_user_id ON public.prospects(master_user_id);
CREATE INDEX IF NOT EXISTS idx_prospects_created_by ON public.prospects(created_by);
CREATE TRIGGER update_prospects_updated_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
-- RLS: Same pattern as customers - devs, masters, assistants; ownership via master_user_id and adoption

CREATE POLICY "Users can see prospects they own or from masters who adopted them"
ON public.prospects
FOR SELECT
USING (
  master_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
  OR EXISTS (
    SELECT 1 FROM public.master_assistants
    WHERE master_id = master_user_id
    AND assistant_id = auth.uid()
  )
);
CREATE POLICY "Devs, masters, and assistants can insert prospects"
ON public.prospects
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND created_by = auth.uid()
  AND (
    master_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician')
    )
    OR EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE master_id = master_user_id
      AND assistant_id = auth.uid()
    )
  )
);
CREATE POLICY "Users can update prospects they own or from masters who adopted them"
ON public.prospects
FOR UPDATE
USING (
  master_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
  OR EXISTS (
    SELECT 1 FROM public.master_assistants
    WHERE master_id = master_user_id
    AND assistant_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);
CREATE POLICY "Users can delete prospects they own or from masters who adopted them"
ON public.prospects
FOR DELETE
USING (
  master_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
  OR EXISTS (
    SELECT 1 FROM public.master_assistants
    WHERE master_id = master_user_id
    AND assistant_id = auth.uid()
  )
);
