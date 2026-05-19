import {
  buildHourlyWageLookupByNormalizedName,
  hourlyWageForUserName,
} from './bidBoardWeeklyEstimatorLaborCost'

export type OverheadPayConfigInput = { person_name: string; hourly_wage: number | null }

export type OverheadClockSessionRow = {
  id: string
  user_id: string
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  job_ledger_id: string | null
  bid_id: string | null
  approved_at: string | null
  rejected_at: string | null
  revoked_at: string | null
  users: { name: string | null } | null
  /**
   * Free-text notes captured at clock-in / clock-out. Optional on the input row
   * so consumers that only do hour math (e.g. `peopleHoursUnallocatedRows`,
   * Quickfill's unassigned-field-time loader) don't have to fetch or carry
   * the column. Overhead-display consumers should select `notes` from
   * `clock_sessions` and pass it through.
   */
  notes?: string | null
}

export type OverheadSessionDetailLine = {
  sessionId: string
  workDate: string
  userName: string
  bucket: 'office' | 'bid'
  hours: number
  laborUsd: number
  missingWage: boolean
  jobLedgerId: string | null
  bidId: string | null
  /** Session notes (trimmed; null/empty when nothing was captured). */
  notes: string | null
}

/** Scope for overhead breakdown modal (labor buckets + office materials + combined total + other jobs). */
export type OverheadDetailScope = 'office' | 'bid' | 'total' | 'officeParts' | 'otherJobs'

export function filterOverheadDetailLines(
  lines: readonly OverheadSessionDetailLine[],
  scope: OverheadDetailScope,
): OverheadSessionDetailLine[] {
  if (scope === 'total') return [...lines]
  if (scope === 'office' || scope === 'bid') return lines.filter((l) => l.bucket === scope)
  return []
}

export type OverheadPersonBreakdownRow = {
  userName: string
  hours: number
  laborUsd: number
  missingWage: boolean
}

/** One bucket (office or bid): sum hours and $ per person. Caller should pass pre-filtered lines. */
export function aggregateOverheadDetailByPerson(
  lines: readonly OverheadSessionDetailLine[],
): OverheadPersonBreakdownRow[] {
  const byName = new Map<string, { hours: number; laborUsd: number; missingWage: boolean }>()
  for (const l of lines) {
    const cur = byName.get(l.userName) ?? { hours: 0, laborUsd: 0, missingWage: false }
    cur.hours += l.hours
    cur.laborUsd += l.laborUsd
    cur.missingWage = cur.missingWage || l.missingWage
    byName.set(l.userName, cur)
  }
  return [...byName.entries()]
    .map(([userName, v]) => ({
      userName,
      hours: v.hours,
      laborUsd: v.laborUsd,
      missingWage: v.missingWage,
    }))
    .sort((a, b) => a.userName.localeCompare(b.userName))
}

export type OverheadPersonTotalScopeRow = {
  userName: string
  hours: number
  officeLaborUsd: number
  bidLaborUsd: number
  totalLaborUsd: number
  missingWage: boolean
}

/** Both buckets: per-person office $, bid $, and combined total $ (no double-count). */
export function aggregateOverheadDetailByPersonTotalScope(
  lines: readonly OverheadSessionDetailLine[],
): OverheadPersonTotalScopeRow[] {
  const byName = new Map<
    string,
    { hours: number; officeLaborUsd: number; bidLaborUsd: number; missingWage: boolean }
  >()
  for (const l of lines) {
    const cur = byName.get(l.userName) ?? {
      hours: 0,
      officeLaborUsd: 0,
      bidLaborUsd: 0,
      missingWage: false,
    }
    cur.hours += l.hours
    if (l.bucket === 'office') cur.officeLaborUsd += l.laborUsd
    else cur.bidLaborUsd += l.laborUsd
    cur.missingWage = cur.missingWage || l.missingWage
    byName.set(l.userName, cur)
  }
  return [...byName.entries()]
    .map(([userName, v]) => ({
      userName,
      hours: v.hours,
      officeLaborUsd: v.officeLaborUsd,
      bidLaborUsd: v.bidLaborUsd,
      totalLaborUsd: v.officeLaborUsd + v.bidLaborUsd,
      missingWage: v.missingWage,
    }))
    .sort((a, b) => a.userName.localeCompare(b.userName))
}

