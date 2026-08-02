import { payConfigLookupKey } from './bidBoardWeeklyEstimatorLaborCost'
// Benign import cycle (function-declaration only): officeJobRateSplit imports
// approvedClosedSessionHours from this module.
import { shouldUseDualRate } from './officeJobRateSplit'

export type OverheadPayConfigInput = {
  person_name: string
  /** Canonical roster id (`people_pay_config.person_id`) — preferred join key when provided. */
  person_id?: string | null
  hourly_wage: number | null
  /** Second hourly rate for office/bid time (dual-rate opt-in). Omitted/null = single rate. */
  office_hourly_wage?: number | null
  is_salary?: boolean | null
}

/**
 * Per-person wage pair for overhead pricing. `officeWage` prices office- and
 * bid-bucket sessions; `fieldWage` prices field (other-jobs) sessions. For
 * dual-rate people (`shouldUseDualRate` — hourly with an office rate set)
 * `officeWage` is `office_hourly_wage`, matching what payroll actually pays
 * for that time (`officeJobRateSplit`); for everyone else both are
 * `hourly_wage`.
 */
export type OverheadWageRates = { fieldWage: number | null; officeWage: number | null }

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
  wageByNormalizedName: Map<string, OverheadWageRates>
  /** Person-id-first join (C1): `people.id` → rates. Used before the name path when provided. */
  wageByPersonId?: ReadonlyMap<string, OverheadWageRates>
  /** `users.id` → `people.id` (via `people.account_user_id`). Required for the id-first path. */
  personIdByUserId?: ReadonlyMap<string, string>
}): {
  laborUsdByDay: Map<string, number>
  laborHoursByDay: Map<string, number>
  detailByDay: Map<string, OtherJobsLaborDetailLine[]>
} {
  const { sessions, officeJobLedgerId, wageByNormalizedName, wageByPersonId, personIdByUserId } = args
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
    const wage =
      overheadWageRatesForSession(
        { userId: s.user_id, userDisplayName: displayName },
        { wageByNormalizedName, wageByPersonId, personIdByUserId },
      )?.fieldWage ?? null
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
  const laborByDate = new Map<string, OverheadDayAggregate>()
  for (const r of laborByDay) {
    keys.add(r.work_date)
    laborByDate.set(r.work_date, r)
  }
  for (const k of officePartsUsdByDay.keys()) keys.add(k)
  for (const k of otherJobsLaborUsdByDay.keys()) keys.add(k)
  for (const k of otherJobsLaborHoursByDay.keys()) keys.add(k)
  for (const k of otherJobsPartsUsdByDay.keys()) keys.add(k)

  return [...keys]
    .sort((a, b) => a.localeCompare(b))
    .map((work_date) => {
      const labor = laborByDate.get(work_date)
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

function overheadWageRatesFromConfig(c: OverheadPayConfigInput): OverheadWageRates {
  const officeWage = shouldUseDualRate(c) ? c.office_hourly_wage ?? null : c.hourly_wage
  return { fieldWage: c.hourly_wage, officeWage }
}

export function buildOverheadWageLookup(configs: readonly OverheadPayConfigInput[]): Map<string, OverheadWageRates> {
  const m = new Map<string, OverheadWageRates>()
  for (const c of configs) {
    m.set(payConfigLookupKey(c.person_name), overheadWageRatesFromConfig(c))
  }
  return m
}

/**
 * Person-id-keyed companion to {@link buildOverheadWageLookup} (identity plan
 * C1 — see `payFlagsIndex`): `people.id` → rates. Configs without a
 * `person_id` are simply absent here and resolve via the name fallback.
 */
export function buildOverheadWageLookupByPersonId(
  configs: readonly OverheadPayConfigInput[],
): Map<string, OverheadWageRates> {
  const m = new Map<string, OverheadWageRates>()
  for (const c of configs) {
    if (c.person_id) m.set(c.person_id, overheadWageRatesFromConfig(c))
  }
  return m
}

/** `hourlyWageForUserName` analog for the wage-pair lookup (null when the name has no pay-config row). */
export function overheadWageRatesForUserName(
  userDisplayName: string | null | undefined,
  wageByNormalizedName: Map<string, OverheadWageRates>,
): OverheadWageRates | null {
  const raw = userDisplayName?.trim() ?? ''
  if (!raw) return null
  return wageByNormalizedName.get(payConfigLookupKey(raw)) ?? null
}

/**
 * Person-id-FIRST wage resolution for a clock session (identity plan C1,
 * mirroring `payFlagsIndex`): `user_id` → `people.account_user_id` →
 * pay-config `person_id`, with the historical trimmed/lowercased-name match
 * as the fallback. A rename between `users.name` and
 * `people_pay_config.person_name` used to zero the session's labor $ while
 * keeping its hours; with an id hit the rename no longer matters.
 */
export function overheadWageRatesForSession(
  session: { userId?: string | null; userDisplayName?: string | null },
  lookups: {
    wageByNormalizedName: Map<string, OverheadWageRates>
    wageByPersonId?: ReadonlyMap<string, OverheadWageRates>
    personIdByUserId?: ReadonlyMap<string, string>
  },
): OverheadWageRates | null {
  const { wageByNormalizedName, wageByPersonId, personIdByUserId } = lookups
  if (session.userId && wageByPersonId && personIdByUserId) {
    const personId = personIdByUserId.get(session.userId)
    if (personId) {
      const viaId = wageByPersonId.get(personId)
      if (viaId) return viaId
    }
  }
  return overheadWageRatesForUserName(session.userDisplayName, wageByNormalizedName)
}

export type OverheadDailyBuildResult = {
  byDay: OverheadDayAggregate[]
  detailByDay: Map<string, OverheadSessionDetailLine[]>
}

/**
 * Aggregates approved, closed sessions into per-day office vs bid labor $.
 * Labor $ = session hours × the person's office-bucket wage (`OverheadWageRates.officeWage`:
 * `office_hourly_wage` for dual-rate people, else `hourly_wage`) when configured;
 * otherwise $0 with `missingWage` on the detail line.
 */
export function buildOverheadDailyLabor(args: {
  sessions: readonly OverheadClockSessionRow[]
  officeJobLedgerId: string | null
  wageByNormalizedName: Map<string, OverheadWageRates>
  /** Person-id-first join (C1): `people.id` → rates. Used before the name path when provided. */
  wageByPersonId?: ReadonlyMap<string, OverheadWageRates>
  /** `users.id` → `people.id` (via `people.account_user_id`). Required for the id-first path. */
  personIdByUserId?: ReadonlyMap<string, string>
}): OverheadDailyBuildResult {
  const { sessions, officeJobLedgerId, wageByNormalizedName, wageByPersonId, personIdByUserId } = args

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
    // Office AND bid buckets are office-rate time for dual-rate people —
    // matches officeJobRateSplit.rateBucketForSession (only real field jobs
    // pay the field rate), so overhead $ agrees with payroll.
    const wage =
      overheadWageRatesForSession(
        { userId: s.user_id, userDisplayName: displayName },
        { wageByNormalizedName, wageByPersonId, personIdByUserId },
      )?.officeWage ?? null
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