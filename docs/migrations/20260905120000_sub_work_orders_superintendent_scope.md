# 20260905120000_sub_work_orders_superintendent_scope

**Superintendents see and edit only the sub work orders on their own jobs and projects (v2.2844)** — `CREATE OR REPLACE` of `can_access_sub_work_order(uuid, uuid, uuid)`; new helper `superintendent_can_access_sub_work_order(uuid, uuid)`. No table, policy or grant changes. Follow-up to `20260905100000_project_access_assigned_superintendents` (v2.2836, PR #2575).

## What it does

`step_commitments` (sub work orders) has three anchors: a workflow step, a Sub Labor sheet (`labor_job_id`), or a job (`job_id`). Every policy on the table (`sc_select`, `sc_insert`, `sc_update`, `sc_delete`) routes through `can_access_sub_work_order(step_id, labor_job_id, job_id)`. Step-anchored rows follow the project (`can_access_project_via_step`, which v2.2836 scopes to assigned projects). Sheet- and job-anchored rows were granted to a **role list that included `superintendent` by literal** — every superintendent could read, and (through `sc_update`'s matching role list) edit, every work order in the company that was not tied to a step. Journey map drift sweep `_DRIFT-2` Tier-1 #4 / Flag 1.

The function comment argued from "the Sub Labor tab audience". That audience is the office set: the `people_labor_jobs` SELECT policy is dev/master_technician/assistant/estimator only (superintendents cannot read a sheet at all), and `Jobs.tsx` hides the Work Orders tab from superintendents (`showSuperintendentExtraTabs = !isSuperintendent`; they get `reports` and `sub_sheet_ledger`).

### Before → after, the sheet/job branch

Before (`20260905050035_work_orders_on_jobs.sql:73-95`):

```sql
    WHEN p_labor_job_id IS NOT NULL OR p_job_id IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev','master_technician','assistant','controller','estimator','superintendent')
    )
```

After:

```sql
    WHEN p_labor_job_id IS NOT NULL OR p_job_id IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('dev','master_technician','assistant','controller','estimator')
          OR (
            u.role = 'superintendent'
            AND public.superintendent_can_access_sub_work_order(p_labor_job_id, p_job_id)
          )
        )
    )
```

`superintendent_can_access_sub_work_order(p_labor_job_id, p_job_id)` (new; `SECURITY DEFINER`, `row_security = off`, no role check of its own):

- **job-anchored** (or a sheet-anchored row back-filled with its `job_id`) → `superintendent_report_job_anchor_allowed(p_job_id)`;
- **sheet-anchored without a job_id** → the sheet's `project_id` passes the strict 1-arg `can_access_project_row`, **or** the `jobs_ledger` row whose `hcp_number` matches the sheet's `job_number` passes `superintendent_report_job_anchor_allowed`.

The reused predicate is **`superintendent_report_job_anchor_allowed(job_id)`** (baseline; "reports RLS superintendent job branch: project access OR team-assigned job, parity with `list_assigned_jobs_for_dashboard`"), the same anchor the job thread-notes policies adopted in v2.2647 (`superintendent_can_touch_job_thread`). It is: strict project assignment (`project_superintendents` via the 1-arg `can_access_project_row`, which never consulted adoption) **or** a `jobs_ledger_team_members` row for the caller on the job. Dispatch schedule assignment is deliberately *not* included — it is the narrowest rule that still covers the jobs a superintendent runs.

### Why the policies are not re-created

`sc_update`'s `USING` / `WITH CHECK` are `can_access_sub_work_order(...) AND role IN (office + superintendent)`; the role list stays, but the helper now returns false for a superintendent off the job, so UPDATE is scoped without touching policy text. `sc_select`'s two own-row branches (the sub's `people.account_user_id` link, trimmed-name fallback) and `sc_insert` / `sc_delete` are unchanged.

### Unchanged, deliberately

- **Office roles** (dev/master_technician/assistant/controller/estimator): same literal list, same result.
- **Step-anchored rows**: `can_access_project_via_step` as v2.2836 leaves it.
- **`create_sheet_for_work_order(uuid)`** still admits the `superintendent` role and reads the commitment as definer with no row gate — a superintendent who knows a commitment id can trigger sheet creation for an accepted order off their jobs. Out of scope here (it is the "Mark accepted" path, not a read/edit leak of the row itself); noted for the literal-role-array sweep (drift row #28).
- **Edge functions** (`sub-portal`, `submit-sub-portal`) read `step_commitments` with the service role — unaffected. `send-workflow-notification` reads with the caller's JWT — office callers, unaffected.

## Readers checked

| Reader | Anchor | Superintendent reaches it? | Effect |
|---|---|---|---|
| `Jobs.tsx` → `JobsWorkOrdersTab.tsx` (`select('*')`, v2.2819 board + assembler) | all | **No** — tab hidden (`showSuperintendentExtraTabs`) | none |
| `Jobs.tsx` → `JobsSubLaborTab.tsx:84` (chip per sheet, `.in('labor_job_id')`) | sheet | Tab shown, but sheets unreadable to superintendents → empty | none |
| `SubSheetWorkOrderPanel.tsx` (sheet form) | sheet | No (sheet unreadable) | none |
| `JobFormEditFactRows.tsx:545` → `JobWorkOrderStrip` → `useJobWorkOrderCoverage` (`.or(job_id / labor_job_id)`) | sheet + job | Yes, in the job window | now only rows on jobs they can anchor |
| `HostedStripeBillPanel.tsx:351` (`readOnly` strip) | sheet + job | Office billing surface | none |
| `useUnpricedWorkOrders.ts` (Needs-You card) | any | Dashboard card | superintendents now count only their jobs' drafts |
| `Workflow.tsx:719-726` + `StepCommitmentPanel.tsx` (`isSuperintendentOnly`) | step | Yes | unchanged (project rule) |
| `DashboardProjectsCard.tsx:103` (`.in('step_id')`) | step | Yes | unchanged |
| `Projects.tsx:462`, `ProjectsForecastSubsTab.tsx:32`, `PartnershipTimelineTab.tsx:135` | step / person | Yes (Projects) | step rows unchanged; sheet/job rows now scoped |
| `PersonDeskWorkOrdersSection.tsx:53`, `PeopleSubsTab.tsx:73`, `personDeskFacts.ts:46`, `PersonDeskPortalSection.tsx:23` | person | **No** — `/people` not in `SUPERINTENDENT_PATHS` | none |
| `DashboardSubMoneySection.tsx` | own rows | sub-like roles only | none |
| `sub-portal` / `submit-sub-portal` edge fns | signed record | service role | none |

## Order

Any time after `20260905100000` (it relies on nothing that migration adds — the 1-arg `can_access_project_row` was already strict — but the two together close the whole Tier-1 #4 row). Safe to push while crews use the app: two `CREATE OR REPLACE FUNCTION` statements, no table locks.

## Verify (run after `db push`)

As a **superintendent** (impersonate or a superintendent session):

```sql
-- every visible sheet/job-anchored work order is on a job they can anchor
select count(*) from public.step_commitments c
where c.step_id is null
  and not public.superintendent_can_access_sub_work_order(c.labor_job_id, c.job_id);   -- expect 0

-- and the ones on their jobs are still there
select count(*) from public.step_commitments c
where c.step_id is null
  and public.superintendent_can_access_sub_work_order(c.labor_job_id, c.job_id);
-- = the same count run as dev with the superintendent's uid substituted into
--   superintendent_report_job_anchor_allowed's project/team checks

select count(*) from public.step_commitments where step_id is not null;  -- only assigned projects' steps (v2.2836)
```

In the app as S: open a job they are assigned to from Jobs → Reports — the job window's **Sub work order** row still shows that job's order; open the Workflow of an assigned project — the step's work-order panel unchanged; Dashboard "unpriced work orders" card counts only their jobs.

As **dev** / **assistant** / **master**: `select count(*) from public.step_commitments` unchanged from before the push; Jobs → Work Orders board unchanged.

## Rollback

Re-run the `can_access_sub_work_order(uuid, uuid, uuid)` definition from `supabase/migrations/20260905050035_work_orders_on_jobs.sql` (section 2). `superintendent_can_access_sub_work_order` can then be dropped. Restoring it re-opens the over-grant.
