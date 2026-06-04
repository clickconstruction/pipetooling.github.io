-- Checklist Roadmap: multiple named roadmaps + membership (viewer / editor).
-- Backfills a single "Default" roadmap and viewer membership for all non-archived users.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.checklist_tech_tree_roadmaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  sort_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.checklist_tech_tree_roadmaps IS 'Named roadmap graph (container for tech tree groups).';

CREATE TABLE public.checklist_tech_tree_roadmap_members (
  roadmap_id uuid NOT NULL REFERENCES public.checklist_tech_tree_roadmaps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('viewer', 'editor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (roadmap_id, user_id)
);

COMMENT ON TABLE public.checklist_tech_tree_roadmap_members IS 'Who can open a roadmap; editors may edit structure and manage members (staff/primary bypass via RLS helpers).';

CREATE INDEX checklist_tech_tree_roadmap_members_user_id_idx
  ON public.checklist_tech_tree_roadmap_members (user_id);

-- ---------------------------------------------------------------------------
-- Backfill: nullable column, default roadmap, fill groups, members, NOT NULL
-- ---------------------------------------------------------------------------

ALTER TABLE public.checklist_tech_tree_groups
  ADD COLUMN roadmap_id uuid REFERENCES public.checklist_tech_tree_roadmaps(id) ON DELETE CASCADE;

INSERT INTO public.checklist_tech_tree_roadmaps (title, sort_index, created_by_user_id)
SELECT 'Default', 0, u.id
FROM public.users u
WHERE u.archived_at IS NULL
ORDER BY CASE u.role WHEN 'dev' THEN 0 WHEN 'master_technician' THEN 1 ELSE 2 END, u.id
LIMIT 1;

UPDATE public.checklist_tech_tree_groups g
SET roadmap_id = r.id
FROM (SELECT id FROM public.checklist_tech_tree_roadmaps WHERE title = 'Default' ORDER BY created_at LIMIT 1) r
WHERE g.roadmap_id IS NULL;

ALTER TABLE public.checklist_tech_tree_groups
  ALTER COLUMN roadmap_id SET NOT NULL;

CREATE INDEX checklist_tech_tree_groups_roadmap_id_idx
  ON public.checklist_tech_tree_groups (roadmap_id);

INSERT INTO public.checklist_tech_tree_roadmap_members (roadmap_id, user_id, role)
SELECT r.id, u.id, 'viewer'
FROM public.checklist_tech_tree_roadmaps r
CROSS JOIN public.users u
WHERE r.title = 'Default'
  AND u.archived_at IS NULL
ON CONFLICT (roadmap_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS helpers (SECURITY DEFINER; avoid recursion in member policies)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_checklist_tech_tree_staff_or_primary()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_dev_or_master_or_assistant()
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'primary'
      AND u.archived_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.is_checklist_tech_tree_staff_or_primary() IS 'Dev/master/assistant or primary; full roadmap access for RLS.';

CREATE OR REPLACE FUNCTION public.can_select_checklist_tech_tree_roadmap(p_roadmap_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_checklist_tech_tree_staff_or_primary()
  OR EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_roadmap_members m
    WHERE m.roadmap_id = p_roadmap_id
      AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_checklist_tech_tree_structure_for_roadmap(p_roadmap_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_checklist_tech_tree_staff_or_primary()
  OR EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_roadmap_members m
    WHERE m.roadmap_id = p_roadmap_id
      AND m.user_id = auth.uid()
      AND m.role = 'editor'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_checklist_tech_tree_roadmap_members(p_roadmap_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_checklist_tech_tree_staff_or_primary()
  OR EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_roadmap_members m
    WHERE m.roadmap_id = p_roadmap_id
      AND m.user_id = auth.uid()
      AND m.role = 'editor'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS: roadmaps + members
-- ---------------------------------------------------------------------------

ALTER TABLE public.checklist_tech_tree_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_tech_tree_roadmap_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_tech_tree_roadmaps select"
ON public.checklist_tech_tree_roadmaps FOR SELECT
TO authenticated
USING (public.can_select_checklist_tech_tree_roadmap(id));

CREATE POLICY "checklist_tech_tree_roadmaps insert staff primary"
ON public.checklist_tech_tree_roadmaps FOR INSERT
TO authenticated
WITH CHECK (
  public.is_checklist_tech_tree_staff_or_primary()
  AND created_by_user_id = auth.uid()
);

CREATE POLICY "checklist_tech_tree_roadmaps update"
ON public.checklist_tech_tree_roadmaps FOR UPDATE
TO authenticated
USING (public.can_edit_checklist_tech_tree_structure_for_roadmap(id))
WITH CHECK (public.can_edit_checklist_tech_tree_structure_for_roadmap(id));

CREATE POLICY "checklist_tech_tree_roadmaps delete staff primary"
ON public.checklist_tech_tree_roadmaps FOR DELETE
TO authenticated
USING (public.is_checklist_tech_tree_staff_or_primary());

CREATE POLICY "checklist_tech_tree_roadmap_members select"
ON public.checklist_tech_tree_roadmap_members FOR SELECT
TO authenticated
USING (public.can_select_checklist_tech_tree_roadmap(roadmap_id));

CREATE POLICY "checklist_tech_tree_roadmap_members insert"
ON public.checklist_tech_tree_roadmap_members FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_checklist_tech_tree_roadmap_members(roadmap_id));

CREATE POLICY "checklist_tech_tree_roadmap_members update"
ON public.checklist_tech_tree_roadmap_members FOR UPDATE
TO authenticated
USING (public.can_manage_checklist_tech_tree_roadmap_members(roadmap_id))
WITH CHECK (public.can_manage_checklist_tech_tree_roadmap_members(roadmap_id));

CREATE POLICY "checklist_tech_tree_roadmap_members delete"
ON public.checklist_tech_tree_roadmap_members FOR DELETE
TO authenticated
USING (public.can_manage_checklist_tech_tree_roadmap_members(roadmap_id));

-- ---------------------------------------------------------------------------
-- Replace tech tree policies (groups, tasks, assignees, edges)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "checklist_tech_tree_groups select authenticated" ON public.checklist_tech_tree_groups;
DROP POLICY IF EXISTS "checklist_tech_tree_groups insert staff" ON public.checklist_tech_tree_groups;
DROP POLICY IF EXISTS "checklist_tech_tree_groups update staff" ON public.checklist_tech_tree_groups;
DROP POLICY IF EXISTS "checklist_tech_tree_groups delete staff" ON public.checklist_tech_tree_groups;

CREATE POLICY "checklist_tech_tree_groups select"
ON public.checklist_tech_tree_groups FOR SELECT
TO authenticated
USING (public.can_select_checklist_tech_tree_roadmap(roadmap_id));

CREATE POLICY "checklist_tech_tree_groups insert"
ON public.checklist_tech_tree_groups FOR INSERT
TO authenticated
WITH CHECK (public.can_edit_checklist_tech_tree_structure_for_roadmap(roadmap_id));

CREATE POLICY "checklist_tech_tree_groups update"
ON public.checklist_tech_tree_groups FOR UPDATE
TO authenticated
USING (public.can_edit_checklist_tech_tree_structure_for_roadmap(roadmap_id))
WITH CHECK (public.can_edit_checklist_tech_tree_structure_for_roadmap(roadmap_id));

CREATE POLICY "checklist_tech_tree_groups delete"
ON public.checklist_tech_tree_groups FOR DELETE
TO authenticated
USING (public.can_edit_checklist_tech_tree_structure_for_roadmap(roadmap_id));

DROP POLICY IF EXISTS "checklist_tech_tree_group_tasks select authenticated" ON public.checklist_tech_tree_group_tasks;
DROP POLICY IF EXISTS "checklist_tech_tree_group_tasks insert staff" ON public.checklist_tech_tree_group_tasks;
DROP POLICY IF EXISTS "checklist_tech_tree_group_tasks update staff or assignee" ON public.checklist_tech_tree_group_tasks;
DROP POLICY IF EXISTS "checklist_tech_tree_group_tasks delete staff" ON public.checklist_tech_tree_group_tasks;

CREATE POLICY "checklist_tech_tree_group_tasks select"
ON public.checklist_tech_tree_group_tasks FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_groups g
    WHERE g.id = checklist_tech_tree_group_tasks.group_id
      AND public.can_select_checklist_tech_tree_roadmap(g.roadmap_id)
  )
);

CREATE POLICY "checklist_tech_tree_group_tasks insert"
ON public.checklist_tech_tree_group_tasks FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_groups g
    WHERE g.id = checklist_tech_tree_group_tasks.group_id
      AND public.can_edit_checklist_tech_tree_structure_for_roadmap(g.roadmap_id)
  )
);

