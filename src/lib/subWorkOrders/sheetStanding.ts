/**
 * Where one sheet's money stands, away from the Pay view (punch list #346): whose the sheet is, the Pipeline job it
 * is on, and the Pay view's own words for when it pays (`sheetPayWhen`).
 *
 * The Pay view works this out per row inside `JobsSubLaborTab` (`spineFor`). People → Subs and the job's window
 * need the same answer for the same sheet, so the steps live here and call the same kernels in the same order:
 * work-order coverage, the stage the facts already know, the rail's no-agreement gap, the parties, then the rule.
 * WRAP-UP: `spineFor` should call this, so there is one copy. It is left alone during the spike because sibling
 * sessions are in that file.
 *
 * Pure: no React, no Supabase.
 */
import type { LaborJob } from '../../types/laborJob'
import { normalizePersonNameKey } from '../personNameKey'
import { effectiveSubSheetStage, subSheetWorkEndYmd } from '../subSheetStageDerived'
import type { SubLaborSheetAssignee } from '../subLaborOutstanding'
import type { NeedsWorkOrderRosterPerson } from './rosterSub'
import { buildSheetRail } from './sheetRail'
import { sheetParties, type SheetParties } from './sheetParties'
import { isRosterSubSheet } from './sheetsNeedingWorkOrder'
import { sheetPayWhen, type SheetPayWhen } from './subLaborPayRun'
import { sheetOwedTo, TEAM_SHEET_RULE, type TeamSheetRule } from './teamSheetRule'
import { buildJobWorkOrderCoverage, type WorkOrderRowLike } from './workOrderCoverage'

/** The little of a Pipeline job the rule reads: its number, its name and where its bills stand. */
export type StandingJob = { id: string; hcp_number: string; job_name: string; job_address: string; invoices: ReadonlyArray<{ status: string | null }> }

export type SheetStandingContext = {
  roster: readonly NeedsWorkOrderRosterPerson[]
  personById: ReadonlyMap<string, NeedsWorkOrderRosterPerson>
  personByNameKey: ReadonlyMap<string, NeedsWorkOrderRosterPerson>
  jobsById: ReadonlyMap<string, StandingJob>
  jobsByNumber: ReadonlyMap<string, StandingJob>
  ordersBySheet: ReadonlyMap<string, WorkOrderRowLike[]>
  ordersByJob: ReadonlyMap<string, WorkOrderRowLike[]>
  assigneesByJobId: ReadonlyMap<string, readonly SubLaborSheetAssignee[]>
  assigneeIds: ReadonlyMap<string, string[]>
  todayYmd: string
  rule: TeamSheetRule
}

export function buildSheetStandingContext(i: {
  roster: readonly NeedsWorkOrderRosterPerson[]
  jobs: readonly StandingJob[]
  orders: readonly WorkOrderRowLike[]
  assigneesByJobId: ReadonlyMap<string, readonly SubLaborSheetAssignee[]>
  todayYmd: string
  rule?: TeamSheetRule
}): SheetStandingContext {
  const personById = new Map(i.roster.map((p) => [p.id, p]))
  const personByNameKey = new Map<string, NeedsWorkOrderRosterPerson>()
  for (const p of i.roster) {
    const k = normalizePersonNameKey(p.name)
    if (k && !personByNameKey.has(k)) personByNameKey.set(k, p)
  }
  const ordersBySheet = new Map<string, WorkOrderRowLike[]>()
  const ordersByJob = new Map<string, WorkOrderRowLike[]>()
  for (const r of i.orders) {
    if (r.labor_job_id) ordersBySheet.set(r.labor_job_id, [...(ordersBySheet.get(r.labor_job_id) ?? []), r])
    else if (r.job_id) ordersByJob.set(r.job_id, [...(ordersByJob.get(r.job_id) ?? []), r])
  }
  const assigneeIds = new Map<string, string[]>()
  for (const [id, list] of i.assigneesByJobId) assigneeIds.set(id, list.map((a) => a.personId))
  return {
    roster: i.roster,
    personById,
    personByNameKey,
    jobsById: new Map(i.jobs.map((j) => [j.id, j])),
    jobsByNumber: new Map(i.jobs.filter((j) => j.hcp_number.trim()).map((j) => [j.hcp_number.trim().toLowerCase(), j])),
    ordersBySheet,
    ordersByJob,
    assigneesByJobId: i.assigneesByJobId,
    assigneeIds,
    todayYmd: i.todayYmd,
    rule: i.rule ?? TEAM_SHEET_RULE,
  }
}

