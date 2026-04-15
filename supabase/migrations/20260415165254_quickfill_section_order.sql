-- Quickfill section order: dev-editable JSON array of section_id strings in display order.
-- Empty array means "default SECTIONS order" on the client.
INSERT INTO public.app_settings (key, value_text)
VALUES ('quickfill_section_order', '[]')
ON CONFLICT (key) DO NOTHING;
