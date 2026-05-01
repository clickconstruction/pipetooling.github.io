-- Subcontractor, helpers, estimator: create checklist items via header Task modal.
-- Uses a narrow helper — do not widen is_dev_or_master_or_assistant() (Quickfill marks, tech tree, etc.).
-- Field staff may only mutate checklist rows for items they created (created_by_user_id).

CREATE OR REPLACE FUNCTION public.can_define_task_style_checklist_items()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.archived_at IS NULL
      AND u.role::text IN ('subcontractor', 'helpers', 'estimator')
  );
$$;

COMMENT ON FUNCTION public.can_define_task_style_checklist_items() IS 'True when the current user may define checklist items via Task (subcontractor, helpers, estimator).';

-- checklist_items
DROP POLICY IF EXISTS "Users read checklist items where assigned" ON public.checklist_items;

CREATE POLICY "Users read checklist items where assigned"
  ON public.checklist_items FOR SELECT
  USING (
    public.is_dev_or_master_or_assistant()
    OR EXISTS (
      SELECT 1
      FROM public.checklist_item_assignees cia
      WHERE cia.checklist_item_id = checklist_items.id
        AND cia.user_id = auth.uid()
    )
    OR checklist_items.created_by_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Devs masters assistants can insert checklist items" ON public.checklist_items;

CREATE POLICY "Devs masters assistants can insert checklist items"
  ON public.checklist_items FOR INSERT
  WITH CHECK (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND checklist_items.created_by_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Devs masters assistants can update checklist items" ON public.checklist_items;

CREATE POLICY "Devs masters assistants can update checklist items"
  ON public.checklist_items FOR UPDATE
  USING (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND checklist_items.created_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND checklist_items.created_by_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Devs masters assistants can delete checklist items" ON public.checklist_items;

CREATE POLICY "Devs masters assistants can delete checklist items"
  ON public.checklist_items FOR DELETE
  USING (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND checklist_items.created_by_user_id = auth.uid()
    )
  );

-- checklist_item_assignees
DROP POLICY IF EXISTS "Devs masters assistants primaries can read checklist item assignees" ON public.checklist_item_assignees;

CREATE POLICY "Devs masters assistants primaries can read checklist item assignees"
  ON public.checklist_item_assignees FOR SELECT
  USING (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND EXISTS (
        SELECT 1
        FROM public.checklist_items ci
        WHERE ci.id = checklist_item_assignees.checklist_item_id
          AND ci.created_by_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Devs masters assistants primaries can insert checklist item assignees" ON public.checklist_item_assignees;

CREATE POLICY "Devs masters assistants primaries can insert checklist item assignees"
  ON public.checklist_item_assignees FOR INSERT
  WITH CHECK (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND EXISTS (
        SELECT 1
        FROM public.checklist_items ci
        WHERE ci.id = checklist_item_assignees.checklist_item_id
          AND ci.created_by_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Devs masters assistants primaries can update checklist item assignees" ON public.checklist_item_assignees;

CREATE POLICY "Devs masters assistants primaries can update checklist item assignees"
  ON public.checklist_item_assignees FOR UPDATE
  USING (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND EXISTS (
        SELECT 1
        FROM public.checklist_items ci
        WHERE ci.id = checklist_item_assignees.checklist_item_id
          AND ci.created_by_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND EXISTS (
        SELECT 1
        FROM public.checklist_items ci
        WHERE ci.id = checklist_item_assignees.checklist_item_id
          AND ci.created_by_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Devs masters assistants primaries can delete checklist item assignees" ON public.checklist_item_assignees;

CREATE POLICY "Devs masters assistants primaries can delete checklist item assignees"
  ON public.checklist_item_assignees FOR DELETE
  USING (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND EXISTS (
        SELECT 1
        FROM public.checklist_items ci
        WHERE ci.id = checklist_item_assignees.checklist_item_id
          AND ci.created_by_user_id = auth.uid()
      )
    )
  );

-- checklist_instance_assignees
DROP POLICY IF EXISTS "Devs masters assistants primaries can read checklist instance assignees" ON public.checklist_instance_assignees;

CREATE POLICY "Devs masters assistants primaries can read checklist instance assignees"
  ON public.checklist_instance_assignees FOR SELECT
  USING (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND EXISTS (
        SELECT 1
        FROM public.checklist_instances cinst
        JOIN public.checklist_items ci ON ci.id = cinst.checklist_item_id
        WHERE cinst.id = checklist_instance_assignees.checklist_instance_id
          AND ci.created_by_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Devs masters assistants primaries can insert checklist instance assignees" ON public.checklist_instance_assignees;

CREATE POLICY "Devs masters assistants primaries can insert checklist instance assignees"
  ON public.checklist_instance_assignees FOR INSERT
  WITH CHECK (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND EXISTS (
        SELECT 1
        FROM public.checklist_instances cinst
        JOIN public.checklist_items ci ON ci.id = cinst.checklist_item_id
        WHERE cinst.id = checklist_instance_assignees.checklist_instance_id
          AND ci.created_by_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Devs masters assistants primaries can update checklist instance assignees" ON public.checklist_instance_assignees;

CREATE POLICY "Devs masters assistants primaries can update checklist instance assignees"
  ON public.checklist_instance_assignees FOR UPDATE
  USING (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND EXISTS (
        SELECT 1
        FROM public.checklist_instances cinst
        JOIN public.checklist_items ci ON ci.id = cinst.checklist_item_id
        WHERE cinst.id = checklist_instance_assignees.checklist_instance_id
          AND ci.created_by_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND EXISTS (
        SELECT 1
        FROM public.checklist_instances cinst
        JOIN public.checklist_items ci ON ci.id = cinst.checklist_item_id
        WHERE cinst.id = checklist_instance_assignees.checklist_instance_id
          AND ci.created_by_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Devs masters assistants primaries can delete checklist instance assignees" ON public.checklist_instance_assignees;

CREATE POLICY "Devs masters assistants primaries can delete checklist instance assignees"
  ON public.checklist_instance_assignees FOR DELETE
  USING (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND EXISTS (
        SELECT 1
        FROM public.checklist_instances cinst
        JOIN public.checklist_items ci ON ci.id = cinst.checklist_item_id
        WHERE cinst.id = checklist_instance_assignees.checklist_instance_id
          AND ci.created_by_user_id = auth.uid()
      )
    )
  );

-- checklist_instances
DROP POLICY IF EXISTS "Users read instances where assigned or dev master assistant" ON public.checklist_instances;

CREATE POLICY "Users read instances where assigned or dev master assistant"
  ON public.checklist_instances FOR SELECT
  USING (
    public.is_dev_or_master_or_assistant()
    OR EXISTS (
      SELECT 1
      FROM public.checklist_instance_assignees cia
      WHERE cia.checklist_instance_id = checklist_instances.id
        AND cia.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.checklist_items ci
      WHERE ci.id = checklist_instances.checklist_item_id
        AND ci.created_by_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Devs masters assistants can insert instances" ON public.checklist_instances;

CREATE POLICY "Devs masters assistants can insert instances"
  ON public.checklist_instances FOR INSERT
  WITH CHECK (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND EXISTS (
        SELECT 1
        FROM public.checklist_items ci
        WHERE ci.id = checklist_instances.checklist_item_id
          AND ci.created_by_user_id = auth.uid()
      )
    )
  );