CREATE POLICY "checklist_tech_tree_group_tasks update"
ON public.checklist_tech_tree_group_tasks FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_groups g
    WHERE g.id = checklist_tech_tree_group_tasks.group_id
      AND (
        public.can_edit_checklist_tech_tree_structure_for_roadmap(g.roadmap_id)
        OR (
          EXISTS (
            SELECT 1 FROM public.checklist_tech_tree_task_assignees a
            WHERE a.task_id = checklist_tech_tree_group_tasks.id
              AND a.user_id = auth.uid()
          )
          AND public.can_select_checklist_tech_tree_roadmap(g.roadmap_id)
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_groups g
    WHERE g.id = checklist_tech_tree_group_tasks.group_id
      AND (
        public.can_edit_checklist_tech_tree_structure_for_roadmap(g.roadmap_id)
        OR (
          EXISTS (
            SELECT 1 FROM public.checklist_tech_tree_task_assignees a
            WHERE a.task_id = checklist_tech_tree_group_tasks.id
              AND a.user_id = auth.uid()
          )
          AND public.can_select_checklist_tech_tree_roadmap(g.roadmap_id)
        )
      )
  )
);

CREATE POLICY "checklist_tech_tree_group_tasks delete"
ON public.checklist_tech_tree_group_tasks FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_groups g
    WHERE g.id = checklist_tech_tree_group_tasks.group_id
      AND public.can_edit_checklist_tech_tree_structure_for_roadmap(g.roadmap_id)
  )
);

