-- Quickfill "Difficult people": daily checkbox per company calendar day (work_date).
-- Template rows stay in quickfill_difficult_people_items; check state in daily_checks.

CREATE TABLE public.quickfill_difficult_people_daily_checks (
  item_id uuid NOT NULL REFERENCES public.quickfill_difficult_people_items (id) ON DELETE CASCADE,
  work_date date NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by uuid REFERENCES public.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  PRIMARY KEY (item_id, work_date)
);

COMMENT ON TABLE public.quickfill_difficult_people_daily_checks IS 'Per-day checkbox for Quickfill difficult people template items (company calendar work_date).';

CREATE INDEX quickfill_difficult_people_daily_checks_work_date_idx
  ON public.quickfill_difficult_people_daily_checks (work_date);

ALTER TABLE public.quickfill_difficult_people_daily_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quickfill_difficult_people_daily_checks_select_staff"
  ON public.quickfill_difficult_people_daily_checks
  FOR SELECT
  TO authenticated
  USING (public.is_dev_or_master_or_assistant());

CREATE POLICY "quickfill_difficult_people_daily_checks_insert_staff"
  ON public.quickfill_difficult_people_daily_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_dev_or_master_or_assistant()
    AND checked_by = auth.uid()
  );

CREATE POLICY "quickfill_difficult_people_daily_checks_delete_staff"
  ON public.quickfill_difficult_people_daily_checks
  FOR DELETE
  TO authenticated
  USING (public.is_dev_or_master_or_assistant());

GRANT SELECT, INSERT, DELETE ON public.quickfill_difficult_people_daily_checks TO authenticated;

-- Remove permanent completion on template items; staff use daily_checks only.
DROP TRIGGER IF EXISTS quickfill_difficult_people_items_non_dev_update_guard_trg
  ON public.quickfill_difficult_people_items;

DROP FUNCTION IF EXISTS public.quickfill_difficult_people_items_non_dev_update_guard();

DROP INDEX IF EXISTS public.quickfill_difficult_people_items_open_created_idx;

ALTER TABLE public.quickfill_difficult_people_items
  DROP CONSTRAINT IF EXISTS quickfill_difficult_people_items_completed_pair_ck;

ALTER TABLE public.quickfill_difficult_people_items
  DROP COLUMN IF EXISTS completed_at,
  DROP COLUMN IF EXISTS completed_by;

COMMENT ON TABLE public.quickfill_difficult_people_items IS 'Quickfill difficult people template rows (person + action + reason; dev CRUD). Daily check state in quickfill_difficult_people_daily_checks.';

DROP POLICY IF EXISTS "quickfill_difficult_people_items_update_staff"
  ON public.quickfill_difficult_people_items;

CREATE POLICY "quickfill_difficult_people_items_update_dev"
  ON public.quickfill_difficult_people_items
  FOR UPDATE
  TO authenticated
  USING (public.is_dev())
  WITH CHECK (public.is_dev());
