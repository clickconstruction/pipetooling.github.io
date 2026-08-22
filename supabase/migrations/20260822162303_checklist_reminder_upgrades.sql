SET lock_timeout = '3s';

-- v2.2096: reminder upgrades on checklist items.
-- remind_day_before: also send the reminder the day BEFORE an instance is due.
-- escalate_after_days: when an instance is still incomplete this many days past
-- its due date, the daily reminder starts copying the item's creator
-- (created_by_user_id). NULL = never escalate.
ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS remind_day_before boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalate_after_days integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checklist_items_escalate_after_days_check'
  ) THEN
    ALTER TABLE public.checklist_items
      ADD CONSTRAINT checklist_items_escalate_after_days_check
      CHECK (escalate_after_days IS NULL OR escalate_after_days >= 1);
  END IF;
END $$;

COMMENT ON COLUMN public.checklist_items.remind_day_before IS 'Scheduled reminder also fires the day before an instance is due (v2.2096).';
COMMENT ON COLUMN public.checklist_items.escalate_after_days IS 'Days past due after which the daily reminder also notifies created_by_user_id; NULL = never (v2.2096).';