DROP POLICY IF EXISTS "checklist_tech_tree_task_assignees select authenticated" ON public.checklist_tech_tree_task_assignees;
DROP POLICY IF EXISTS "checklist_tech_tree_task_assignees write staff" ON public.checklist_tech_tree_task_assignees;
DROP POLICY IF EXISTS "checklist_tech_tree_task_assignees update staff" ON public.checklist_tech_tree_task_assignees;
DROP POLICY IF EXISTS "checklist_tech_tree_task_assignees delete staff" ON public.checklist_tech_tree_task_assignees;

CREATE POLICY "checklist_tech_tree_task_assignees select"
ON public.checklist_tech_tree_task_assignees FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.checklist_tech_tree_group_tasks t
    JOIN public.checklist_tech_tree_groups g ON g.id = t.group_id
    WHERE t.id = checklist_tech_tree_task_assignees.task_id
      AND public.can_select_checklist_tech_tree_roadmap(g.roadmap_id)
  )
);

CREATE POLICY "checklist_tech_tree_task_assignees insert"
ON public.checklist_tech_tree_task_assignees FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.checklist_tech_tree_group_tasks t
    JOIN public.checklist_tech_tree_groups g ON g.id = t.group_id
    WHERE t.id = checklist_tech_tree_task_assignees.task_id
      AND public.can_edit_checklist_tech_tree_structure_for_roadmap(g.roadmap_id)
  )
);

