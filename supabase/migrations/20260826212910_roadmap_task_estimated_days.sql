SET lock_timeout = '3s';

-- Task effort estimates for the roadmap Timeline (Tier 1 of the
-- effort-weighted Timeline design; client lands separately).
--
-- estimated_days is a task's WEIGHT, never its dates: the Timeline's x-axis
-- stays dependency sequence and the calendar band stays derived from
-- observed pace — this column just makes slot widths proportional and the
-- forecast count days-of-work instead of task tallies. NULL = "average
-- task" (the roadmap's mean estimate; 1.0 when nothing is estimated), so a
-- roadmap with no estimates computes exactly what it does today. Additive:
-- existing task RLS covers it, old clients ignore it.
ALTER TABLE public.checklist_tech_tree_group_tasks
  ADD COLUMN IF NOT EXISTS estimated_days numeric;

COMMENT ON COLUMN public.checklist_tech_tree_group_tasks.estimated_days IS
  'Optional effort estimate in days (half-day granularity by convention). Weight for the Timeline''s slot widths and pace forecast — never a schedule. NULL = roadmap-average weight.';

-- Positive, sane ceiling (a "task" above 90 days is a stage in disguise).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'checklist_tech_tree_group_tasks_estimated_days_range'
      AND conrelid = 'public.checklist_tech_tree_group_tasks'::regclass
  ) THEN
    ALTER TABLE public.checklist_tech_tree_group_tasks
      ADD CONSTRAINT checklist_tech_tree_group_tasks_estimated_days_range
      CHECK (estimated_days IS NULL OR (estimated_days > 0 AND estimated_days <= 90));
  END IF;
END $$;
