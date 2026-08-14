SET lock_timeout = '3s';

-- Vehicle maintenance tasks (Vehicles fleet phase 8): per-vehicle to-dos
-- ("change battery", "fix door handle") that can be ASSIGNED — assignment
-- creates a one-off checklist item (repeat 'once', show_until_completed) so
-- the task rides the existing Checklist machinery (Today tab, Dashboard My
-- Inbox, notifications). assigned_user_id/due_date are denormalized onto the
-- task so the fleet board never joins checklist tables. A SECURITY DEFINER
-- trigger syncs completion BACK from the linked checklist instance (field
-- roles completing their checklist can't write this office-pool table
-- directly). Idempotent and additive.

CREATE TABLE IF NOT EXISTS public.vehicle_maintenance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  title text NOT NULL,
  note text,
  source_problem_report_id uuid REFERENCES public.vehicle_problem_reports(id) ON DELETE SET NULL,
  checklist_item_id uuid REFERENCES public.checklist_items(id) ON DELETE SET NULL,
  checklist_instance_id uuid REFERENCES public.checklist_instances(id) ON DELETE SET NULL,
  assigned_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  due_date date,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  completed_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.vehicle_maintenance_tasks IS
  'Per-vehicle maintenance to-dos (v2.1665). Assigning links a one-off checklist item/instance (checklist_item_id/checklist_instance_id) so the task appears on the assignee''s Checklist Today + Dashboard My Inbox; completion syncs both ways (trigger sync_vehicle_maintenance_task_completion).';

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_tasks_vehicle
  ON public.vehicle_maintenance_tasks (vehicle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_tasks_instance
  ON public.vehicle_maintenance_tasks (checklist_instance_id)
  WHERE checklist_instance_id IS NOT NULL;

ALTER TABLE public.vehicle_maintenance_tasks ENABLE ROW LEVEL SECURITY;

-- Same office pool as the other vehicle tables post-20260714200000 (never copy
-- the baseline's policy bodies — is_assistant_of_pay_approved_master is gone).
DROP POLICY IF EXISTS "Pay access users can manage vehicle maintenance tasks" ON public.vehicle_maintenance_tasks;
CREATE POLICY "Pay access users can manage vehicle maintenance tasks" ON public.vehicle_maintenance_tasks
  USING (public.is_dev() OR public.is_pay_approved_master() OR public.is_assistant())
  WITH CHECK (public.is_dev() OR public.is_pay_approved_master() OR public.is_assistant());

-- Completion sync: checking the linked checklist instance off (from Today /
-- My Inbox) marks the vehicle task done; un-checking it reopens the task.
-- SECURITY DEFINER because the completer may be a field role with no write
-- access to vehicle_maintenance_tasks.
CREATE OR REPLACE FUNCTION public.sync_vehicle_maintenance_task_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    UPDATE public.vehicle_maintenance_tasks
      SET completed_at = NEW.completed_at,
          completed_by = NEW.completed_by_user_id
      WHERE checklist_instance_id = NEW.id AND completed_at IS NULL;
  ELSIF NEW.completed_at IS NULL AND OLD.completed_at IS NOT NULL THEN
    UPDATE public.vehicle_maintenance_tasks
      SET completed_at = NULL,
          completed_by = NULL
      WHERE checklist_instance_id = NEW.id AND completed_at IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_vehicle_maintenance_task_completion ON public.checklist_instances;
CREATE TRIGGER trg_sync_vehicle_maintenance_task_completion
  AFTER UPDATE OF completed_at ON public.checklist_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_vehicle_maintenance_task_completion();

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
