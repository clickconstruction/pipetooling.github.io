-- Quickfill layout defaults in app_settings (dev-editable; all authenticated users read)
INSERT INTO public.app_settings (key, value_text)
VALUES ('quickfill_hidden_section_ids', '[]')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value_num)
VALUES ('quickfill_jobs_billing_min_hcp', 406)
ON CONFLICT (key) DO NOTHING;
