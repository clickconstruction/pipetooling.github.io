-- Per-item scheduled reminders (dev-only). Times are CST (America/Chicago).
ALTER TABLE public.checklist_items
  ADD COLUMN reminder_time time,
  ADD COLUMN reminder_scope text CHECK (reminder_scope IN ('today_only', 'today_and_overdue'));

COMMENT ON COLUMN public.checklist_items.reminder_time IS 'CST time to send reminder if assignee has incomplete instances. Dev-only.';
COMMENT ON COLUMN public.checklist_items.reminder_scope IS 'today_only = scheduled_date = today; today_and_overdue = scheduled_date <= today.';
