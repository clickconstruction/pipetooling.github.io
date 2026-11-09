SET lock_timeout = '3s';

-- Punch list #188 row 48 (v2.6760) gave the controller Workflow → Projections: "projections are the books'". The
-- table's select, insert and update admit the office (is_office_staff(), 20260907050000), so she adds and edits a
-- projection, but the delete policy is still the baseline's dev and master_technician: her Delete removed no row and
-- raised no error. This restates the one policy with the controller beside the owner and a dev, the same three roles
-- the page's bar and its read hold (canSeeProjections in src/lib/workflow/projectionEdit.ts).
-- Idempotent: no table is created, so no fence call is owed.

DROP POLICY IF EXISTS "Devs and masters can delete projections" ON public.workflow_projections;
CREATE POLICY "Devs and masters can delete projections" ON public.workflow_projections
  FOR DELETE
  USING (public.is_master_or_dev() OR public.is_controller());
