SET lock_timeout = '3s';

-- RUN_SUBS_PLAN Phase 0, PR 0.2: person-id spine for workflow-step assignment.
--
-- project_workflow_steps.assigned_to_name is a display-name string matched
-- case-insensitively against users.name (RLS + dashboards) — a rename
-- silently orphans a sub's access and history. This adds the roster identity
-- alongside it, following the PERSON_IDENTITY_PLAN invariant: names remain
-- denormalized display + fallback; a failed resolution degrades to today's
-- behavior, never worse. Same pattern as the pay tables (20260722268000 /
-- 20260730164728): column + resolver backfill + auto-resolve trigger.

ALTER TABLE public.project_workflow_steps
  ADD COLUMN IF NOT EXISTS assigned_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.project_workflow_steps.assigned_person_id IS
  'Roster identity for the assignee (people.id). Resolved from assigned_to_name by trigger when not set explicitly; assigned_to_name remains the display + fallback.';

CREATE INDEX IF NOT EXISTS idx_workflow_steps_assigned_person_id
  ON public.project_workflow_steps (assigned_person_id)
  WHERE assigned_person_id IS NOT NULL;

-- Auto-resolve on write: INSERT fills a missing id; an UPDATE that changes
-- assigned_to_name re-resolves unless the writer set the id explicitly in the
-- same statement (NOT DISTINCT check — the widened set_person_id_on_write
-- semantics from 20260730164728).
CREATE OR REPLACE FUNCTION public.steps_set_assigned_person_id()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_person_id IS NULL THEN
      NEW.assigned_person_id := public.resolve_pay_person_id(NEW.assigned_to_name);
    END IF;
  ELSE
    IF NEW.assigned_person_id IS NOT DISTINCT FROM OLD.assigned_person_id THEN
      NEW.assigned_person_id := public.resolve_pay_person_id(NEW.assigned_to_name);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_assigned_person_id_on_write ON public.project_workflow_steps;
CREATE TRIGGER set_assigned_person_id_on_write
  BEFORE INSERT OR UPDATE OF assigned_to_name ON public.project_workflow_steps
  FOR EACH ROW EXECUTE FUNCTION public.steps_set_assigned_person_id();

-- One-shot backfill of existing assignments (unresolvable names stay NULL —
-- e.g. the known "Behar Kraja (Rough In)" variant until it is combined).
UPDATE public.project_workflow_steps
SET assigned_person_id = public.resolve_pay_person_id(assigned_to_name)
WHERE assigned_person_id IS NULL
  AND btrim(COALESCE(assigned_to_name, '')) <> '';

-- 3-arg successor to update_step_assigned_to: writes name + person id in one
-- statement (explicit id wins — the disambiguator for duplicate roster names,
-- e.g. the "Kyle" x2 case). The 2-arg function stays untouched for old
-- clients; permission block copied verbatim from it.
CREATE OR REPLACE FUNCTION public.update_step_assignment("p_step_id" uuid, "p_assigned_to_name" text, "p_person_id" uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Access check: dev, master, owner, adopted, shared, OR assistant (assigned or can_access)
  IF NOT (
    public.can_access_project_via_step(p_step_id)
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'assistant')
      AND (
        EXISTS (
          SELECT 1 FROM public.project_workflow_steps s
          JOIN public.users u ON u.id = auth.uid() AND u.name IS NOT NULL
            AND LOWER(TRIM(u.name)) = LOWER(TRIM(s.assigned_to_name))
          WHERE s.id = p_step_id
        )
        OR public.can_access_project_via_workflow(
          (SELECT workflow_id FROM public.project_workflow_steps WHERE id = p_step_id)
        )
      )
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.project_workflow_steps
  SET assigned_to_name = p_assigned_to_name,
      assigned_person_id = COALESCE(p_person_id, public.resolve_pay_person_id(p_assigned_to_name))
  WHERE id = p_step_id;
END;
$$;

COMMENT ON FUNCTION public.update_step_assignment(uuid, text, uuid) IS
  'Assigns a workflow step: writes assigned_to_name plus assigned_person_id (explicit id wins, else resolve_pay_person_id). Successor to update_step_assigned_to, which remains for old clients. Bypasses RLS to avoid timeout.';

GRANT ALL ON FUNCTION public.update_step_assignment(uuid, text, uuid) TO anon;
GRANT ALL ON FUNCTION public.update_step_assignment(uuid, text, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.update_step_assignment(uuid, text, uuid) TO service_role;
