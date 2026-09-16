/**
 * Pipeline (Stages) role gates — every "who may" the board draws, in one place.
 *
 * Stage A of the JobsStagesTab decomposition train (`docs/JOBS_STAGES_TAB_ARCHITECTURE.md`
 * → Stage-A candidates): before this file the same boolean chains were written out inline
 * across the tab — the office set sixteen times, the Accounts Receivable set five times.
 * Each gate here names a capability and says which server rule it mirrors. The server
 * (RLS, RPC gates) stays authoritative; these only decide what the board renders.
 *
 * Adding a role: edit the set here and the matching DB capability function (see
 * `docs/ADDING_A_NEW_ROLE.md`), then run the matrix test — it pins every gate for every role.
 */
import { isAssistantLike } from '../subcontractorLikeRole'

type Role = string | null | undefined

/** dev · master_technician · assistant · controller — the office pool that moves jobs between stages. */
export function isStagesOfficeRole(role: Role): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
}

/** dev · master_technician — the owner pair that configures the board's emails and payment exclusions. */
export function isStagesOwnerRole(role: Role): boolean {
  return role === 'dev' || role === 'master_technician'
}

/** dev · controller — dev-level money visibility: the aging and profit charts, collected totals. */
export function canSeeStagesMoneyCharts(role: Role): boolean {
  return role === 'dev' || role === 'controller'
}

/** Office + superintendent: who may open the Job Schedule modal from a row. */
export function canOpenJobScheduleModal(role: Role): boolean {
  return isStagesOfficeRole(role) || role === 'superintendent'
}

/**
 * Mirrors the jobs_ledger UPDATE RLS (dev / master_technician / assistant-like / primary)
 * — who may set a job's % complete from the Stages expanded panel.
 */
export function canEditJobPctComplete(role: Role): boolean {
  return isStagesOfficeRole(role) || role === 'primary'
}

/**
 * Mirrors the jobs_ledger_team_members INSERT/DELETE RLS (dev / master_technician /
 * assistant only — NOT controller) — who may add or remove people from a job.
 */
export function canManageJobPeople(role: Role): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant'
}

/** Same office set as the create_hazmat_fee_incident RPC gate. */
export function canCreateHazmatFee(role: Role): boolean {
  return isStagesOfficeRole(role)
}

/** The set_job_collections_flag RPC is authoritative; this only controls button visibility. */
export function canManageCollections(role: Role): boolean {
  return isStagesOfficeRole(role)
}

/**
 * Office + primary: who may open Accounts Receivable and record payments. Broader than
 * the Pipeline tab gate on purpose (map quirk 6): a primary can use the AR door even
 * though the tab bar never shows them Pipeline.
 */
export function canRecordArPayments(role: Role): boolean {
  return isStagesOfficeRole(role) || role === 'primary'
}

/**
 * Office + primary: the Billed section's expected-payment chips (customer pay speeds).
 * The same set as AR today; named apart because it answers a different question.
 */
export function canSeeBilledExpectedPay(role: Role): boolean {
  return isStagesOfficeRole(role) || role === 'primary'
}

const OFFICE_TOOL_ROLES = ['dev', 'master_technician', 'assistant', 'controller'] as const

/**
 * The ⋯ menu's office-only items (Job Book, Combine / Separate) and the Session notes
 * doors — either the auth role or the People-row role qualifies (owner call 2026-09-03).
 */
export function canUseStagesOfficeTools(authRole: Role, myRole: Role): boolean {
  return OFFICE_TOOL_ROLES.some((r) => r === authRole || r === myRole)
}

/**
 * The ⋯ menu's Ham mode and Edit mode toggles (and the edit-mode rails they turn on,
 * v2.1236): dev / assistant / controller, judged on whichever of the two roles is known
 * first — a stale localStorage flag on a shared browser must not surface rails for
 * anyone who cannot see the toggle.
 */
export function canSeeStagesPowerToggles(authRole: Role, myRole: Role): boolean {
  const role = authRole || myRole
  return role === 'dev' || role === 'assistant' || role === 'controller'
}
