-- Default dispatch phone for subcontractor Collect Payment step 2 (dev can override in Settings).

INSERT INTO public.app_settings (key, value_text)
VALUES ('field_dispatch_phone_v1', '+15123600599')
ON CONFLICT (key) DO NOTHING;
