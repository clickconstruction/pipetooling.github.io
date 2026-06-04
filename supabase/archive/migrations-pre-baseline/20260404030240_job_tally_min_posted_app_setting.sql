-- Org-wide minimum posted date for Job Parts Tally (Chicago calendar day); empty = no floor. Dev-editable in Settings.
INSERT INTO public.app_settings (key, value_text)
VALUES ('job_tally_min_posted_ymd', '')
ON CONFLICT (key) DO NOTHING;