export type SheetStanding = { parties: SheetParties; payWhen: SheetPayWhen; job: StandingJob | null }

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function sheetStanding(sheet: LaborJob, bal: { totalCost: number; paid: number; backcharges: number; balance: number }, ctx: SheetStandingContext): SheetStanding {
  const job = (sheet.job_ledger_id ? ctx.jobsById.get(sheet.job_ledger_id) : undefined) ?? (sheet.job_ledger_id ? null : ctx.jobsByNumber.get((sheet.job_number ?? '').trim().toLowerCase())) ?? null
  const covering = [...(ctx.ordersBySheet.get(sheet.id) ?? []), ...(job ? (ctx.ordersByJob.get(job.id) ?? []) : [])]
  const coverage = buildJobWorkOrderCoverage(covering, ctx.todayYmd)
  const crewRail = ctx.roster.length > 0 && !isRosterSubSheet(sheet, ctx.assigneeIds as Map<string, string[]>, ctx.personById as Map<string, NeedsWorkOrderRosterPerson>, ctx.personByNameKey as Map<string, NeedsWorkOrderRosterPerson>)
  const unpriced = bal.totalCost === 0 && bal.paid === 0 && bal.backcharges === 0
  const open = Math.max(0, bal.balance)
  const eff = effectiveSubSheetStage({ stage: sheet.stage, stageSource: sheet.stage_source, stageChangedAt: sheet.stage_changed_at ?? null, progressPct: sheet.progress_pct ?? null, progressAt: sheet.progress_at ?? null, workEndYmd: subSheetWorkEndYmd(covering), todayYmd: ctx.todayYmd })
  const rail = buildSheetRail({ coverage, sheetStage: eff.stage, payableAfter: sheet.payable_after ?? null, agreed: bal.totalCost, open, unpriced, crewPay: crewRail })
  const parties = sheetParties(sheet, ctx.assigneesByJobId.get(sheet.id), ctx)
  const crew = ctx.roster.length > 0 && parties.crew
  const bills = job ? { out: job.invoices.filter((i) => i.status && i.status !== 'draft').length, paid: job.invoices.filter((i) => i.status === 'paid').length } : null
  const to = sheetOwedTo(parties, ctx.rule)
  const payWhen =
    crew && to.kind === 'team' && !unpriced && bal.balance > 0
      ? teamSheetPayWhen(sheet, open, ctx.todayYmd)
      : sheetPayWhen({ stage: eff.stage, payableAfter: sheet.payable_after ?? null, payHoldReason: sheet.pay_hold_reason ?? null, bills, gap: rail.gap, crew: crew && !to.counts, balance: bal.balance, unpriced, todayYmd: ctx.todayYmd })
  return { parties, payWhen, job }
}

/**
 * When a teammate's own sheet pays (the bonus rule, a candidate): it has no inspection and no customer bill to wait
 * on, so it is ready unless the office holds it or gives it a later day. The sub's ladder would park it at "After
 * inspection". The caller has already checked that it is priced and has money open.
 */
export function teamSheetPayWhen(sheet: Pick<LaborJob, 'pay_hold_reason' | 'payable_after'>, open: number, todayYmd: string): SheetPayWhen {
  const hold = (sheet.pay_hold_reason ?? '').trim()
  if (hold) return { kind: 'hold', label: 'On hold', detail: hold, tone: 'red', rank: 3 }
  const payable = (sheet.payable_after ?? '').trim().slice(0, 10)
  if (payable && payable > todayYmd) return { kind: 'queued', label: `Queued · ${payable.slice(5).replace('-', '/')}`, detail: `payable after ${payable}`, tone: 'blue', rank: 1 }
  return { kind: 'ready', label: 'Ready', detail: `sub labor to a teammate · ${money(open)} with nothing to wait on`, tone: 'green', rank: 0 }
}
