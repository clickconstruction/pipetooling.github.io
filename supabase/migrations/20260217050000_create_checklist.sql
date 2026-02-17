-- Checklist: items and per-day instances for all roles
-- Devs, masters, assistants manage items; all users see their Today/History

-- Helper: true if current user is dev, master_technician, or assistant
CREATE OR REPLACE FUNCTION public.is_dev_or_master_or_assistant()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  );
$$;

COMMENT ON FUNCTION public.is_dev_or_master_or_assistant() IS 'Checks if current user can manage checklist items. Uses SECURITY DEFINER to bypass RLS.';

-- Checklist item definitions (created by devs/masters/assistants)
CREATE TABLE public.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  assigned_to_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  repeat_type text NOT NULL CHECK (repeat_type IN ('day_of_week', 'days_after_completion', 'once')),
  repeat_day_of_week integer CHECK (repeat_day_of_week IS NULL OR (repeat_day_of_week >= 0 AND repeat_day_of_week <= 6)),
  repeat_days_after integer CHECK (repeat_days_after IS NULL OR repeat_days_after >= 1),
  repeat_end_date date,
  start_date date NOT NULL,
  notify_on_complete_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notify_creator_on_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.checklist_items IS 'Checklist item definitions. Devs, masters, assistants create and assign items with repeat rules.';
COMMENT ON COLUMN public.checklist_items.repeat_day_of_week IS '0=Sunday, 6=Saturday. Used when repeat_type = day_of_week.';
COMMENT ON COLUMN public.checklist_items.repeat_days_after IS 'Days after completion for next instance. Used when repeat_type = days_after_completion.';

-- Checklist instances: one per (item, date) when item is due
CREATE TABLE public.checklist_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  assigned_to_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  completed_at timestamptz,
  notes text,
  completed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(checklist_item_id, scheduled_date)
);

COMMENT ON TABLE public.checklist_instances IS 'Per-day checklist occurrences. Users complete instances assigned to them.';

ALTER TABLE public.checklist_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

-- checklist_items: only dev/master/assistant can manage
CREATE POLICY "Devs masters assistants can read checklist items"
ON public.checklist_items FOR SELECT
USING (public.is_dev_or_master_or_assistant());

CREATE POLICY "Devs masters assistants can insert checklist items"
ON public.checklist_items FOR INSERT
WITH CHECK (public.is_dev_or_master_or_assistant());

CREATE POLICY "Devs masters assistants can update checklist items"
ON public.checklist_items FOR UPDATE
USING (public.is_dev_or_master_or_assistant())
WITH CHECK (public.is_dev_or_master_or_assistant());

CREATE POLICY "Devs masters assistants can delete checklist items"
ON public.checklist_items FOR DELETE
USING (public.is_dev_or_master_or_assistant());

-- checklist_instances: users read/update their own; dev/master/assistant read all and insert
CREATE POLICY "Users read own instances or dev master assistant read all"
ON public.checklist_instances FOR SELECT
USING (
  assigned_to_user_id = auth.uid()
  OR public.is_dev_or_master_or_assistant()
);

CREATE POLICY "Devs masters assistants can insert instances"
ON public.checklist_instances FOR INSERT
WITH CHECK (public.is_dev_or_master_or_assistant());

CREATE POLICY "Users update own instances"
ON public.checklist_instances FOR UPDATE
USING (assigned_to_user_id = auth.uid())
WITH CHECK (assigned_to_user_id = auth.uid());

CREATE POLICY "Devs masters assistants can delete instances"
ON public.checklist_instances FOR DELETE
USING (public.is_dev_or_master_or_assistant());
