-- Per-user display order for checklist items. Lower = higher in list.
-- New items go to bottom; dev/master/assistant can reorder via up/down in Review tab.

ALTER TABLE public.checklist_item_assignees ADD COLUMN display_order integer;

-- Backfill: assign sequential order per user (by checklist_item created_at, then id)
WITH ranked AS (
  SELECT cia.checklist_item_id, cia.user_id,
    ROW_NUMBER() OVER (PARTITION BY cia.user_id ORDER BY ci.created_at, cia.checklist_item_id) AS rn
  FROM public.checklist_item_assignees cia
  JOIN public.checklist_items ci ON ci.id = cia.checklist_item_id
)
UPDATE public.checklist_item_assignees cia
SET display_order = ranked.rn
FROM ranked
WHERE cia.checklist_item_id = ranked.checklist_item_id AND cia.user_id = ranked.user_id;

-- Default for new rows (bottom of list until explicitly set)
ALTER TABLE public.checklist_item_assignees ALTER COLUMN display_order SET DEFAULT 999999;
ALTER TABLE public.checklist_item_assignees ALTER COLUMN display_order SET NOT NULL;

COMMENT ON COLUMN public.checklist_item_assignees.display_order IS 'Per-user sort order. Lower = higher in list. New items default to bottom.';
