import type { UserRole } from '../hooks/useAuth'
import { isSubcontractorLikeRole } from './subcontractorLikeRole'

/** Roles that can load full `JobWithDetails` (jobs_ledger + child embeds) for read-only Job details. */
export function isStaffFullJobLedgerDetailRole(role: string | null): boolean {
  return (
    role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary'
  )
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

/** Job Detail profit band (sub labor cost, tally parts cost, profit) — masters and devs only. */
export function showJobDetailProfitSection(role: string | null): boolean {
  return role === 'dev' || role === 'master_technician'
}

/** Cost breakdown team-labor stream (per-person hours × hourly wage) — masters and devs only.
 * Anyone else could divide the charted dollars by hours they already see elsewhere and derive
 * employee pay rates. UI layer only — `people_pay_config` RLS still grants assistants SELECT. */
export function showJobCostBreakdownTeamLabor(role: string | null): boolean {
  return role === 'dev' || role === 'master_technician'
}
