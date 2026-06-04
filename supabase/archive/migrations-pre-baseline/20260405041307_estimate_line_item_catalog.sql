-- Company-wide catalog of preset estimate line items (JSON array in value_text). Dev-editable in Settings.
INSERT INTO public.app_settings (key, value_text)
VALUES ('estimate_line_item_catalog', '[]')
ON CONFLICT (key) DO NOTHING;
