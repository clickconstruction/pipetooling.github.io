---
name: Migrate and Delete job
overview: Add a destructive "Migrate and Delete" path in JobFormModal that opens a helper modal to pick a target jobs_ledger row, shows labor/parts-style summaries for source vs target, runs a transactional DB RPC to repoint cost-bearing rows to the target, then deletes the source job. Target may be any accessible ledger job; migrate is blocked when the source has billing artifacts that must not be bypassed.
todos:
  - id: schema-audit-rpc
    content: Audit job_id/job_ledger FKs; define migrate_job_ledger_costs_and_delete RPC + billing block predicates
    status: completed
  - id: rpc-implementation
    content: Supabase migration SECURITY DEFINER RPC transaction repoint + merge crew JSON + delete source
    status: completed
  - id: preview-api
    content: Optional preview RPC or reuse counts for modal totals (source/target)
    status: completed
  - id: job-form-modal-ui
    content: JobFormModal Migrate and Delete button, modal, job picker, call RPC, refresh
    status: completed
  - id: verify-build
    content: Manual matrix + npm run build
    status: completed
isProject: true
---

# Migrate and Delete (jobs_ledger)

## Product decisions (confirmed)

- **Target job:** Any other `jobs_ledger` row the user is allowed to access (office discretion), not restricted to same HCP/project.
- **Billing guard:** **Block** Migrate and Delete when the source job has billing state that must not be bypassed (invoices, payments, or other predicates you define in the RPC—align with how “delete job” is expected to behave today for billed work).

## Goal

When deleting a job that already has **Labor Cost** and/or **Parts Cost** (and related rows), offer **Migrate and Delete** (same red destructive styling as **Delete**). On click, open a **helper modal** where the user:

1. Selects a **target** job (search / list; exclude the source `id`).
2. Sees **summaries** for source vs target (labor + parts style totals—reuse existing display logic or a small preview RPC).
3. On confirm: **server** repoints all in-scope cost rows from **source → target**, then **deletes** the source `jobs_ledger` row.

## Why a database RPC

Many child tables use `ON DELETE CASCADE` on `jobs_ledger`; a naive client-side delete **drops** tally, allocations, etc. Repointing must happen in **one transaction** with explicit **ordering** and **billing checks**. Implement `migrate_job_ledger_costs_and_delete(p_from uuid, p_to uuid)` (name TBD) as `SECURITY DEFINER`, fixed `search_path`, grants for `authenticated` (or a narrower role), matching existing patterns for sensitive RPCs.

## Scope: tables to repoint (audit required)

Before coding, enumerate every table with `job_id` or `job_ledger_id` referencing `jobs_ledger` that represents **labor**, **parts**, or **materials** the user cares about. Minimum candidates from the codebase/schema (verify and extend):

- **Parts / materials:** `jobs_tally_parts`, `jobs_ledger_materials`, `supply_house_invoice_job_allocations`, Mercury job split / allocation table(s) (e.g. `mercury_transaction_job_allocations` or current equivalent).
- **Labor / time:** `clock_sessions.job_ledger_id` where it equals `p_from`.
- **Team labor (crew grid):** `people_crew_jobs.job_assignments` JSON array `{ job_id, pct }`—must **replace** `p_from` with `p_to` and **merge** when both appear on the same `(work_date, person_name)` row so percentages remain valid (define merge rule: e.g. combine pct, renormalize to 100, or fail if ambiguous).
- **Optional / product:** `job_schedule_blocks`, `jobs_ledger_team_members` (merge duplicates), thread notes—decide move vs leave vs cascade-on-delete.

**Sub labor** tied to HCP rather than `jobs_ledger.id` may need explicit rules (move only when HCP matches, or document “not migrated” if out of scope).

## Billing block (RPC)

Before any `UPDATE`, assert the source job **does not** meet “has billing artifacts” predicates, for example (tune to match product):

- Any `jobs_ledger_invoices` row for `p_from` with status beyond draft, or any linked payments / Stripe state, or job status in disallowed stages.

Return a clear error code/message for the UI (e.g. “Clear or resolve billing for this job before migrate-delete.”).

## UI ([`src/components/jobs/JobFormModal.tsx`](src/components/jobs/JobFormModal.tsx))

- Near existing delete confirm (~5172+): if **source has migrateable cost signals** (reuse `editJobTeamLaborRow`, sub labor snapshot, parts/tally totals, or a lightweight `preview_*` RPC), show **Migrate and Delete** beside/alternate to **Delete**, same red palette (`#b91c1c`).
- **Modal:** target job picker (search existing jobs list or new query), read-only **source vs target** summary (mirror Labor / Parts summary numbers where possible).
- **Confirm:** call RPC; on success run same refresh/close path as successful `deleteJob`; on error show toast with RPC message.
- If RPC reports **billing block**, show dedicated copy; do not offer Migrate and Delete for that job (or disable with tooltip).

## Docs / changelog

- Update [`RECENT_FEATURES.md`](RECENT_FEATURES.md) with version note: Migrate and Delete + RPC name + billing guard.

## Verification

- Cases: no costs (plain delete only); parts only; clock labor only; crew JSON with single job; crew JSON with merge; billing block returns error; target = self rejected; successful migrate + source gone.
- `npm run build`.
