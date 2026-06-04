-- Quickfill Office Arriving: per-day checkbox state (company calendar work_date).
-- Template checklist stays in app_settings.quickfill_office_arriving_items; leaving still uses quickfill_office_leaving_done JSON.

CREATE TABLE public.quickfill_office_arriving_daily_checks (
  item_id text NOT NULL,
  work_date date NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by uuid REFERENCES public.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  PRIMARY KEY (item_id, work_date)
);

COMMENT ON TABLE public.quickfill_office_arriving_daily_checks IS 'Per-day Quickfill Office Arriving checklist checks (company calendar work_date); item_id matches OfficeItem.id in quickfill_office_arriving_items JSON.';

CREATE INDEX quickfill_office_arriving_daily_checks_work_date_idx
  ON public.quickfill_office_arriving_daily_checks (work_date);

ALTER TABLE public.quickfill_office_arriving_daily_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quickfill_office_arriving_daily_checks_select_staff"
  ON public.quickfill_office_arriving_daily_checks
  FOR SELECT
  TO authenticated
  USING (public.is_dev_or_master_or_assistant());

CREATE POLICY "quickfill_office_arriving_daily_checks_insert_staff"
  ON public.quickfill_office_arriving_daily_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_dev_or_master_or_assistant()
    AND checked_by = auth.uid()
  );

CREATE POLICY "quickfill_office_arriving_daily_checks_delete_staff"
  ON public.quickfill_office_arriving_daily_checks
  FOR DELETE
  TO authenticated
  USING (public.is_dev_or_master_or_assistant());

GRANT SELECT, INSERT, DELETE ON public.quickfill_office_arriving_daily_checks TO authenticated;

-- Arriving done JSON is no longer updated by clients; leaving JSON still is.
DROP POLICY IF EXISTS "authenticated_update_quickfill_office_arriving_leaving_done"
  ON public.app_settings;

CREATE POLICY "authenticated_update_quickfill_office_leaving_done"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'quickfill_office_leaving_done')
  WITH CHECK (key = 'quickfill_office_leaving_done');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'quickfill_office_arriving_daily_checks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quickfill_office_arriving_daily_checks;
  END IF;
END $$;
