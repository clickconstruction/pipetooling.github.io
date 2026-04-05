-- Public estimate Terms and Conditions page body (dev-editable). Served to anonymous users via Edge Function.
INSERT INTO public.app_settings (key, value_text)
VALUES ('estimate_public_terms_body', '')
ON CONFLICT (key) DO NOTHING;
