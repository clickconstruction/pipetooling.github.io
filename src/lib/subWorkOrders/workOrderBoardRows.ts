/**
 * The Work Orders board (one-row spine, PR 3): every row is a sub sheet,
 * with the agreement behind it, its money, its rail and the office's next
 * move. Sorted by how far left the rail's current dot sits.
 *
 * Rows come from two places:
 *   - roster-sub sheets with money open (or never priced), or with any
 *     agreement behind them — paid-up sheets with no order are history and
 *     stay off the board; crew pay sheets never appear (isRosterSubSheet);
 *   - orders with no sheet yet (a job- or step-anchored draft / offer /
 *     decline), so an agreement in flight is never invisible.
 *
 * Coverage: an order anchored to the sheet covers that sheet; an order
 * anchored to a job (no sheet) covers every sheet on that job. Pure.
 */
import { subLaborJobBalance } from '../subLaborOutstanding'
import { splitAssignedToNames } from '../people/laborJobPersonMatch'
import { normalizePersonNameKey } from '../personNameKey'
import { normalizeSubSheetStage } from '../subSheetStage'
import { buildJobWorkOrderCoverage, type JobWorkOrderCoverage, type WorkOrderRowLike } from './workOrderCoverage'
import { isRosterSubSheet, type NeedsWorkOrderJob, type NeedsWorkOrderRosterPerson, type NeedsWorkOrderSheet } from './sheetsNeedingWorkOrder'
import { buildSheetRail, sheetNextAction, SHEET_RAIL_GROUP_LABEL, type SheetNextAction, type SheetRail, type SheetRailGroup } from './sheetRail'

export type WorkOrderBoardSheet = NeedsWorkOrderSheet & {
  stage?: string | null
  payable_after?: string | null
  job_date?: string | null
  created_at?: string | null
}

export type WorkOrderBoardRow = {
  /** `sheet:<id>` or `order:<id>` — stable across reloads. */
  key: string
  sheetId: string | null
  /** The order the rail reads (signed beats sent beats draft beats declined); null for a bare sheet. */
  commitmentId: string | null
  recordId: string | null
  jobId: string | null
  jobNumber: string
  primary: string
  secondary: string | null
  /** The sheet's job number has no Pipeline row. */
  notInPipeline: boolean
  subNames: string[]
  subName: string
  /** The sub's roster id when the sheet has exactly one assignee — hands the assembler its sub. */
  personId: string | null
  agreed: number
  paid: number
  open: number
  unpriced: boolean
  /** The sheet's own date (job_date, else created) — "sheet dated Aug 20". */
  sheetDate: string | null
  coverage: JobWorkOrderCoverage
  rail: SheetRail
  next: SheetNextAction
  group: SheetRailGroup
}

export type WorkOrderBoardTiles = {
  /** Open money on sheets with nothing signed — the number on a handshake. */
  handshakeUsd: number
  handshakeCount: number
  offersOut: number
  signedThisMonth: number
}

export type WorkOrderBoard = {
  rows: WorkOrderBoardRow[]
  groups: Record<SheetRailGroup, WorkOrderBoardRow[]>
  counts: Record<SheetRailGroup | 'all', number>
  tiles: WorkOrderBoardTiles
}

export const WORK_ORDER_BOARD_GROUPS: readonly SheetRailGroup[] = ['no_agreement', 'drafted', 'sent', 'signed']

export type WorkOrderBoardInput = {
  sheets: WorkOrderBoardSheet[]
  assigneesBySheetId: ReadonlyMap<string, readonly string[]>
  roster: NeedsWorkOrderRosterPerson[]
  commitments: WorkOrderRowLike[]
  jobs: NeedsWorkOrderJob[]
  todayYmd: string
  /** Label for an order that has no sheet and no Pipeline job (snapshot / step name) — the component knows those. */
  orderLabels?: ReadonlyMap<string, { primary: string; secondary: string | null }>
  nudgeAfterDays?: number
}

const numberKey = (n: string | null | undefined) => (n ?? '').trim().toLowerCase()
const liveKind = (c: JobWorkOrderCoverage) => c.kind === 'draft' || c.kind === 'sent' || c.kind === 'signed' || c.kind === 'declined'

