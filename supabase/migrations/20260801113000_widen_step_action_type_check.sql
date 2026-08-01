SET lock_timeout = '3s';

-- Widen project_workflow_step_actions.action_type to allow 'skipped'.
--
-- Both Skip flows (Workflow page submitSkip and the Dashboard Projects
-- card) have always inserted action_type = 'skipped', but the baseline
-- CHECK only allowed started|completed|approved|rejected|reopened, so
-- every Skip's ledger insert failed the constraint. It went unnoticed
-- because neither recordAction caller surfaced insert errors: the step
-- flipped to 'skipped' with no action-ledger row. Existing rows all use
-- the old values, so re-validating on ADD CONSTRAINT is safe.

ALTER TABLE public.project_workflow_step_actions
  DROP CONSTRAINT IF EXISTS project_workflow_step_actions_action_type_check;

ALTER TABLE public.project_workflow_step_actions
  ADD CONSTRAINT project_workflow_step_actions_action_type_check
  CHECK (action_type = ANY (ARRAY[
    'started'::text,
    'completed'::text,
    'approved'::text,
    'rejected'::text,
    'reopened'::text,
    'skipped'::text
  ]));

COMMENT ON COLUMN public.project_workflow_step_actions.action_type IS
  'Type of action: started, completed, approved, rejected, reopened, skipped';
