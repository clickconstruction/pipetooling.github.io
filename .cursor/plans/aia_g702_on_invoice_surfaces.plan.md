---
name: AIA G702 on invoice surfaces
overview: Centralize AIA visibility rules so standalone Stages invoice rows and View bill can open the same workbook generator; extend eligibility using invoice status when job status alone would hide the control.
todos:
  - id: aia-elig
    content: Add `showAiaG702G703` in `src/lib/aiaG702G703Eligibility.ts` + unit tests
    status: completed
  - id: aia-jobs
    content: Replace `stagesRowShowsAiaG702` in `Jobs.tsx`; pass `inv` on invoice rows
    status: completed
  - id: aia-view-bill
    content: Add AIA button + `AiaG702G703Modal` to `BilledBillViewModal` when eligible
    status: completed
  - id: aia-verify
    content: Run `npm run test` and `npm run build`
    status: completed
isProject: false
---

# AIA G702-G703 on invoice surfaces

## Context

- [`AiaG702G703Modal`](src/components/jobs/AiaG702G703Modal.tsx) is mounted from [`Jobs.tsx`](src/pages/Jobs.tsx) today.
- [`renderUnifiedStagesTable`](src/pages/Jobs.tsx) already shows the spreadsheet control on **standalone invoice rows**, but it uses a local helper that only checks **`job.status`** (`ready_to_bill` | `billed`) plus [`isStaffFullJobLedgerDetailRole`](src/lib/jobDetailModalRole.ts). If **`job.status` does not match** while **`inv.status` does**, the button stays hidden.
- [`BilledBillViewModal`](src/components/jobs/BilledBillViewModal.tsx) has full [`JobWithDetails`](src/types/jobWithDetails.ts) on `invoice.job` but no AIA entry point.

## 1. Shared eligibility helper

Add [`src/lib/aiaG702G703Eligibility.ts`](src/lib/aiaG702G703Eligibility.ts):

- Export `showAiaG702G703(authRole: string | null, job: Pick<JobWithDetails, 'status'>, invoice?: Pick<JobsLedgerInvoice, 'status'> | null): boolean`
- **Role:** `isStaffFullJobLedgerDetailRole(authRole)` (same behavior as today).
- **State:** `true` if `job.status` is `'ready_to_bill'` or `'billed'`, **or** (when `invoice` is passed) `invoice.status` is `'ready_to_bill'` or `'billed'`.

Use the same invoice row type as in [`Jobs.tsx`](src/pages/Jobs.tsx) (e.g. `Database['public']['Tables']['jobs_ledger_invoices']['Row']`).

## 2. Wire [`Jobs.tsx`](src/pages/Jobs.tsx)

- Remove or replace local `stagesRowShowsAiaG702`.
- **Job-only / merged job rows:** `showAiaG702G703(authRole, j)` (no third arg).
- **Standalone invoice branch** (`const { inv, job } = row`): `showAiaG702G703(authRole, job, inv)`.

Keep the existing [`<AiaG702G703Modal />`](src/pages/Jobs.tsx) instance and `setAiaG702StagesJob(job)` (job-scoped prefill).

## 3. View Bill modal

In [`BilledBillViewModal`](src/components/jobs/BilledBillViewModal.tsx):

- Use `useAuth()` `role` (already imported).
- Add state for AIA open/close.
- In the header row (title / Stripe), add the same **FileSpreadsheet** control + `title` / `aria-label` as Stages when `showAiaG702G703(role, job, invoice)` is true.
- Render `<AiaG702G703Modal open={…} onClose={…} job={job} hcpForFilename={job.hcp_number ?? ''} />`. Default AIA `zIndex` is already `1006`; add an optional `overlayZIndex` prop to [`AiaG702G703Modal`](src/components/jobs/AiaG702G703Modal.tsx) only if stacking over the bill overlay (`60`) is wrong in practice.

## 4. Tests

Add [`src/lib/aiaG702G703Eligibility.test.ts`](src/lib/aiaG702G703Eligibility.test.ts):

- Disallowed role → `false`.
- Allowed role + job `working` + no invoice → `false`.
- Allowed role + job `working` + invoice `ready_to_bill` → `true`.
- Allowed role + job `billed` → `true` (with or without invoice).

## 5. Verify

`npm run test` and `npm run build`.

## Optional follow-up

- Same pattern in **Bill Customer** / hosted billing UI if product wants AIA there.