/** Which order a coverage picked, so the row can open it. */
function coverageOrderId(c: JobWorkOrderCoverage): string | null {
  return c.kind === 'none' ? null : c.id
}

export function buildWorkOrderBoard(input: WorkOrderBoardInput): WorkOrderBoard {
  const personById = new Map(input.roster.map((p) => [p.id, p]))
  const personByNameKey = new Map<string, NeedsWorkOrderRosterPerson>()
  for (const p of input.roster) {
    const k = normalizePersonNameKey(p.name)
    if (k && !personByNameKey.has(k)) personByNameKey.set(k, p)
  }
  const jobsByNumber = new Map(input.jobs.map((j) => [numberKey(j.hcp_number), j]))
  const jobsById = new Map(input.jobs.map((j) => [j.id, j]))
  const bySheet = new Map<string, WorkOrderRowLike[]>()
  const byJob = new Map<string, WorkOrderRowLike[]>()
  for (const r of input.commitments) {
    if (r.status === 'cancelled') continue
    if (r.labor_job_id) bySheet.set(r.labor_job_id, [...(bySheet.get(r.labor_job_id) ?? []), r])
    else if (r.job_id) byJob.set(r.job_id, [...(byJob.get(r.job_id) ?? []), r])
  }
  const represented = new Set<string>()
  const rows: WorkOrderBoardRow[] = []

  for (const sheet of input.sheets) {
    if (!isRosterSubSheet(sheet, input.assigneesBySheetId, personById, personByNameKey)) continue
    const bal = subLaborJobBalance({ labor_rate: sheet.labor_rate, items: sheet.items, payments: sheet.payments })
    const unpriced = bal.totalCost === 0 && bal.paid === 0 && bal.backcharges === 0
    const open = Math.max(0, bal.balance)
    const job = jobsByNumber.get(numberKey(sheet.job_number)) ?? null
    const covering = [...(bySheet.get(sheet.id) ?? []), ...(job ? (byJob.get(job.id) ?? []) : [])]
    for (const r of covering) represented.add(r.id)
    const coverage = buildJobWorkOrderCoverage(covering, input.todayYmd)
    const inPlay = unpriced || open > 0 || liveKind(coverage)
    if (!inPlay) continue
    const subNames = splitAssignedToNames(sheet.assigned_to_name)
    const subName = subNames.join(', ')
    const ids = input.assigneesBySheetId.get(sheet.id)
    const personId = ids && ids.length > 0 ? (ids.length === 1 ? ids[0]! : null) : subNames.length === 1 ? (personByNameKey.get(normalizePersonNameKey(subNames[0]!))?.id ?? null) : null
    const rail = buildSheetRail({ coverage, sheetStage: normalizeSubSheetStage(sheet.stage), payableAfter: sheet.payable_after ?? null, agreed: bal.totalCost, open, unpriced })
    const next = sheetNextAction(rail, coverage, { subName, agreed: bal.totalCost, open, unpriced, todayYmd: input.todayYmd, nudgeAfterDays: input.nudgeAfterDays })
    const jobNumber = (sheet.job_number ?? '').trim()
    rows.push({
      key: `sheet:${sheet.id}`,
      sheetId: sheet.id,
      commitmentId: coverageOrderId(coverage),
      recordId: coverage.kind === 'signed' ? coverage.recordId : null,
      jobId: job?.id ?? null,
      jobNumber,
      primary: job ? `#${job.hcp_number} · ${job.customer_name ?? 'No customer'}` : jobNumber ? `#${jobNumber}` : 'Sub sheet',
      secondary: job ? job.job_address || null : sheet.address.trim() || null,
      notInPipeline: !job,
      subNames,
      subName,
      personId,
      agreed: bal.totalCost,
      paid: bal.paid,
      open,
      unpriced,
      sheetDate: (sheet.job_date ?? sheet.created_at ?? '').slice(0, 10) || null,
      coverage,
      rail,
      next,
      group: rail.group,
    })
  }

  // Orders with no sheet behind them (and no sheet on their job): an agreement in flight.
  for (const r of input.commitments) {
    if (r.status === 'cancelled' || represented.has(r.id) || r.labor_job_id) continue
    const coverage = buildJobWorkOrderCoverage([r], input.todayYmd)
    if (!liveKind(coverage)) continue
    represented.add(r.id)
    const job = r.job_id ? (jobsById.get(r.job_id) ?? null) : null
    const amount = r.amount == null ? null : Number(r.amount) || 0
    const unpriced = amount == null
    const agreed = amount ?? 0
    const rail = buildSheetRail({ coverage, sheetStage: null, agreed, open: agreed, unpriced })
    const next = sheetNextAction(rail, coverage, { subName: r.display_name, agreed, open: agreed, unpriced, todayYmd: input.todayYmd, nudgeAfterDays: input.nudgeAfterDays })
    const fallback = input.orderLabels?.get(r.id) ?? null
    rows.push({
      key: `order:${r.id}`,
      sheetId: null,
      commitmentId: r.id,
      recordId: r.record_id,
      jobId: job?.id ?? null,
      jobNumber: job?.hcp_number ?? '',
      primary: job ? `#${job.hcp_number} · ${job.customer_name ?? 'No customer'}` : (fallback?.primary ?? 'Unanchored'),
      secondary: job ? job.job_address || null : (fallback?.secondary ?? null),
      notInPipeline: false,
      subNames: [r.display_name],
      subName: r.display_name,
      personId: (r as { person_id?: string | null }).person_id ?? null,
      agreed,
      paid: 0,
      open: agreed,
      unpriced,
      sheetDate: null,
      coverage,
      rail,
      next,
      group: rail.group,
    })
  }

  const groupOrder = new Map(WORK_ORDER_BOARD_GROUPS.map((g, i) => [g, i]))
  rows.sort(
    (a, b) =>
      (groupOrder.get(a.group) ?? 9) - (groupOrder.get(b.group) ?? 9) ||
      a.rail.position - b.rail.position ||
      b.open - a.open ||
      a.jobNumber.localeCompare(b.jobNumber, undefined, { numeric: true }) ||
      a.key.localeCompare(b.key),
  )
  const groups: Record<SheetRailGroup, WorkOrderBoardRow[]> = { no_agreement: [], drafted: [], sent: [], signed: [] }
  for (const r of rows) groups[r.group].push(r)
  const month = input.todayYmd.slice(0, 7)
  const tiles: WorkOrderBoardTiles = {
    handshakeUsd: groups.no_agreement.reduce((s, r) => s + r.open, 0),
    handshakeCount: groups.no_agreement.length,
    offersOut: groups.sent.length,
    signedThisMonth: groups.signed.filter((r) => r.coverage.kind === 'signed' && (r.coverage.signedOn ?? '').startsWith(month)).length,
  }
  return {
    rows,
    groups,
    counts: { all: rows.length, no_agreement: groups.no_agreement.length, drafted: groups.drafted.length, sent: groups.sent.length, signed: groups.signed.length },
    tiles,
  }
}

