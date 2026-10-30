import { formatYmdMonthDay } from '../jobs/billedExpectedPay'
import { parseSubWorkOrderSnapshot } from '../subWorkOrders/subWorkOrder'
import { jobAccountJobLabel, type JobAccountJobLabel } from './fillInJobAccounts'
import { fillInRowKey, type FillInRowBase } from './fillIn'

/**
 * The work-order kind (v2.6094, punch list #178, D's PR 5): the rows behind the Needs you line
 * *N sub work orders are waiting for a price*, the drafts an assistant saved from the assembler
 * without a subcontract amount (`step_commitments` with `status = 'draft'` and `amount` null,
 * the line's own read). One row per draft, oldest first: the sub, the job, the scope lines
 * ticked, the proposed window, and the bid's sub-labor total as the assembler offers it. The
 * answer is a price, the one number the assembler's Save draft writes; the send stays the
 * board's, as the contract kinds leave the send to the sweep. Pure; `fillInWorkOrdersIo.ts`
 * reads and writes.
 */
export type WorkOrderDraftSource = {
  id: string
  person_id: string
  display_name: string
  job_id: string | null
  created_at: string
  offer_scope_snapshot: unknown
  proposed_start: string | null
  proposed_end: string | null
}

/** The bid's sub-labor rows summed, per job, as the assembler's "From the bid" hint. */
export type WorkOrderBidHint = { jobId: string; rough_in: number; top_out: number; trim_set: number; total: number }

export type WorkOrderSources = {
  drafts: readonly WorkOrderDraftSource[]
  jobs: readonly JobAccountJobLabel[]
  hints: readonly WorkOrderBidHint[]
  nowMs: number
}

export type WorkOrderFillInRow = FillInRowBase & {
  kind: 'work-order'
  commitmentId: string
  subName: string
  jobId: string | null
  jobLabel: string
  createdAt: string
  ageDays: number
  scopeLines: string[]
  proposedStart: string | null
  proposedEnd: string | null
  hint: Omit<WorkOrderBidHint, 'jobId'> | null
}

const money = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const ageWords = (days: number): string => (days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`)

export function workOrderKnows(row: Pick<WorkOrderFillInRow, 'subName' | 'createdAt' | 'ageDays' | 'scopeLines' | 'proposedStart' | 'proposedEnd' | 'hint' | 'jobId'>): string[] {
  const out: string[] = []
  out.push(`Drafted for ${row.subName} ${formatYmdMonthDay(row.createdAt.slice(0, 10))}, ${ageWords(row.ageDays)}.`)
  if (row.scopeLines.length === 0) out.push('No scope lines ticked yet.')
  else {
    const shown = row.scopeLines.slice(0, 4)
    const more = row.scopeLines.length - shown.length
    out.push(`Scope: ${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}.`)
  }
  if (row.proposedStart || row.proposedEnd) out.push(`Proposed ${row.proposedStart ? formatYmdMonthDay(row.proposedStart) : '—'} to ${row.proposedEnd ? formatYmdMonthDay(row.proposedEnd) : '—'}.`)
  if (row.hint) out.push(`From the bid: ${money(row.hint.total)} sub labor. Rough-in ${money(row.hint.rough_in)}, top-out ${money(row.hint.top_out)}, trim-set ${money(row.hint.trim_set)}.`)
  else if (!row.jobId) out.push('No job on the draft yet, so no price hint.')
  else out.push('No bid behind the job, so no price hint.')
  return out
}

/** The oldest draft first, then by the sub. */
export function compareWorkOrderRows(a: WorkOrderFillInRow, b: WorkOrderFillInRow): number {
  return a.createdAt.localeCompare(b.createdAt) || a.subName.localeCompare(b.subName)
}

export function workOrderFillInRows(s: WorkOrderSources): WorkOrderFillInRow[] {
  const jobById = new Map(s.jobs.map((j) => [j.id, j]))
  const hintByJob = new Map(s.hints.filter((h) => h.total > 0).map((h) => [h.jobId, h]))
  return s.drafts
    .map((d): WorkOrderFillInRow => {
      const createdMs = Date.parse(d.created_at)
      const ageDays = Number.isFinite(createdMs) ? Math.max(0, Math.floor((s.nowMs - createdMs) / 86_400_000)) : 0
      const jobLabel = d.job_id ? jobAccountJobLabel(jobById.get(d.job_id), d.job_id) : 'no job yet'
      const snapshot = parseSubWorkOrderSnapshot(d.offer_scope_snapshot)
      const hint = d.job_id ? hintByJob.get(d.job_id) ?? null : null
      const subName = (d.display_name ?? '').trim() || 'the sub'
      const partial = {
        subName,
        jobId: d.job_id,
        createdAt: d.created_at,
        ageDays,
        scopeLines: snapshot.lines.map((l) => l.label.trim()).filter(Boolean),
        proposedStart: d.proposed_start,
        proposedEnd: d.proposed_end,
        hint: hint ? { rough_in: hint.rough_in, top_out: hint.top_out, trim_set: hint.trim_set, total: hint.total } : null,
      }
      return {
        key: fillInRowKey('work-order', d.id),
        kind: 'work-order',
        severity: 'amber',
        title: `${subName} · ${jobLabel} · drafted ${formatYmdMonthDay(d.created_at.slice(0, 10))}`,
        knows: workOrderKnows(partial),
        doorHref: `/jobs?tab=subs&wo=${encodeURIComponent(d.id)}`,
        doorLabel: 'Open the draft',
        commitmentId: d.id,
        jobLabel,
        ...partial,
      }
    })
    .sort(compareWorkOrderRows)
}

export type WorkOrderDecision = { amount: string }

export const EMPTY_WORK_ORDER_DECISION: WorkOrderDecision = { amount: '' }

/** A price above zero, as the assembler requires before a send. */
export function workOrderDecisionReady(d: WorkOrderDecision): boolean {
  const n = Number(d.amount.trim())
  return d.amount.trim() !== '' && Number.isFinite(n) && n > 0
}

export type WorkOrderWrites = { commitmentId: string; amount: number }

export function workOrderWrites(row: WorkOrderFillInRow, d: WorkOrderDecision): WorkOrderWrites | null {
  if (!workOrderDecisionReady(d)) return null
  return { commitmentId: row.commitmentId, amount: Math.round(Number(d.amount.trim()) * 100) / 100 }
}

/** The saved line under the deck: the price, and where the send waits. */
export function workOrderTrailWords(w: WorkOrderWrites): string {
  return `priced ${money(w.amount)} · the board's Next is Send for signature`
}
