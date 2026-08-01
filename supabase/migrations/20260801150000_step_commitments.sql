SET lock_timeout = '3s';

-- RUN_SUBS_PLAN Phase 2, PR 2.1: step commitments — "this sub does this step
-- for this amount." The one genuinely new object in the run-subs workstream.
--
-- A commitment lives ON a workflow step and points at a roster person
-- (person-id keyed from day one; display_name is denormalized display + the
-- legacy-name RLS fallback). Status covers the money lifecycle only —
-- draft → offered → accepted → approved → settled (+ cancelled). Work
-- progress (in progress / complete) is read from the step itself so there is
-- exactly one source of truth for each. Settlement (PR 2.3) creates the
-- people_labor_jobs sub sheet and stamps labor_job_id — the Sub Labor tab
-- stays the single AP ledger.
--
-- Dormant until PR 2.2 ships the panel; nothing reads it yet.

CREATE TABLE IF NOT EXISTS public.step_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid NOT NULL REFERENCES public.project_workflow_steps(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
  display_name text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  retainage_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (retainage_pct >= 0 AND retainage_pct <= 100),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','offered','accepted','approved','settled','cancelled')),
  labor_job_id uuid REFERENCES public.people_labor_jobs(id) ON DELETE SET NULL,
  notes text,
  offered_at timestamptz,
  accepted_at timestamptz,
  approved_at timestamptz,
  settled_at timestamptz,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.step_commitments IS
  'Sub work orders on workflow steps: person_id does step_id for amount. Money lifecycle only (draft/offered/accepted/approved/settled/cancelled) — work progress reads from the step. Settlement creates the people_labor_jobs sub sheet (labor_job_id).';
COMMENT ON COLUMN public.step_commitments.display_name IS
  'Denormalized person display name; also the legacy-name fallback for the sub own-row read policy.';
COMMENT ON COLUMN public.step_commitments.retainage_pct IS
  'Held-back percentage. Stored from day one; settlement releases amount x (1 - pct/100) — retainage release is a later phase.';

-- One live commitment per (step, person); cancelling frees the slot.
CREATE UNIQUE INDEX IF NOT EXISTS step_commitments_step_person_live_uniq
  ON public.step_commitments (step_id, person_id)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_step_commitments_step_id ON public.step_commitments (step_id);
CREATE INDEX IF NOT EXISTS idx_step_commitments_person_id ON public.step_commitments (person_id);

DROP TRIGGER IF EXISTS update_step_commitments_updated_at ON public.step_commitments;
CREATE TRIGGER update_step_commitments_updated_at
  BEFORE UPDATE ON public.step_commitments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.step_commitments ENABLE ROW LEVEL SECURITY;

-- Read: anyone with project access via the step (dev/master/adopted/shared/
-- superintendent — the same SECURITY DEFINER helper the step RPCs use), PLUS
-- the sub's own rows (people.account_user_id link first, legacy trimmed-name
-- match as fallback — the people_pay_config self-read precedent).
CREATE POLICY sc_select ON public.step_commitments FOR SELECT USING (
  public.can_access_project_via_step(step_id)
  OR EXISTS (
    SELECT 1 FROM public.people p
    WHERE p.id = step_commitments.person_id AND p.account_user_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid()) AND btrim(u.name) = btrim(step_commitments.display_name)
  )
);

-- Create: office roles with project access (mirrors the sub-sheet write set).
CREATE POLICY sc_insert ON public.step_commitments FOR INSERT WITH CHECK (
  public.can_access_project_via_step(step_id)
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller','estimator')
  )
);

-- Update: the office set plus superintendents (client limits them to
-- offered -> accepted; the DB grants row access, not transition logic).
CREATE POLICY sc_update ON public.step_commitments FOR UPDATE USING (
  public.can_access_project_via_step(step_id)
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller','estimator','superintendent')
  )
) WITH CHECK (
  public.can_access_project_via_step(step_id)
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller','estimator','superintendent')
  )
);

-- Delete: dev/master only — money records cancel via status, not deletion.
CREATE POLICY sc_delete ON public.step_commitments FOR DELETE USING (
  public.can_access_project_via_step(step_id)
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid()) AND u.role IN ('dev','master_technician')
  )
);

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
