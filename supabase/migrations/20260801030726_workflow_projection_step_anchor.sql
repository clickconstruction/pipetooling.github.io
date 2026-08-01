SET lock_timeout = '3s';

-- Workflow money flow (v2.1194): projections can anchor to a workflow step,
-- placed before or after it, so the Workflow page can render them as inline
-- money markers with running projected/spent totals. Nullable + additive:
-- existing rows stay unanchored and keep living in the top Projections panel.
-- When the anchor step is deleted the projection reverts to unanchored
-- (ON DELETE SET NULL) instead of dying with the step.
ALTER TABLE "public"."workflow_projections"
  ADD COLUMN IF NOT EXISTS "step_id" "uuid" REFERENCES "public"."project_workflow_steps"("id") ON DELETE SET NULL;

ALTER TABLE "public"."workflow_projections"
  ADD COLUMN IF NOT EXISTS "placement" "text" DEFAULT 'after';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workflow_projections_placement_check'
  ) THEN
    ALTER TABLE "public"."workflow_projections"
      ADD CONSTRAINT "workflow_projections_placement_check"
      CHECK ("placement" IS NULL OR "placement" IN ('before', 'after'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_workflow_projections_step_id"
  ON "public"."workflow_projections" ("step_id")
  WHERE "step_id" IS NOT NULL;

COMMENT ON COLUMN "public"."workflow_projections"."step_id" IS
  'Optional anchor step (v2.1194): the projection renders as an inline money marker on the Workflow page. NULL = unanchored (top panel only).';
COMMENT ON COLUMN "public"."workflow_projections"."placement" IS
  'Where an anchored projection sits relative to its step: before | after (default after). Meaningless when step_id is NULL.';
