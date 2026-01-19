-- Fix RLS policies for email_templates table
-- The policies were using direct queries which can cause recursion issues
-- Update them to use the is_dev() function instead

-- Drop existing policies
DROP POLICY IF EXISTS "Owners can read email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Owners can insert email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Owners can update email templates" ON public.email_templates;

-- Recreate policies using is_dev() function
CREATE POLICY "Devs can read email templates"
ON public.email_templates
FOR SELECT
USING (public.is_dev());

CREATE POLICY "Devs can insert email templates"
ON public.email_templates
FOR INSERT
WITH CHECK (public.is_dev());

CREATE POLICY "Devs can update email templates"
ON public.email_templates
FOR UPDATE
USING (public.is_dev())
WITH CHECK (public.is_dev());

-- Optional: Add delete policy if needed
CREATE POLICY "Devs can delete email templates"
ON public.email_templates
FOR DELETE
USING (public.is_dev());