export type OverheadDayAggregate = {
  work_date: string
  officeLaborUsd: number
  bidLaborUsd: number
  totalUsd: number
  /** Approved closed office + bid overhead session hours (same sessions as dollar split). */
  laborHours: number
}

/** Merged daily row: overhead labor + office parts + separate other-jobs cost (not in totalUsd). */
export type OverheadDayMergedRow = {
  work_date: string
  officeLaborUsd: number
  bidLaborUsd: number
  officePartsUsd: number
  totalUsd: number
  /** Office + bid overhead labor hours only (not other jobs; parts add no hours). */
  totalLaborHours: number
  otherJobsUsd: number
  /** Other-jobs jobs-ledger labor hours only (materials add no hours). */
  otherJobsLaborHours: number
}

/** Office Total ($) ÷ Field Total ($) for the overhead table; null when field-total dollars are not positive. */
export function overheadFactorTotalOverOtherJobs(totalUsd: number, otherJobsUsd: number): number | null {
  if (!Number.isFinite(totalUsd) || !Number.isFinite(otherJobsUsd)) return null
  if (otherJobsUsd <= 0) return null
  return totalUsd / otherJobsUsd
}

export type OtherJobsLaborDetailLine = {
  sessionId: string
  workDate: string
  userName: string
  hours: number
  laborUsd: number
  missingWage: boolean
  jobLedgerId: string
  /** Session notes (trimmed; null/empty when nothing was captured). */
  notes: string | null
}

/** Approved closed clock labor on any jobs_ledger except `officeJobLedgerId` (all jobs if office null). Bid-only sessions excluded (no job_ledger_id). */
export function buildOtherJobsLaborByDay(args: {
  sessions: readonly OverheadClockSessionRow[]
  officeJobLedgerId: string | null
  wageByNormalizedName: Map<string, number | null>
}): {
  laborUsdByDay: Map<string, number>
  laborHoursByDay: Map<string, number>
  detailByDay: Map<string, OtherJobsLaborDetailLine[]>
} {
  const { sessions, officeJobLedgerId, wageByNormalizedName } = args
  const laborUsdByDay = new Map<string, number>()
  const laborHoursByDay = new Map<string, number>()
  const detailByDay = new Map<string, OtherJobsLaborDetailLine[]>()

  for (const s of sessions) {
    if (s.rejected_at || s.revoked_at) continue
    if (s.approved_at == null) continue
    if (s.clocked_out_at == null) continue
    const jid = s.job_ledger_id
    if (jid == null || jid === '') continue
    if (officeJobLedgerId && jid === officeJobLedgerId) continue

    const hours = approvedClosedSessionHours(s)
    if (hours == null || hours <= 0) continue

    const displayName = (s.users?.name ?? '').trim() || 'Unknown'
    const wage = hourlyWageForUserName(displayName, wageByNormalizedName)
    const missingWage = wage == null || !Number.isFinite(wage)
    const laborUsd = missingWage ? 0 : hours * wage

    const wd = s.work_date
    laborUsdByDay.set(wd, (laborUsdByDay.get(wd) ?? 0) + laborUsd)
    laborHoursByDay.set(wd, (laborHoursByDay.get(wd) ?? 0) + hours)

    const trimmedNotes = (s.notes ?? '').trim()
    const line: OtherJobsLaborDetailLine = {
      sessionId: s.id,
      workDate: wd,
      userName: displayName,
      hours,
      laborUsd,
      missingWage,
      jobLedgerId: jid,
      notes: trimmedNotes.length > 0 ? trimmedNotes : null,
    }
    const list = detailByDay.get(wd) ?? []
    list.push(line)
    detailByDay.set(wd, list)
  }

  for (const [k, list] of detailByDay) {
    list.sort((a, b) => `${a.userName} ${a.sessionId}`.localeCompare(`${b.userName} ${b.sessionId}`))
    detailByDay.set(k, list)
  }

  return { laborUsdByDay, laborHoursByDay, detailByDay }
}

