import type { UserRole } from '../hooks/useAuth'
import { isSubcontractorLikeRole } from './subcontractorLikeRole'

/** Roles that can load full `JobWithDetails` (jobs_ledger + child embeds) for read-only Job details.
 * Mirrors the `jobs_ledger` SELECT policy's literal role array ("Devs, masters, assistants, primary
 * can read jobs ledger") — controller is NOT in it, so a controller's full fetch returns null too. */
export function isStaffFullJobLedgerDetailRole(role: string | null): boolean {
  return (
    role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary'
  )
}

/** Which surface opens when a job is tapped: the tabbed Job window (Job · Edit · Bill) or the
 * read-only Job Detail pane. */
export type JobWindowMode = 'window' | 'read-only'

/**
 * Job window role branch (v2.2848). The tabbed window always mounts the embedded edit form, whose
 * init effect runs the full-ledger `fetchJobWithDetailsById`; for any role outside
 * `isStaffFullJobLedgerDetailRole` that fetch returns null under RLS, the form toasts
 * "Job not found or you do not have access." and closes the whole window ~1 s after it opened.
 * Superintendent, estimator, and controller therefore get the read-only pane — the same limited
 * `jobs_ledger` read (merged over the caller's assigned rows) that sub-like roles already use, with
 * the job thread notes panel (superintendents post there since v2.2647).
 */
export function resolveJobWindowMode(role: string | null): JobWindowMode {
  return isStaffFullJobLedgerDetailRole(role) ? 'window' : 'read-only'
}

/** Roles that see Job Detail materials-cost accordions with line-level expand (excludes subcontractor). */
export function canExpandJobDetailMaterials(role: string | null): boolean {
  return (
    role === 'dev' ||
    role === 'master_technician' ||
    role === 'assistant' ||
    role === 'primary' ||
    role === 'superintendent' ||
    role === 'estimator'
  )
}

/** Job Detail revenue row — hidden for subcontractors and helpers. */
export function showJobDetailJobTotal(role: string | null): boolean {
  return !isSubcontractorLikeRole(role as UserRole)
}

/** Job Detail profit band (sub labor cost, parts cost, profit) — masters, devs, controllers. */
export function showJobDetailProfitSection(role: string | null): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'controller'
}

/** Cost breakdown team-labor stream (per-person hours × hourly wage) — masters, devs, controllers.
 * Anyone else could divide the charted dollars by hours they already see elsewhere and derive
 * employee pay rates. RLS backs this since v2.660 (assistants cannot SELECT wages). */
export function showJobCostBreakdownTeamLabor(role: string | null): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'controller'
}
