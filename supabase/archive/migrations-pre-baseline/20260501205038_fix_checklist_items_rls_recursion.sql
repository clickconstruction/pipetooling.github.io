-- Break RLS cycle: checklist_items SELECT referenced checklist_item_assignees while assignee
-- policies queried checklist_items under RLS (infinite recursion for estimator/sub/helpers).

CREATE OR REPLACE FUNCTION public.checklist_item_created_by_auth_user(p_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.checklist_items
    WHERE id = p_item_id
      AND created_by_user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.checklist_item_created_by_auth_user(uuid) IS 'True if checklist_items row exists with id = p_item_id and created_by_user_id = auth.uid(); bypasses RLS to avoid policy recursion.';

CREATE OR REPLACE FUNCTION public.checklist_instance_parent_item_created_by_auth_user(p_instance_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.checklist_instances cinst
    INNER JOIN public.checklist_items ci ON ci.id = cinst.checklist_item_id
    WHERE cinst.id = p_instance_id
      AND ci.created_by_user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.checklist_instance_parent_item_created_by_auth_user(uuid) IS 'True if instance parent checklist_items.created_by_user_id = auth.uid(); bypasses RLS to avoid policy recursion.';

GRANT EXECUTE ON FUNCTION public.checklist_item_created_by_auth_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checklist_item_created_by_auth_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.checklist_instance_parent_item_created_by_auth_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checklist_instance_parent_item_created_by_auth_user(uuid) TO service_role;

-- checklist_items: creator branch before assignee EXISTS (short-circuit common path)
DROP POLICY IF EXISTS "Users read checklist items where assigned" ON public.checklist_items;

CREATE POLICY "Users read checklist items where assigned"
  ON public.checklist_items FOR SELECT
  USING (
    public.is_dev_or_master_or_assistant()
    OR checklist_items.created_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.checklist_item_assignees cia
      WHERE cia.checklist_item_id = checklist_items.id
        AND cia.user_id = auth.uid()
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
      AND public.checklist_item_created_by_auth_user(checklist_item_assignees.checklist_item_id)
    )
  );

DROP POLICY IF EXISTS "Devs masters assistants primaries can insert checklist item assignees" ON public.checklist_item_assignees;

CREATE POLICY "Devs masters assistants primaries can insert checklist item assignees"
  ON public.checklist_item_assignees FOR INSERT
  WITH CHECK (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND public.checklist_item_created_by_auth_user(checklist_item_assignees.checklist_item_id)
    )
  );

DROP POLICY IF EXISTS "Devs masters assistants primaries can update checklist item assignees" ON public.checklist_item_assignees;

CREATE POLICY "Devs masters assistants primaries can update checklist item assignees"
  ON public.checklist_item_assignees FOR UPDATE
  USING (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND public.checklist_item_created_by_auth_user(checklist_item_assignees.checklist_item_id)
    )
  )
  WITH CHECK (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND public.checklist_item_created_by_auth_user(checklist_item_assignees.checklist_item_id)
    )
  );

DROP POLICY IF EXISTS "Devs masters assistants primaries can delete checklist item assignees" ON public.checklist_item_assignees;

CREATE POLICY "Devs masters assistants primaries can delete checklist item assignees"
  ON public.checklist_item_assignees FOR DELETE
  USING (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND public.checklist_item_created_by_auth_user(checklist_item_assignees.checklist_item_id)
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
      AND public.checklist_instance_parent_item_created_by_auth_user(checklist_instance_assignees.checklist_instance_id)
    )
  );

DROP POLICY IF EXISTS "Devs masters assistants primaries can insert checklist instance assignees" ON public.checklist_instance_assignees;

CREATE POLICY "Devs masters assistants primaries can insert checklist instance assignees"
  ON public.checklist_instance_assignees FOR INSERT
  WITH CHECK (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND public.checklist_instance_parent_item_created_by_auth_user(checklist_instance_assignees.checklist_instance_id)
    )
  );

DROP POLICY IF EXISTS "Devs masters assistants primaries can update checklist instance assignees" ON public.checklist_instance_assignees;

CREATE POLICY "Devs masters assistants primaries can update checklist instance assignees"
  ON public.checklist_instance_assignees FOR UPDATE
  USING (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND public.checklist_instance_parent_item_created_by_auth_user(checklist_instance_assignees.checklist_instance_id)
    )
  )
  WITH CHECK (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND public.checklist_instance_parent_item_created_by_auth_user(checklist_instance_assignees.checklist_instance_id)
    )
  );

DROP POLICY IF EXISTS "Devs masters assistants primaries can delete checklist instance assignees" ON public.checklist_instance_assignees;

CREATE POLICY "Devs masters assistants primaries can delete checklist instance assignees"
  ON public.checklist_instance_assignees FOR DELETE
  USING (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND public.checklist_instance_parent_item_created_by_auth_user(checklist_instance_assignees.checklist_instance_id)
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
    OR public.checklist_item_created_by_auth_user(checklist_instances.checklist_item_id)
  );

DROP POLICY IF EXISTS "Devs masters assistants can insert instances" ON public.checklist_instances;

CREATE POLICY "Devs masters assistants can insert instances"
  ON public.checklist_instances FOR INSERT
  WITH CHECK (
    public.is_dev_or_master_or_assistant()
    OR (
      public.can_define_task_style_checklist_items()
      AND public.checklist_item_created_by_auth_user(checklist_instances.checklist_item_id)
    )
  );
