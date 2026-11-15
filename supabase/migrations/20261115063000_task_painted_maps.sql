SET lock_timeout = '3s';

-- v2.7340 (punch list #345, step 5, the column): a task carries a painted map.
--
-- A task's place is a dot (#328). A dot says where the work is and not how to reach it: which gate, which side of
-- the building, where the drive that is on no map runs. A painted map says that. This lets a task point at one.
--
--   1. painted_map_id on the task as written (checklist_items) and on the roadmap task
--      (checklist_tech_tree_group_tasks), beside the place each already carries. A repeating task keeps its map every
--      day, and a roadmap task keeps it while its made row comes and goes, the way each keeps its place.
--   2. Whoever can read the task can read the map it carries. A task has no job, and the person it is given to may be
--      on no job's crew, so the map's own gate (its job, its development, its maker) would turn them away. One more
--      SELECT policy on painted_maps answers yes when a task the caller reads points at the map.
--   3. A guard on both task tables: a task may point only at a map its writer can already read. Without it, anyone
--      who may write a task could point one at a map they cannot open and so open it.
--
-- No screen reads or writes the column yet. Nothing changes for a task with no map: the column is null.
--
-- A map thrown away leaves its tasks standing, with no map (ON DELETE SET NULL).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, CREATE OR REPLACE, and the policy and the
-- triggers are dropped before they are made.

-- 1. The column, on both homes of a task.
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS painted_map_id uuid REFERENCES public.painted_maps(id) ON DELETE SET NULL;
ALTER TABLE public.checklist_tech_tree_group_tasks ADD COLUMN IF NOT EXISTS painted_map_id uuid REFERENCES public.painted_maps(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.checklist_items.painted_map_id IS 'Paint a map (#345): the painted map this task carries, the way to its place. Null with no map. Whoever reads the task reads the map.';
COMMENT ON COLUMN public.checklist_tech_tree_group_tasks.painted_map_id IS 'Paint a map (#345): the painted map this roadmap task carries. Null with no map. The task''s card reads it through checklist_items.roadmap_group_task_id, as it reads the place.';

-- The policy below asks "does a task point at this map" for every map a person reads, and a map thrown away sets
-- its tasks' pointers null: both look a task up by its map.
CREATE INDEX IF NOT EXISTS checklist_items_painted_map_idx ON public.checklist_items (painted_map_id) WHERE painted_map_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS checklist_tech_tree_group_tasks_painted_map_idx ON public.checklist_tech_tree_group_tasks (painted_map_id) WHERE painted_map_id IS NOT NULL;

-- 2. The gate. SECURITY INVOKER on purpose: both reads run under the caller's own RLS, so "a task I can read" is
--    decided by the task tables' own policies and nowhere else. The office, a task's maker and the people it is
--    given to read a task; whoever may read a roadmap, its tasks' assignees among them, reads a roadmap task.
CREATE OR REPLACE FUNCTION public.painted_map_on_a_task_i_read(p_map_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND p_map_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.checklist_items i WHERE i.painted_map_id = p_map_id)
    OR EXISTS (SELECT 1 FROM public.checklist_tech_tree_group_tasks t WHERE t.painted_map_id = p_map_id)
  )
$$;
REVOKE ALL ON FUNCTION public.painted_map_on_a_task_i_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painted_map_on_a_task_i_read(uuid) TO authenticated;
COMMENT ON FUNCTION public.painted_map_on_a_task_i_read(uuid) IS 'Paint a map (#345): true when a task or a roadmap task the caller can read carries this map. Read under the caller''s own RLS.';

-- Permissive, beside painted_maps_select: either one opens the map. A line, a place, a photo and a link's row each
-- follow their map through an EXISTS on painted_maps, so they open with it. Renaming, moving and throwing a map away
-- stay its maker's and the office's: those policies are not touched.
DROP POLICY IF EXISTS painted_maps_select_on_a_task ON public.painted_maps;
CREATE POLICY painted_maps_select_on_a_task ON public.painted_maps FOR SELECT TO authenticated
  USING (public.painted_map_on_a_task_i_read(id));

-- 3. The guard. SECURITY INVOKER on purpose: the read of painted_maps runs under the writer's own RLS, before the
--    row is written, so the task being written cannot vouch for itself. It fires only when the pointer is set or
--    moved. Clearing it, and the SET NULL of a map thrown away, pass.
CREATE OR REPLACE FUNCTION public.task_painted_map_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.painted_map_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.painted_map_id IS NOT DISTINCT FROM OLD.painted_map_id THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id = NEW.painted_map_id) THEN
    RAISE EXCEPTION 'That map cannot go on a task. It is not a map you can open.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.task_painted_map_guard() IS 'Paint a map (#345): a task or a roadmap task may point only at a painted map its writer can read.';

DROP TRIGGER IF EXISTS checklist_items_painted_map_guard ON public.checklist_items;
CREATE TRIGGER checklist_items_painted_map_guard
  BEFORE INSERT OR UPDATE OF painted_map_id ON public.checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.task_painted_map_guard();

DROP TRIGGER IF EXISTS checklist_tech_tree_group_tasks_painted_map_guard ON public.checklist_tech_tree_group_tasks;
CREATE TRIGGER checklist_tech_tree_group_tasks_painted_map_guard
  BEFORE INSERT OR UPDATE OF painted_map_id ON public.checklist_tech_tree_group_tasks
  FOR EACH ROW EXECUTE FUNCTION public.task_painted_map_guard();
