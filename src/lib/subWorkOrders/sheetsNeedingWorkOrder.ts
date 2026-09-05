/**
 * "Needs a work order" — derived from the sheets, not from the Pipeline list
 * (Work Orders one-row spine, PR 1). A Sub Labor sheet needs a work order when:
 *   1. it belongs to roster subs — every assignee resolves to a `people`
 *      row of kind `sub` that has no login, or a login whose role is
 *      `subcontractor`. Teammates carry `kind = 'sub'` too (the roster row
 *      behind a login), so the account role is what tells crew pay from a
 *      sub: a sheet with a superintendent, master or helper on it is crew
 *      pay and never needs a work order,
 *   2. money is still open on it (items minus payments), or it is unpriced
 *      with nothing paid — a live sheet with no agreement behind it, and
 *   3. no live or signed work order anchors to the sheet or to its job.
 * Sheets whose job number has no Pipeline row still count; they are labelled
 * by the sheet's own job number + address. Pure: no React, no Supabase.
 */
import { subLaborJobBalance } from '../subLaborOutstanding'
import { splitAssignedToNames } from '../people/laborJobPersonMatch'
import { normalizePersonNameKey } from '../personNameKey'
import type { PeopleLaborJobItemLike } from '../peopleLaborJobItemLineCost'
import { buildJobWorkOrderCoverage, type WorkOrderRowLike } from './workOrderCoverage'

export type NeedsWorkOrderSheet = {
  id: string
  job_number: string | null
  address: string
  assigned_to_name: string
  labor_rate: number | null
  items?: PeopleLaborJobItemLike[]
  payments?: Array<{ amount: number }>
}

export type NeedsWorkOrderRosterPerson = {
  id: string
  name: string
  kind: string
  /** `users.role` behind `people.account_user_id`; null when the person has no login. */
  accountRole?: string | null
}

export type NeedsWorkOrderJob = { id: string; hcp_number: string; customer_name?: string | null; job_address?: string | null }

export type NeedsWorkOrderRow = {
  sheetId: string
  /** Pipeline job when the sheet's number has a ledger row; null for sheets outside the Pipeline. */
  jobId: string | null
  jobNumber: string
  primary: string
  secondary: string | null
  subNames: string[]
  agreed: number
  paid: number
  open: number
  /** No priced items and nothing paid — a sheet that exists but was never priced. */
  unpriced: boolean
}

export type SheetsNeedingWorkOrderInput = {
  sheets: NeedsWorkOrderSheet[]
  /** `people_labor_job_assignees` grouped by sheet id (person ids). Sheets absent here fall back to the name column. */
  assigneesBySheetId: ReadonlyMap<string, readonly string[]>
  roster: NeedsWorkOrderRosterPerson[]
  commitments: WorkOrderRowLike[]
  jobs: NeedsWorkOrderJob[]
  todayYmd: string
}

const numberKey = (n: string | null | undefined) => (n ?? '').trim().toLowerCase()

/** A roster row is a sub when it is kind `sub` and has no login or a subcontractor login. */
export function isRosterSub(p: Pick<NeedsWorkOrderRosterPerson, 'kind' | 'accountRole'> | undefined): boolean {
  if (!p || p.kind !== 'sub') return false
  const role = (p.accountRole ?? '').trim()
  return role === '' || role === 'subcontractor'
}

/** True when every assignee on the sheet is a roster sub (junction first, then the delimited name column). Unresolved names do not count. */
export function isRosterSubSheet(
  sheet: Pick<NeedsWorkOrderSheet, 'id' | 'assigned_to_name'>,
  assigneesBySheetId: ReadonlyMap<string, readonly string[]>,
  personById: ReadonlyMap<string, NeedsWorkOrderRosterPerson>,
  personByNameKey: ReadonlyMap<string, NeedsWorkOrderRosterPerson>,
): boolean {
  const ids = assigneesBySheetId.get(sheet.id)
  if (ids && ids.length > 0) return ids.every((id) => isRosterSub(personById.get(id)))
  const names = splitAssignedToNames(sheet.assigned_to_name)
  if (names.length === 0) return false
  return names.every((n) => isRosterSub(personByNameKey.get(normalizePersonNameKey(n))))
}

export function sheetsNeedingWorkOrder(input: SheetsNeedingWorkOrderInput): NeedsWorkOrderRow[] {
  const personById = new Map(input.roster.map((p) => [p.id, p]))
  const personByNameKey = new Map<string, NeedsWorkOrderRosterPerson>()
  for (const p of input.roster) {
    const k = normalizePersonNameKey(p.name)
    if (k && !personByNameKey.has(k)) personByNameKey.set(k, p)
  }
  const jobsByNumber = new Map(input.jobs.map((j) => [numberKey(j.hcp_number), j]))
  const rowsBySheetId = new Map<string, WorkOrderRowLike[]>()
  const rowsByJobId = new Map<string, WorkOrderRowLike[]>()
  for (const r of input.commitments) {
    if (r.labor_job_id) rowsBySheetId.set(r.labor_job_id, [...(rowsBySheetId.get(r.labor_job_id) ?? []), r])
    if (r.job_id) rowsByJobId.set(r.job_id, [...(rowsByJobId.get(r.job_id) ?? []), r])
  }

  const out: NeedsWorkOrderRow[] = []
  for (const sheet of input.sheets) {
    if (!isRosterSubSheet(sheet, input.assigneesBySheetId, personById, personByNameKey)) continue
    const bal = subLaborJobBalance({ labor_rate: sheet.labor_rate, items: sheet.items, payments: sheet.payments })
    const unpriced = bal.totalCost === 0 && bal.paid === 0 && bal.backcharges === 0
    if (!unpriced && bal.balance <= 0) continue
    const job = jobsByNumber.get(numberKey(sheet.job_number)) ?? null
    const covering = [...(rowsBySheetId.get(sheet.id) ?? []), ...(job ? (rowsByJobId.get(job.id) ?? []) : [])]
    const c = buildJobWorkOrderCoverage(covering, input.todayYmd)
    if (c.kind !== 'none' && c.kind !== 'declined') continue
    const jobNumber = (sheet.job_number ?? '').trim()
    out.push({
      sheetId: sheet.id,
      jobId: job?.id ?? null,
      jobNumber,
      primary: job ? `#${job.hcp_number} · ${job.customer_name ?? 'No customer'}` : jobNumber ? `#${jobNumber}` : 'Sub sheet',
      secondary: job ? job.job_address || null : sheet.address.trim() || null,
      subNames: splitAssignedToNames(sheet.assigned_to_name),
      agreed: bal.totalCost,
      paid: bal.paid,
      open: Math.max(0, bal.balance),
      unpriced,
    })
  }
  return out.sort((a, b) => b.open - a.open || a.jobNumber.localeCompare(b.jobNumber, undefined, { numeric: true }) || a.sheetId.localeCompare(b.sheetId))
}
