-- Split Quickfill Office checklist into Arriving + Leaving (separate items + done blobs).
INSERT INTO public.app_settings (key, value_text)
VALUES
  ('quickfill_office_arriving_items', '[]'),
  ('quickfill_office_arriving_done', '{}'),
  ('quickfill_office_leaving_items', '[]'),
  ('quickfill_office_leaving_done', '{}')
ON CONFLICT (key) DO NOTHING;

-- Copy legacy office checklist into Arriving (idempotent when legacy rows are already removed).
UPDATE public.app_settings AS a
SET value_text = l.value_text
FROM public.app_settings AS l
WHERE a.key = 'quickfill_office_arriving_items'
  AND l.key = 'quickfill_office_items';

UPDATE public.app_settings AS a
SET value_text = l.value_text
FROM public.app_settings AS l
WHERE a.key = 'quickfill_office_arriving_done'
  AND l.key = 'quickfill_office_done';

DELETE FROM public.app_settings
WHERE key IN ('quickfill_office_items', 'quickfill_office_done');

DROP POLICY IF EXISTS "authenticated_update_quickfill_office_done" ON public.app_settings;

CREATE POLICY "authenticated_update_quickfill_office_arriving_leaving_done"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key IN ('quickfill_office_arriving_done', 'quickfill_office_leaving_done'))
  WITH CHECK (key IN ('quickfill_office_arriving_done', 'quickfill_office_leaving_done'));
