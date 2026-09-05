# 20260905100000_project_access_assigned_superintendents

**Superintendents see only their assigned projects (v2.2836)** — `CREATE OR REPLACE` of `can_access_project_row(uuid, uuid, uuid)`, `can_access_project(uuid)`, `can_access_project_via_step(uuid)`, `can_access_step_for_action(uuid)`; COMMENT-only on `master_adopted_current_user(uuid)`. No table, policy or grant changes.

## What it does

The `projects` SELECT policy (`"Users can see projects they have access to"` → `can_access_project_row(id, master_user_id, customer_id) OR user_has_assigned_step_in_project(id)`) calls the **3-argument** overload. That overload had no superintendent-only branch: it returned true on a `master_superintendents` adoption row (project master, then customer master) *before* reaching `user_assigned_to_project_as_superintendent`. The 2026-06-23 `superintendent_assigned_only` archive migration fixed only the **1-arg** overload. Since v2.921 `sync_company_access_grants()` inserts a `master_superintendents` row for every live dev/master × superintendent, so every superintendent read every project — and, through `can_access_project` / `can_access_project_via_step` / `can_access_step_for_action` (all of which consult `master_adopted_current_user`, whose body includes `master_superintendents`), every workflow, step, money line item (CRUD) and step-anchored `step_commitments` row too. Journey map J31 N1/N2/N4/N7; live 2026-09-04: 3 projects, 1 `project_superintendents` row, 4 `master_superintendents` rows, walked S saw all 3.

### Before → after, the superintendent path

`can_access_project_row(uuid, uuid, uuid)` — before (baseline `:1691-1761`):

```sql
  SELECT role INTO user_role_val FROM public.users WHERE id = auth.uid();
  -- Direct access: owner, dev, master, adopted, shared
  IF proj_master_id = auth.uid() THEN RETURN true; END IF;
  IF user_role_val IN ('dev', 'master_technician') THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.master_assistants ...) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.master_primaries ...) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.master_superintendents WHERE master_id = proj_master_id AND superintendent_id = auth.uid()) THEN
    RETURN true;                                   -- ← every superintendent, every project (v2.921 sync)
  END IF;
  ...
  IF public.user_assigned_to_project_as_superintendent(project_id_param) THEN RETURN true; END IF;
  -- customer side repeats the same master_superintendents check
```

after:

```sql
  SELECT role INTO user_role_val FROM public.users WHERE id = auth.uid();
  -- Superintendents: ONLY project-level assignment (project_superintendents), NOT adoption.
  IF user_role_val = 'superintendent' THEN
    RETURN public.user_assigned_to_project_as_superintendent(project_id_param);
  END IF;
  -- Direct access: owner, dev, master, adopted, shared   (unchanged; both master_superintendents EXISTS removed)
```

`can_access_project(uuid)` / `can_access_project_via_step(uuid)` / `can_access_step_for_action(uuid)` — before: `... OR public.master_adopted_current_user(project_master_id) OR ...`; after:

```sql
    OR (user_role_val = 'superintendent' AND public.can_access_project_row(<project id>))
    OR (user_role_val IS DISTINCT FROM 'superintendent' AND public.master_adopted_current_user(<project master>))
```

(`can_access_project_via_step` already carried the superintendent → `can_access_project_row` branch; only the adoption gate is new. `can_access_step_for_action` now also selects `p.id` so it can call the strict 1-arg overload.)

### Deliberately unchanged

- **`master_adopted_current_user(uuid)` body.** The `users` SELECT policy (`"Users can select users"`, baseline `:38461`, controller-widened in `20260714213000`) grants a superintendent sight of `master_technician` accounts *only* through `master_adopted_current_user(id)`. Dropping its superintendent branch would hide every master from superintendents (assign pickers, the Project Master line, Dashboard). The project helpers now branch on role before consulting it; its COMMENT is corrected to say so.
- **`master_superintendents` table / `sync_company_access_grants()`.** Still read by: `list_superintendent_jobs_for_dashboard`, `get_assigned_steps_with_projects_for_dashboard` (superintendent names), `list_job_schedule_blocks_for_schedule_email`, `list_schedule_blocks_for_share`, the four `job_schedule_blocks_*` policies, `update_job_status`, `can_access_bid_for_pricing`, `superintendent_can_access_bid`, `enforce_user_labels_scope_master`, `user_can_read_labels_for_master`, the `people` policy "Superintendent can see people from adopted masters", the `customers` INSERT policy "Superintendents can insert customers when master is assigned", the `jobs_ledger_invoice_stripe_email_sends` SELECT policy, `merge_user_accounts`; client: `Workflow.tsx` + `StepFormModal.tsx` (assign-picker roster scope), `tagOrg.ts`, `teamFeedback.ts` (`resolveManager`), `useSettingsBackupExports.ts`, `Projects.tsx` (comment only — adoption rows are deliberately not painted as assignments since v2.1192).
- **`can_access_project_row_for_user(uuid, uuid)`** — schedule-email cron sibling; its two callers grant superintendents through their own direct `master_superintendents` checks (dispatch is company-wide by design), so changing this helper alone would change nothing.
- **`can_access_project_via_workflow(uuid)`** — no adoption branch of its own; fixed through `can_access_project`.

## Order

Any time after `20260905080000`; the client change in the same PR (primary `/workflows` route) is independent of this migration. Safe to push while crews use the app: four `CREATE OR REPLACE FUNCTION` statements, no locks beyond the function rows.

## Verify (run after `db push`)

As a **superintendent** (impersonate or a superintendent session; every count should be limited to their assigned projects):

```sql
select count(*) from public.projects;                                  -- = next line
select count(*) from public.project_superintendents where superintendent_id = auth.uid();
select count(*) from public.project_workflows;                         -- only those projects' workflows
select count(*) from public.project_workflow_steps;                    -- only those workflows' steps
select count(*) from public.workflow_step_line_items;                  -- only those steps' line items
select count(*) from public.step_commitments where step_id is not null; -- only those steps' work orders
                                                                        -- (sheet-anchored rows stay office+S visible by design)
```

In the app as S: `/projects` lists only assigned projects; `/workflows/<unassigned project id>` shows nothing (header included); the assign picker on an assigned project still lists people (roster scope via adoption is unchanged); Dispatch week grid unchanged.

As **dev**: `select count(*) from public.projects` and the other five counts are unchanged from before the push. As an **assistant / master**: unchanged.

## Rollback

Re-run the previous definitions: `can_access_project_row(uuid, uuid, uuid)` from `supabase/migrations/20250101000000_baseline.sql` (`CREATE OR REPLACE FUNCTION "public"."can_access_project_row"("project_id_param" "uuid", "proj_master_id" "uuid", "proj_customer_id" "uuid")`), `can_access_project(uuid)` and `can_access_project_via_step(uuid)` from the same baseline, and `can_access_step_for_action(uuid)` from `20260817012110_workflow_step_readers_person_id_first.sql`. Restoring them re-opens the over-grant.