CREATE POLICY "checklist_tech_tree_task_assignees update"
ON public.checklist_tech_tree_task_assignees FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.checklist_tech_tree_group_tasks t
    JOIN public.checklist_tech_tree_groups g ON g.id = t.group_id
    WHERE t.id = checklist_tech_tree_task_assignees.task_id
      AND public.can_edit_checklist_tech_tree_structure_for_roadmap(g.roadmap_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.checklist_tech_tree_group_tasks t
    JOIN public.checklist_tech_tree_groups g ON g.id = t.group_id
    WHERE t.id = checklist_tech_tree_task_assignees.task_id
      AND public.can_edit_checklist_tech_tree_structure_for_roadmap(g.roadmap_id)
  )
);

CREATE POLICY "checklist_tech_tree_task_assignees delete"
ON public.checklist_tech_tree_task_assignees FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.checklist_tech_tree_group_tasks t
    JOIN public.checklist_tech_tree_groups g ON g.id = t.group_id
    WHERE t.id = checklist_tech_tree_task_assignees.task_id
      AND public.can_edit_checklist_tech_tree_structure_for_roadmap(g.roadmap_id)
  )
);

DROP POLICY IF EXISTS "checklist_tech_tree_edges select authenticated" ON public.checklist_tech_tree_edges;
DROP POLICY IF EXISTS "checklist_tech_tree_edges write staff" ON public.checklist_tech_tree_edges;
DROP POLICY IF EXISTS "checklist_tech_tree_edges update staff" ON public.checklist_tech_tree_edges;
DROP POLICY IF EXISTS "checklist_tech_tree_edges delete staff" ON public.checklist_tech_tree_edges;

CREATE POLICY "checklist_tech_tree_edges select"
ON public.checklist_tech_tree_edges FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_groups gf
    WHERE gf.id = checklist_tech_tree_edges.from_group_id
      AND public.can_select_checklist_tech_tree_roadmap(gf.roadmap_id)
  )
  AND EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_groups gt
    WHERE gt.id = checklist_tech_tree_edges.to_group_id
      AND public.can_select_checklist_tech_tree_roadmap(gt.roadmap_id)
  )
);

CREATE POLICY "checklist_tech_tree_edges insert"
ON public.checklist_tech_tree_edges FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_groups gf
    WHERE gf.id = checklist_tech_tree_edges.from_group_id
      AND public.can_edit_checklist_tech_tree_structure_for_roadmap(gf.roadmap_id)
  )
  AND EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_groups gt
    WHERE gt.id = checklist_tech_tree_edges.to_group_id
      AND public.can_edit_checklist_tech_tree_structure_for_roadmap(gt.roadmap_id)
  )
  AND EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_groups gf
    JOIN public.checklist_tech_tree_groups gt ON gt.id = checklist_tech_tree_edges.to_group_id
    WHERE gf.id = checklist_tech_tree_edges.from_group_id
      AND gf.roadmap_id = gt.roadmap_id
  )
);

CREATE POLICY "checklist_tech_tree_edges update"
ON public.checklist_tech_tree_edges FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_groups gf
    WHERE gf.id = checklist_tech_tree_edges.from_group_id
      AND public.can_edit_checklist_tech_tree_structure_for_roadmap(gf.roadmap_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_groups gf
    WHERE gf.id = checklist_tech_tree_edges.from_group_id
      AND public.can_edit_checklist_tech_tree_structure_for_roadmap(gf.roadmap_id)
  )
);

CREATE POLICY "checklist_tech_tree_edges delete"
ON public.checklist_tech_tree_edges FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_groups gf
    WHERE gf.id = checklist_tech_tree_edges.from_group_id
      AND public.can_edit_checklist_tech_tree_structure_for_roadmap(gf.roadmap_id)
  )
);
