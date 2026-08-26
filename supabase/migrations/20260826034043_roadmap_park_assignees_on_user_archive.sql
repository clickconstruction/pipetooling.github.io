SET lock_timeout = '3s';

-- Roadmap assignments follow user archiving (v2.2317).
--
-- Archiving a user (users.archived_at set by the archive-user edge function)
-- now drops them from every OPEN roadmap task: the rows move from
-- checklist_tech_tree_task_assignees into a parked copy, so the tasks fall
-- into the Plan view's "Needs a person" lane and the roadmap→checklist
-- bridge prunes their materialized Today items on the next sync. Restoring
-- the user (restore-user clears archived_at) re-adds each parked assignment
-- only where the task still exists, is still open, and has no current
-- assignee — a task someone else picked up while they were gone keeps its
-- new person. Parked rows are cleared on restore either way. Assignments on
-- completed tasks are never touched (history keeps its names).
--
-- One AFTER UPDATE trigger on public.users is the single choke point: it
-- fires no matter which path flips archived_at (edge function, merge-users,
-- manual SQL), atomically with the flip.

CREATE TABLE IF NOT EXISTS public.checklist_tech_tree_task_assignees_parked (
  task_id uuid NOT NULL REFERENCES public.checklist_tech_tree_group_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

COMMENT ON TABLE public.checklist_tech_tree_task_assignees_parked IS
  'Roadmap task assignments removed because the user was archived; consumed (restored or discarded) when the user is restored. Written only by the user-archive trigger.';

ALTER TABLE public.checklist_tech_tree_task_assignees_parked ENABLE ROW LEVEL SECURITY;

-- Read-only surface for the Roadmap audience (dev-only today, same as the
-- tab); all writes happen inside the SECURITY DEFINER trigger below, so no
-- client write policies exist.
DROP POLICY IF EXISTS "Devs read parked roadmap assignees" ON public.checklist_tech_tree_task_assignees_parked;
CREATE POLICY "Devs read parked roadmap assignees" ON public.checklist_tech_tree_task_assignees_parked
  FOR SELECT USING (public.is_dev());

CREATE OR REPLACE FUNCTION public.roadmap_assignees_follow_user_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN
    -- Archive: park + drop assignments on open tasks only.
    INSERT INTO public.checklist_tech_tree_task_assignees_parked (task_id, user_id, parked_at)
    SELECT a.task_id, a.user_id, now()
    FROM public.checklist_tech_tree_task_assignees a
    JOIN public.checklist_tech_tree_group_tasks t ON t.id = a.task_id
    WHERE a.user_id = NEW.id
      AND t.completed_at IS NULL
    ON CONFLICT (task_id, user_id) DO NOTHING;

    DELETE FROM public.checklist_tech_tree_task_assignees a
    USING public.checklist_tech_tree_group_tasks t
    WHERE t.id = a.task_id
      AND a.user_id = NEW.id
      AND t.completed_at IS NULL;

  ELSIF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN
    -- Restore: re-add only where the task is still open and nobody else
    -- took it; then clear the user's parked rows either way.
    INSERT INTO public.checklist_tech_tree_task_assignees (task_id, user_id)
    SELECT p.task_id, p.user_id
    FROM public.checklist_tech_tree_task_assignees_parked p
    JOIN public.checklist_tech_tree_group_tasks t ON t.id = p.task_id
    WHERE p.user_id = NEW.id
      AND t.completed_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.checklist_tech_tree_task_assignees a
        WHERE a.task_id = p.task_id
      )
    ON CONFLICT (task_id, user_id) DO NOTHING;

    DELETE FROM public.checklist_tech_tree_task_assignees_parked
    WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.roadmap_assignees_follow_user_archive() IS
  'users.archived_at set: park + remove the user''s assignments on open roadmap tasks. Cleared: restore parked assignments to tasks that are still open with zero current assignees, then discard the rest.';

REVOKE EXECUTE ON FUNCTION public.roadmap_assignees_follow_user_archive() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.roadmap_assignees_follow_user_archive() FROM anon;

DROP TRIGGER IF EXISTS roadmap_assignees_follow_user_archive ON public.users;
CREATE TRIGGER roadmap_assignees_follow_user_archive
  AFTER UPDATE OF archived_at ON public.users
  FOR EACH ROW
  WHEN (OLD.archived_at IS DISTINCT FROM NEW.archived_at)
  EXECUTE FUNCTION public.roadmap_assignees_follow_user_archive();

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
