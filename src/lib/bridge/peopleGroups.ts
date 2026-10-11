/**
 * The people tables' groups (link PR 12): Vectors' rows in two groups — Field
 * (master, super, field, sub: all of the contribution) and Office & estimators
 * (office, controller, dev, estimator: all of the billing, collecting and
 * bids) — each sorted by contribution then by hours waiting, with a subtotal.
 * Pure.
 */
import type { VectorRow } from './vectors'

export type PeopleGroupId = 'field' | 'office'

const FIELD_ROLES = new Set(['master_technician', 'helpers', 'subcontractor', 'superintendent', 'primary'])
const OFFICE_ROLES = new Set(['assistant', 'controller', 'dev', 'estimator'])

export function peopleGroupOf(row: Pick<VectorRow, 'role' | 'fieldHours' | 'pendingHours'>): PeopleGroupId {
  if (row.role && FIELD_ROLES.has(row.role)) return 'field'
  if (row.role && OFFICE_ROLES.has(row.role)) return 'office'
  return row.fieldHours > 0 || row.pendingHours > 0 ? 'field' : 'office'
}

export type PeopleSubtotal = {
  fieldHours: number
  pendingHours: number
  officeBidHours: number
  earnedUsd: number
  laborUsd: number
  contributionUsd: number | null
  contributionPerHour: number | null
  pctReports: number
  billedUsd: number
  billedCount: number
  collectedUsd: number
  collectedCount: number
  bidsSentUsd: number
  bidsSentCount: number
  bidsWonUsd: number
  bidsWonCount: number
}

export type PeopleGroup = { id: PeopleGroupId; name: string; note: string; rows: VectorRow[]; subtotal: PeopleSubtotal }

const byContributionThenWaiting = (a: VectorRow, b: VectorRow): number => {
  const ca = a.contributionUsd ?? -Infinity
  const cb = b.contributionUsd ?? -Infinity
  if (ca !== cb) return cb - ca
  if (a.pendingHours !== b.pendingHours) return b.pendingHours - a.pendingHours
  return a.name.localeCompare(b.name)
}

function subtotal(rows: VectorRow[]): PeopleSubtotal {
  const s: PeopleSubtotal = { fieldHours: 0, pendingHours: 0, officeBidHours: 0, earnedUsd: 0, laborUsd: 0, contributionUsd: null, contributionPerHour: null, pctReports: 0, billedUsd: 0, billedCount: 0, collectedUsd: 0, collectedCount: 0, bidsSentUsd: 0, bidsSentCount: 0, bidsWonUsd: 0, bidsWonCount: 0 }
  let contribution = 0
  let any = false
  for (const r of rows) {
    s.fieldHours += r.fieldHours
    s.pendingHours += r.pendingHours
    s.officeBidHours += r.officeBidHours
    s.earnedUsd += r.earnedUsd
    s.laborUsd += r.laborUsd
    if (r.contributionUsd != null) {
      contribution += r.contributionUsd
      any = true
    }
    s.pctReports += r.pctReports
    s.billedUsd += r.billedUsd
    s.billedCount += r.billedCount
    s.collectedUsd += r.collectedUsd
    s.collectedCount += r.collectedCount
    s.bidsSentUsd += r.bidsSentUsd
    s.bidsSentCount += r.bidsSentCount
    s.bidsWonUsd += r.bidsWonUsd
    s.bidsWonCount += r.bidsWonCount
  }
  s.contributionUsd = any ? contribution : null
  s.contributionPerHour = any && s.fieldHours > 0 ? contribution / s.fieldHours : null
  return s
}

const hrs = (h: number): string => `${Math.round(h)}h`
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)

export function groupPeopleRows(rows: ReadonlyArray<VectorRow>): PeopleGroup[] {
  const field = rows.filter((r) => peopleGroupOf(r) === 'field').sort(byContributionThenWaiting)
  const office = rows.filter((r) => peopleGroupOf(r) === 'office').sort(byContributionThenWaiting)
  const fs = subtotal(field)
  const os = subtotal(office)
  return [
    { id: 'field', name: 'Field', note: `${field.length} ${plural(field.length, 'person', 'people')} · ${hrs(fs.fieldHours)} approved${fs.pendingHours > 0 ? `, ${hrs(fs.pendingHours)} waiting` : ''} · all of the contribution`, rows: field, subtotal: fs },
    { id: 'office', name: 'Office & estimators', note: `${office.length} ${plural(office.length, 'person', 'people')}, dev counts as office${os.pendingHours > 0 ? ` · ${hrs(os.pendingHours)} waiting` : ''} · all of the billing, collecting and bids`, rows: office, subtotal: os },
  ]
}
