-- Checklist Roadmap / tech tree: named groups, tasks with assignees, prerequisite edges (DAG).

CREATE TABLE public.checklist_tech_tree_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  sort_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.checklist_tech_tree_groups IS 'Roadmap groups (tech tree nodes). Title is user-facing.';

CREATE TABLE public.checklist_tech_tree_group_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.checklist_tech_tree_groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_index integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  completed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.checklist_tech_tree_group_tasks IS 'Tasks within a roadmap group. completed_at set when the task is done.';

CREATE TABLE public.checklist_tech_tree_task_assignees (
  task_id uuid NOT NULL REFERENCES public.checklist_tech_tree_group_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id)
);

COMMENT ON TABLE public.checklist_tech_tree_task_assignees IS 'Users assigned to a roadmap task (for visibility and completion).';

CREATE TABLE public.checklist_tech_tree_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_group_id uuid NOT NULL REFERENCES public.checklist_tech_tree_groups(id) ON DELETE CASCADE,
  to_group_id uuid NOT NULL REFERENCES public.checklist_tech_tree_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_group_id <> to_group_id),
  UNIQUE (from_group_id, to_group_id)
);

COMMENT ON TABLE public.checklist_tech_tree_edges IS 'Prerequisite: to_group is locked until from_group is complete. Edge from->to.';

CREATE INDEX checklist_tech_tree_group_tasks_group_id_idx
  ON public.checklist_tech_tree_group_tasks (group_id);

CREATE INDEX checklist_tech_tree_edges_from_idx
  ON public.checklist_tech_tree_edges (from_group_id);

CREATE INDEX checklist_tech_tree_edges_to_idx
  ON public.checklist_tech_tree_edges (to_group_id);

-- RLS: authenticated users can read the roadmap; managers edit structure; assignees (or staff) can complete tasks.

ALTER TABLE public.checklist_tech_tree_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_tech_tree_group_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_tech_tree_task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_tech_tree_edges ENABLE ROW LEVEL SECURITY;

-- checklist_tech_tree_groups
CREATE POLICY "checklist_tech_tree_groups select authenticated"
ON public.checklist_tech_tree_groups FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "checklist_tech_tree_groups insert staff"
ON public.checklist_tech_tree_groups FOR INSERT
TO authenticated
WITH CHECK (public.is_dev_or_master_or_assistant());

CREATE POLICY "checklist_tech_tree_groups update staff"
ON public.checklist_tech_tree_groups FOR UPDATE
TO authenticated
USING (public.is_dev_or_master_or_assistant())
WITH CHECK (public.is_dev_or_master_or_assistant());

CREATE POLICY "checklist_tech_tree_groups delete staff"
ON public.checklist_tech_tree_groups FOR DELETE
TO authenticated
USING (public.is_dev_or_master_or_assistant());

-- checklist_tech_tree_group_tasks
CREATE POLICY "checklist_tech_tree_group_tasks select authenticated"
ON public.checklist_tech_tree_group_tasks FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "checklist_tech_tree_group_tasks insert staff"
ON public.checklist_tech_tree_group_tasks FOR INSERT
TO authenticated
WITH CHECK (public.is_dev_or_master_or_assistant());

CREATE POLICY "checklist_tech_tree_group_tasks update staff or assignee"
ON public.checklist_tech_tree_group_tasks FOR UPDATE
TO authenticated
USING (
  public.is_dev_or_master_or_assistant()
  OR EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_task_assignees a
    WHERE a.task_id = checklist_tech_tree_group_tasks.id
      AND a.user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_dev_or_master_or_assistant()
  OR EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_task_assignees a
    WHERE a.task_id = checklist_tech_tree_group_tasks.id
      AND a.user_id = auth.uid()
  )
);

CREATE POLICY "checklist_tech_tree_group_tasks delete staff"
ON public.checklist_tech_tree_group_tasks FOR DELETE
TO authenticated
USING (public.is_dev_or_master_or_assistant());

-- checklist_tech_tree_task_assignees
CREATE POLICY "checklist_tech_tree_task_assignees select authenticated"
ON public.checklist_tech_tree_task_assignees FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "checklist_tech_tree_task_assignees write staff"
ON public.checklist_tech_tree_task_assignees FOR INSERT
TO authenticated
WITH CHECK (public.is_dev_or_master_or_assistant());

CREATE POLICY "checklist_tech_tree_task_assignees update staff"
ON public.checklist_tech_tree_task_assignees FOR UPDATE
TO authenticated
USING (public.is_dev_or_master_or_assistant())
WITH CHECK (public.is_dev_or_master_or_assistant());

CREATE POLICY "checklist_tech_tree_task_assignees delete staff"
ON public.checklist_tech_tree_task_assignees FOR DELETE
TO authenticated
USING (public.is_dev_or_master_or_assistant());

-- checklist_tech_tree_edges
CREATE POLICY "checklist_tech_tree_edges select authenticated"
ON public.checklist_tech_tree_edges FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "checklist_tech_tree_edges write staff"
ON public.checklist_tech_tree_edges FOR INSERT
TO authenticated
WITH CHECK (public.is_dev_or_master_or_assistant());

CREATE POLICY "checklist_tech_tree_edges update staff"
ON public.checklist_tech_tree_edges FOR UPDATE
TO authenticated
USING (public.is_dev_or_master_or_assistant())
WITH CHECK (public.is_dev_or_master_or_assistant());

CREATE POLICY "checklist_tech_tree_edges delete staff"
ON public.checklist_tech_tree_edges FOR DELETE
TO authenticated
USING (public.is_dev_or_master_or_assistant());
