/**
 * What the Job form reads off its Costs loads before it draws a press (the Job form map's second pass, cut 1):
 * whether a labor line on the Costs tab opens on Jobs, and whether Delete must become Reassign. Lifted out of
 * `JobFormModal`, where the ten memos had no test; the form keeps the loads and hands their values in.
 */
import type { UserRole } from '../../types/userRole'
import { mercuryCardTotalFromLines, tallyPartsTotalFromLines, type JobMercuryAllocLine, type JobTallyPartLine } from '../../../supabase/functions/_shared/jobMaterialsCostLines'
import { isAssistantLike } from '../subcontractorLikeRole'
import { materialRowHasUserContent } from './jobFormRows'
import type { MaterialRow } from './jobFormTypes'

/** The job's number as the sub-labor door reads it: what is typed in the form, else what the job was saved with. */
export function jobFormEffectiveHcp(typedHcp: string | null | undefined, savedHcp: string | null | undefined): string {
  return (typedHcp ?? '').trim() || (savedHcp ?? '').trim()
}

type LaborRead<T> = { loading: boolean; error: boolean; value: T | null }

export type JobFormLaborLinkGatesInput = {
  role: UserRole | string | null | undefined
  /** `jobFormEffectiveHcp` — the sub door searches Jobs → Subs by the job's number. */
  effectiveHcp: string
  /** The team-labor row for this job: any row at all earns the link. */
  team: LaborRead<unknown>
  /** The sub sheets on this job: the link needs at least one. */
  sub: LaborRead<{ count: number }>
}

/**
 * Which labor lines on the Costs tab carry *Open on Jobs →*. Team labor: not for the office (assistant,
 * controller), a superintendent or a primary, and only once the row has loaded without a failure. Sub labor:
 * anyone but a primary, with a number to search by and at least one sheet read.
 */
export function jobFormLaborLinkGates(input: JobFormLaborLinkGatesInput): { team: boolean; sub: boolean } {
  const { role, effectiveHcp, team, sub } = input
  const canLinkTeam = !isAssistantLike(role) && role !== 'superintendent' && role !== 'primary'
  const canLinkSub = role !== 'primary'
  return {
    team: canLinkTeam && !team.loading && !team.error && team.value != null,
    sub: canLinkSub && !!effectiveHcp && !sub.loading && !sub.error && sub.value != null && sub.value.count > 0,
  }
}

export type JobFormDeleteGateInput = {
  /** Other job charges, as the form holds them (a blank placeholder row included). */
  materials: readonly MaterialRow[]
  supplyInvoiceTotal: number
  tallyPartLines: JobTallyPartLine[]
  mercuryAllocLines: JobMercuryAllocLine[]
  teamLaborRow: { jobCost: number; manHours: number } | null
  subLaborData: { count: number } | null
  /** The three reads still in flight. */
  loading: { snapshot: boolean; teamLabor: boolean; subLabor: boolean }
  /** The five reads that can fail. */
  failed: { teamLabor: boolean; subLabor: boolean; supplyInvoices: boolean; cardCharges: boolean; tally: boolean }
}

export type JobFormDeleteGate = {
  /** Other job charges, summed as typed. */
  materialsBilledTotal: number
  /** Supply invoices plus tally parts plus card charges. */
  partsCostStyleTotal: number
  /** A cost read is still in flight: the window says *Checking costs…*. */
  costSnapshotStillLoading: boolean
  /** The job carries cost of some kind. */
  hasMigrateableCosts: boolean
  /** A cost read failed, so the job's costs could not be confirmed. */
  costCheckErrored: boolean
  /** Delete becomes Reassign: the job has costs, or its costs could not be checked. */
  reassignRequired: boolean
}

/**
 * The delete gate. A job with cost on it is reassigned to another job (or a bid) before it goes, and a job whose
 * costs could not be read is treated the same, so a delete never slips past an unverified cost. Cost is any of:
 * parts (supply invoices, tally, card charges), a job charge with an amount or a description, team labor with
 * dollars or hours, or a sub sheet.
 */
export function jobFormDeleteGate(input: JobFormDeleteGateInput): JobFormDeleteGate {
  const { materials, teamLaborRow, subLaborData, loading, failed } = input
  const materialsBilledTotal = materials.reduce((s, m) => s + (Number(m.amount) || 0), 0)
  const partsCostStyleTotal = input.supplyInvoiceTotal + tallyPartsTotalFromLines(input.tallyPartLines) + mercuryCardTotalFromLines(input.mercuryAllocLines)
  const hasMigrateableCosts =
    partsCostStyleTotal > 0 ||
    materialsBilledTotal > 0 ||
    materials.some(materialRowHasUserContent) ||
    (teamLaborRow != null && (teamLaborRow.jobCost > 0 || teamLaborRow.manHours > 0)) ||
    (subLaborData != null && subLaborData.count > 0)
  const costCheckErrored = failed.teamLabor || failed.subLabor || failed.supplyInvoices || failed.cardCharges || failed.tally
  return {
    materialsBilledTotal,
    partsCostStyleTotal,
    costSnapshotStillLoading: loading.snapshot || loading.teamLabor || loading.subLabor,
    hasMigrateableCosts,
    costCheckErrored,
    reassignRequired: hasMigrateableCosts || costCheckErrored,
  }
}
