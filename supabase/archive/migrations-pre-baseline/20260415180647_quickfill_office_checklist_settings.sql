-- Quickfill Office checklist: dev-managed task list + team-updatable completion map.
INSERT INTO public.app_settings (key, value_text)
VALUES
  ('quickfill_office_items', '[]'),
  ('quickfill_office_done', '{}')
ON CONFLICT (key) DO NOTHING;

-- Allow any authenticated user to update only the completion blob (Option B).
CREATE POLICY "authenticated_update_quickfill_office_done"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'quickfill_office_done')
  WITH CHECK (key = 'quickfill_office_done');
