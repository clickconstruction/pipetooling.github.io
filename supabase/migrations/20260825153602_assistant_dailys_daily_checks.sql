SET lock_timeout = '3s';

-- Quickfill "Assistant Dailys" (v2.2285): shared per-day checkbox state for the
-- any-assistant daily duties moved out of Taunya's personal checklist.
-- Template list lives in app_settings.quickfill_assistant_dailys_items (JSON,
-- dev-edited in place — covered by the existing "Devs can manage app settings"
-- policy); this table holds one row per (item, company-calendar day), so a box
-- is checked once for the whole office and checked_by records who did it.
-- Mirrors quickfill_office_arriving_daily_checks, minus the realtime
-- publication (that table's channel was later shed in 20260624160100; the
-- section refreshes on visibilitychange instead).

CREATE TABLE IF NOT EXISTS public.quickfill_assistant_dailys_daily_checks (
  item_id text NOT NULL,
  work_date date NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by uuid REFERENCES public.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  PRIMARY KEY (item_id, work_date)
);

COMMENT ON TABLE public.quickfill_assistant_dailys_daily_checks IS 'Per-day Quickfill Assistant Dailys checks (company calendar work_date); item_id matches the id in quickfill_assistant_dailys_items JSON. Shared across staff — one check per item per day.';

CREATE INDEX IF NOT EXISTS quickfill_assistant_dailys_daily_checks_work_date_idx
  ON public.quickfill_assistant_dailys_daily_checks (work_date);

ALTER TABLE public.quickfill_assistant_dailys_daily_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quickfill_assistant_dailys_daily_checks_select_staff"
  ON public.quickfill_assistant_dailys_daily_checks;
CREATE POLICY "quickfill_assistant_dailys_daily_checks_select_staff"
  ON public.quickfill_assistant_dailys_daily_checks
  FOR SELECT
  TO authenticated
  USING (public.is_dev_or_master_or_assistant());

DROP POLICY IF EXISTS "quickfill_assistant_dailys_daily_checks_insert_staff"
  ON public.quickfill_assistant_dailys_daily_checks;
CREATE POLICY "quickfill_assistant_dailys_daily_checks_insert_staff"
  ON public.quickfill_assistant_dailys_daily_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_dev_or_master_or_assistant()
    AND checked_by = auth.uid()
  );

DROP POLICY IF EXISTS "quickfill_assistant_dailys_daily_checks_delete_staff"
  ON public.quickfill_assistant_dailys_daily_checks;
CREATE POLICY "quickfill_assistant_dailys_daily_checks_delete_staff"
  ON public.quickfill_assistant_dailys_daily_checks
  FOR DELETE
  TO authenticated
  USING (public.is_dev_or_master_or_assistant());

GRANT SELECT, INSERT, DELETE ON public.quickfill_assistant_dailys_daily_checks TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
