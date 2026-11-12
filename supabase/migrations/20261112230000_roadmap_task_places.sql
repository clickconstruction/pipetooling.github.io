SET lock_timeout = '3s';

-- v2.7063 (punch list #328, PR 5 of 8): a roadmap task can carry a place.
--
-- 20261112220000 gave the task as written (checklist_items) a place. A roadmap task is written somewhere else, in
-- checklist_tech_tree_group_tasks, and reaches a person's list only when its stage unlocks: sync_roadmap_to_checklist
-- then makes a checklist_items row for it, and takes that row away again when the task falls back behind an earlier
-- one. A place set on the made row would be lost on that round trip. So the place lives on the roadmap task, where it
-- is planned, and the card reads it through the link (checklist_items.roadmap_group_task_id), the way it already
-- reads asks_for_photo. The sync function is not touched.
--
-- The same six columns and the same three checks as the task's own place.
--
-- Who may read and write: the row's own policies. Whoever may read the roadmap reads the place, and a task's
-- assignees may read their roadmap (20260825001101). Whoever may edit the roadmap's structure writes it.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, and each check is dropped before it is added.

ALTER TABLE public.checklist_tech_tree_group_tasks ADD COLUMN IF NOT EXISTS place_name text;
ALTER TABLE public.checklist_tech_tree_group_tasks ADD COLUMN IF NOT EXISTS place_lat double precision;
ALTER TABLE public.checklist_tech_tree_group_tasks ADD COLUMN IF NOT EXISTS place_lng double precision;
ALTER TABLE public.checklist_tech_tree_group_tasks ADD COLUMN IF NOT EXISTS place_accuracy_m integer;
ALTER TABLE public.checklist_tech_tree_group_tasks ADD COLUMN IF NOT EXISTS place_set_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.checklist_tech_tree_group_tasks ADD COLUMN IF NOT EXISTS place_set_at timestamptz;

COMMENT ON COLUMN public.checklist_tech_tree_group_tasks.place_name IS 'Task places (#328): the place''s name, "Pump house". Null with no place. The task''s card reads it through checklist_items.roadmap_group_task_id.';
COMMENT ON COLUMN public.checklist_tech_tree_group_tasks.place_lat IS 'Task places (#328): the place''s latitude. Set with place_lng or not at all.';
COMMENT ON COLUMN public.checklist_tech_tree_group_tasks.place_lng IS 'Task places (#328): the place''s longitude. Set with place_lat or not at all.';
COMMENT ON COLUMN public.checklist_tech_tree_group_tasks.place_accuracy_m IS 'Task places (#328): the phone''s margin in metres when the place was set from where the planner stood. Null when the map was dragged.';
COMMENT ON COLUMN public.checklist_tech_tree_group_tasks.place_set_by IS 'Task places (#328): who set the place.';
COMMENT ON COLUMN public.checklist_tech_tree_group_tasks.place_set_at IS 'Task places (#328): when the place was set.';

ALTER TABLE public.checklist_tech_tree_group_tasks DROP CONSTRAINT IF EXISTS checklist_tech_tree_group_tasks_place_point_check;
ALTER TABLE public.checklist_tech_tree_group_tasks ADD CONSTRAINT checklist_tech_tree_group_tasks_place_point_check CHECK (
  (place_lat IS NULL AND place_lng IS NULL)
  OR (place_lat BETWEEN -90 AND 90 AND place_lng BETWEEN -180 AND 180)
);

ALTER TABLE public.checklist_tech_tree_group_tasks DROP CONSTRAINT IF EXISTS checklist_tech_tree_group_tasks_place_whole_check;
ALTER TABLE public.checklist_tech_tree_group_tasks ADD CONSTRAINT checklist_tech_tree_group_tasks_place_whole_check CHECK (
  place_lat IS NOT NULL
  OR (place_name IS NULL AND place_accuracy_m IS NULL AND place_set_by IS NULL AND place_set_at IS NULL)
);

ALTER TABLE public.checklist_tech_tree_group_tasks DROP CONSTRAINT IF EXISTS checklist_tech_tree_group_tasks_place_accuracy_check;
ALTER TABLE public.checklist_tech_tree_group_tasks ADD CONSTRAINT checklist_tech_tree_group_tasks_place_accuracy_check CHECK (
  place_accuracy_m IS NULL OR place_accuracy_m >= 0
);
