-- Create email_templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL UNIQUE CHECK (template_type IN (
    'invitation', 'sign_in', 'login_as',
    'stage_assigned_started', 'stage_assigned_complete', 'stage_assigned_reopened',
    'stage_me_started', 'stage_me_complete', 'stage_me_reopened',
    'stage_next_complete_or_approved', 'stage_prior_rejected'
  )),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON public.email_templates(template_type);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can read all templates
CREATE POLICY "Owners can read email templates"
ON public.email_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'dev'
  )
);

-- Policy: Owners can insert templates
CREATE POLICY "Owners can insert email templates"
ON public.email_templates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'dev'
  )
);

-- Policy: Owners can update templates
CREATE POLICY "Owners can update email templates"
ON public.email_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'dev'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'dev'
  )
);