/** The search box: sub, job number, customer / label, address, WO number. */
export function workOrderBoardRowMatches(row: WorkOrderBoardRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [row.subName, row.jobNumber, row.primary, row.secondary ?? '', row.recordId ?? ''].join(' ').toLowerCase().includes(q)
}

export type WorkOrderBoardFilterKey = 'all' | SheetRailGroup

export const WORK_ORDER_BOARD_FILTERS: ReadonlyArray<{ key: WorkOrderBoardFilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'no_agreement', label: 'No agreement' },
  { key: 'drafted', label: 'Drafted' },
  { key: 'sent', label: 'Sent' },
  { key: 'signed', label: 'Signed' },
]

/** `?wof=` still carries the v2.2819 filter words (Needs You links to `drafts`); map them onto rail groups. */
export function workOrderBoardFilterFromParam(value: string | null | undefined): WorkOrderBoardFilterKey | null {
  switch ((value ?? '').trim()) {
    case 'drafts':
    case 'drafted':
      return 'drafted'
    case 'awaiting':
    case 'sent':
      return 'sent'
    case 'signed':
      return 'signed'
    case 'declined':
    case 'expired':
    case 'no_agreement':
      return 'no_agreement'
    case 'all':
      return 'all'
    default:
      return null
  }
}

export { SHEET_RAIL_GROUP_LABEL }