export function aggregateOtherJobsLaborByPerson(lines: readonly OtherJobsLaborDetailLine[]): OverheadPersonBreakdownRow[] {
  const byName = new Map<string, { hours: number; laborUsd: number; missingWage: boolean }>()
  for (const l of lines) {
    const cur = byName.get(l.userName) ?? { hours: 0, laborUsd: 0, missingWage: false }
    cur.hours += l.hours
    cur.laborUsd += l.laborUsd
    cur.missingWage = cur.missingWage || l.missingWage
    byName.set(l.userName, cur)
  }
  return [...byName.entries()]
    .map(([userName, v]) => ({
      userName,
      hours: v.hours,
      laborUsd: v.laborUsd,
      missingWage: v.missingWage,
    }))
    .sort((a, b) => a.userName.localeCompare(b.userName))
}

/** Union calendar days from overhead labor, office parts, and other-jobs labor/parts. */
export function mergeOverheadDayTableRows(
  laborByDay: readonly OverheadDayAggregate[],
  officePartsUsdByDay: ReadonlyMap<string, number>,
  otherJobsLaborUsdByDay: ReadonlyMap<string, number>,
  otherJobsLaborHoursByDay: ReadonlyMap<string, number>,
  otherJobsPartsUsdByDay: ReadonlyMap<string, number>,
): OverheadDayMergedRow[] {
  const keys = new Set<string>()
  for (const r of laborByDay) keys.add(r.work_date)
  for (const k of officePartsUsdByDay.keys()) keys.add(k)
  for (const k of otherJobsLaborUsdByDay.keys()) keys.add(k)
  for (const k of otherJobsLaborHoursByDay.keys()) keys.add(k)
  for (const k of otherJobsPartsUsdByDay.keys()) keys.add(k)

  return [...keys]
    .sort((a, b) => a.localeCompare(b))
    .map((work_date) => {
      const labor = laborByDay.find((d) => d.work_date === work_date)
      const officeLaborUsd = labor?.officeLaborUsd ?? 0
      const bidLaborUsd = labor?.bidLaborUsd ?? 0
      const officePartsUsd = officePartsUsdByDay.get(work_date) ?? 0
      const ojl = otherJobsLaborUsdByDay.get(work_date) ?? 0
      const ojHours = otherJobsLaborHoursByDay.get(work_date) ?? 0
      const ojp = otherJobsPartsUsdByDay.get(work_date) ?? 0
      return {
        work_date,
        officeLaborUsd,
        bidLaborUsd,
        officePartsUsd,
        totalUsd: officeLaborUsd + bidLaborUsd + officePartsUsd,
        totalLaborHours: labor?.laborHours ?? 0,
        otherJobsUsd: ojl + ojp,
        otherJobsLaborHours: ojHours,
      }
    })
}

/** @deprecated Use mergeOverheadDayTableRows with empty other-jobs maps. */
export function mergeOfficePartsIntoOverheadDays(
  laborByDay: readonly OverheadDayAggregate[],
  partsUsdByDay: ReadonlyMap<string, number>,
): OverheadDayMergedRow[] {
  return mergeOverheadDayTableRows(laborByDay, partsUsdByDay, new Map(), new Map(), new Map())
}

/** Office job wins when it matches; else bid-only overhead when `bid_id` is set. */
export function overheadBucketForSession(
  officeJobLedgerId: string | null | undefined,
  jobLedgerId: string | null | undefined,
  bidId: string | null | undefined,
): 'office' | 'bid' | null {
  if (officeJobLedgerId && jobLedgerId && jobLedgerId === officeJobLedgerId) return 'office'
  if (bidId) return 'bid'
  return null
}

