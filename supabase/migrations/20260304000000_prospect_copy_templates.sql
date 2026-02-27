-- Prospect copy templates: per-user editable text for Follow Up copy buttons
-- Defaults stored in app_settings (dev-editable); user overrides in user_prospect_copy_templates

-- 1. Add value_text to app_settings for text defaults
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS value_text TEXT;

-- 2. Seed default templates (use ON CONFLICT to avoid errors on re-run)
INSERT INTO public.app_settings (key, value_text) VALUES
(
  'prospect_copy_no_response_email',
  E'Hi this is [User name] from Click Plumbing, Electrical, and HVAC,\n\nWe want to bid your work! Click Plumbing is actively seeking long-term trade partnerships and we see great value supporting [company name]''s upcoming projects. Our RMP Master, Malachi Whites, has previously worked with D.R. Horton San Antonio, Ashton Woods, M/I Homes, Michael Holub Custom Homes, H&I Construction, and Triple B Homes, among others.\n\nWe hold 2mm General and 2mm occurance insurance and can provice any additional information you may need to qualify us. We would love the opportunity to bid your upcoming work.\n\nYou may reach me directly at [user phone number] or [user email], or contact Malachi Whites at (830) 946-0050 or malachi@clickplumbing.com. Additional information about our company and capabilities is available at https://clickplumbing.com/.\n\nThank you again for your time and consideration. We look forward to the opportunity to work together. We want to bid your work!\n\nBest regards,'
),
(
  'prospect_copy_phone_followup_email',
  E'Hi I just spoke to _______, this is [User name] from Click Plumbing, Electrical, and HVAC,\n\nWe want to bid your work! Click Plumbing is actively seeking long-term trade partnerships and we see great value in the opportunity to support [company name]''s upcoming projects. Our RMP Master, Malachi Whites, has previously worked with D.R. Horton San Antonio, Ashton Woods, M/I Homes, Michael Holub Custom Homes, H&I Construction, and Triple B Homes, among others.\n\nWe hold 2mm General and 2mm occurance insurance and can provice any additional information you may need to qualify us. We would love the opportunity to bid your upcoming work.\n\nYou may reach me directly at [user phone number] or [user email], or contact Malachi Whites at (830) 946-0050 or malachi@clickplumbing.com. Additional information about our company and capabilities is available at https://clickplumbing.com/.\n\nThank you again for your time and consideration. We look forward to the opportunity to work together. We want to bid your work!'
),
(
  'prospect_copy_just_checking_in_email',
  E'Hi I''ve been trying to reach y''all at _______, this is [User name] from Click Plumbing, Electrical, and HVAC,\n\nWe want to bid your work! Click Plumbing is actively seeking long-term trade partnerships and we see great value in the opportunity to support [company name]''s upcoming projects. Our RMP Master, Malachi Whites, has previously worked with D.R. Horton San Antonio, Ashton Woods, M/I Homes, Michael Holub Custom Homes, H&I Construction, and Triple B Homes, among others.\n\nWe hold 2mm General and 2mm occurance insurance and can provice any additional information you may need to qualify us. We would love the opportunity to bid your upcoming work.\n\nYou may reach me directly at [user phone number] or [user email], or contact Malachi Whites at (830) 946-0050 or malachi@clickplumbing.com. Additional information about our company and capabilities is available at https://clickplumbing.com/.\n\nThank you again for your time and consideration. We look forward to the opportunity to work together. We want to bid your work!'
)
ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text;

-- 3. Create user_prospect_copy_templates for per-user overrides
CREATE TABLE IF NOT EXISTS public.user_prospect_copy_templates (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  value_text TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, template_key)
);

COMMENT ON TABLE public.user_prospect_copy_templates IS 'Per-user overrides for prospect copy templates (No Response, Phone followup, Just checking in). Fallback to app_settings defaults.';

ALTER TABLE public.user_prospect_copy_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prospect copy templates"
ON public.user_prospect_copy_templates
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_user_prospect_copy_templates_updated_at ON public.user_prospect_copy_templates;
CREATE TRIGGER update_user_prospect_copy_templates_updated_at
  BEFORE UPDATE ON public.user_prospect_copy_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
