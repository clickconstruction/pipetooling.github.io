SET lock_timeout = '3s';

-- Checklist materialization groundwork (v2.2055): one occurrence per item per
-- day, enforced. Every creator (Add modal, Edit regeneration, cron top-up,
-- completion chaining) becomes idempotent by construction via
-- ON CONFLICT / upsert against this index.
--
-- Prod was verified duplicate-free (2,599 rows, 0 dupes, 2026-08-21), but the
-- dedupe below keeps this migration safe to run anywhere: among duplicates it
-- keeps the row most worth keeping (completed > has assignees > oldest).

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY checklist_item_id, scheduled_date
           ORDER BY (completed_at IS NOT NULL) DESC,
                    (EXISTS (SELECT 1 FROM public.checklist_instance_assignees a WHERE a.checklist_instance_id = checklist_instances.id)) DESC,
                    created_at ASC
         ) AS rn
  FROM public.checklist_instances
)
DELETE FROM public.checklist_instances
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS checklist_instances_item_date_uniq
  ON public.checklist_instances (checklist_item_id, scheduled_date);
