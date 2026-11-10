# 20261109150000_workflow_projections_controller_delete.sql (2026-11-09, v2.6803)

The delete policy on `workflow_projections`, restated with the controller: `"Devs and masters can delete projections"` is `USING (public.is_master_or_dev() OR public.is_controller())`, where the baseline's read the caller's role as dev or master_technician.

**Why**: punch list #188 row 48 (v2.6760) gave the controller Workflow → Projections. The table's select, insert and update admit the office (`is_office_staff()`, `20260907050000`), so she added and edited a projection, but a Delete removed no row and raised no error. The three roles are the ones the page's bar and its read hold (`canSeeProjections`, `src/lib/workflow/projectionEdit.ts`); `projectionEdit.test.ts` reads this migration against the predicate.

**Shape**: one `DROP POLICY IF EXISTS` and one `CREATE POLICY`; idempotent; no table is created, so no fence call is owed. `SET lock_timeout = '3s'` first.

**Applied** to prod by 2026-11-10, read the same day through `supabase migration list` against the linked project: 1217 files on `main` against 1217 remote versions, fully applied, this one among them.
