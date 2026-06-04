-- Add subject line support for prospect copy templates

-- 1. Add subject_text to user_prospect_copy_templates
ALTER TABLE public.user_prospect_copy_templates ADD COLUMN IF NOT EXISTS subject_text TEXT;
-- 2. Add app_settings keys for subject defaults
INSERT INTO public.app_settings (key, value_text) VALUES
  ('prospect_copy_no_response_email_subject', 'Follow up - [company name]'),
  ('prospect_copy_phone_followup_email_subject', 'Re: [company name]'),
  ('prospect_copy_just_checking_in_email_subject', 'Re: [company name]')
ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text;
