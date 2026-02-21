-- Change show_until_completed default to true so new checklist items remind until complete by default
ALTER TABLE public.checklist_items
  ALTER COLUMN show_until_completed SET DEFAULT true;