export function approvedClosedSessionHours(
  session: Pick<OverheadClockSessionRow, 'clocked_in_at' | 'clocked_out_at'>,
): number | null {
  const out = session.clocked_out_at
  if (out == null) return null
  const t0 = new Date(session.clocked_in_at).getTime()
  const t1 = new Date(out).getTime()
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return null
  return (t1 - t0) / 3600000
}

function sessionIncludedForOverheadUsd(session: OverheadClockSessionRow): boolean {
  if (session.rejected_at || session.revoked_at) return false
  if (session.approved_at == null) return false
  return session.clocked_out_at != null
}

export function buildOverheadWageLookup(configs: readonly OverheadPayConfigInput[]): Map<string, number | null> {
  return buildHourlyWageLookupByNormalizedName(configs)
}

export type OverheadDailyBuildResult = {
  byDay: OverheadDayAggregate[]
  detailByDay: Map<string, OverheadSessionDetailLine[]>
}

/**
 * Aggregates approved, closed sessions into per-day office vs bid labor $.
 * Labor $ = session hours × `hourly_wage` when wage is configured; otherwise $0 with `missingWage` on the detail line.
 */
export function buildOverheadDailyLabor(args: {
  sessions: readonly OverheadClockSessionRow[]
  officeJobLedgerId: string | null
  wageByNormalizedName: Map<string, number | null>
}): OverheadDailyBuildResult {
  const { sessions, officeJobLedgerId, wageByNormalizedName } = args

  const dayOffice = new Map<string, number>()
  const dayBid = new Map<string, number>()
  const dayLaborHours = new Map<string, number>()
  const detailByDay = new Map<string, OverheadSessionDetailLine[]>()

  for (const s of sessions) {
    if (!sessionIncludedForOverheadUsd(s)) continue

    const bucket = overheadBucketForSession(officeJobLedgerId, s.job_ledger_id, s.bid_id)
    if (bucket == null) continue

    const hours = approvedClosedSessionHours(s)
    if (hours == null || hours <= 0) continue

    const displayName = (s.users?.name ?? '').trim() || 'Unknown'
    const wage = hourlyWageForUserName(displayName, wageByNormalizedName)
    const missingWage = wage == null || !Number.isFinite(wage)
    const laborUsd = missingWage ? 0 : hours * wage

    const wd = s.work_date
    dayLaborHours.set(wd, (dayLaborHours.get(wd) ?? 0) + hours)
    if (bucket === 'office') {
      dayOffice.set(wd, (dayOffice.get(wd) ?? 0) + laborUsd)
    } else {
      dayBid.set(wd, (dayBid.get(wd) ?? 0) + laborUsd)
    }

    const trimmedNotes = (s.notes ?? '').trim()
    const line: OverheadSessionDetailLine = {
      sessionId: s.id,
      workDate: wd,
      userName: displayName,
      bucket,
      hours,
      laborUsd,
      missingWage,
      jobLedgerId: s.job_ledger_id,
      bidId: s.bid_id,
      notes: trimmedNotes.length > 0 ? trimmedNotes : null,
    }
    const list = detailByDay.get(wd) ?? []
    list.push(line)
    detailByDay.set(wd, list)
  }

  const dayKeys = new Set<string>([...dayOffice.keys(), ...dayBid.keys()])
  const byDay: OverheadDayAggregate[] = [...dayKeys]
    .sort((a, b) => a.localeCompare(b))
    .map((work_date) => {
      const officeLaborUsd = dayOffice.get(work_date) ?? 0
      const bidLaborUsd = dayBid.get(work_date) ?? 0
      return {
        work_date,
        officeLaborUsd,
        bidLaborUsd,
        totalUsd: officeLaborUsd + bidLaborUsd,
        laborHours: dayLaborHours.get(work_date) ?? 0,
      }
    })

  return { byDay, detailByDay }
}

export { payConfigLookupKey } from './bidBoardWeeklyEstimatorLaborCost'