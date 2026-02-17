-- Add show_until_completed option: when true, overdue instances appear in Today until completed
ALTER TABLE public.checklist_items
ADD COLUMN show_until_completed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.checklist_items.show_until_completed IS 'When true, incomplete instances with past scheduled_date appear in Today view until completed.';
