-- Change repeat_day_of_week (single) to repeat_days_of_week (array) for multiple day selection
ALTER TABLE public.checklist_items ADD COLUMN repeat_days_of_week integer[];

-- Migrate existing data
UPDATE public.checklist_items 
SET repeat_days_of_week = ARRAY[repeat_day_of_week] 
WHERE repeat_type = 'day_of_week' AND repeat_day_of_week IS NOT NULL;

-- Drop old column
ALTER TABLE public.checklist_items DROP COLUMN repeat_day_of_week;

COMMENT ON COLUMN public.checklist_items.repeat_days_of_week IS '0=Sunday, 6=Saturday. Used when repeat_type = day_of_week. Array allows multiple days per week.';
