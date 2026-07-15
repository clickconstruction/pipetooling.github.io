import {
  approvedClosedSessionHours,
  overheadBucketForSession,
  type OverheadClockSessionRow,
} from './overheadDailyLabor'

/**
 * One (person, work_date) day where field-type time exists on a person's
 * schedule but was never tied to a crew assignment (or sub-labor row, when
 * supplied) — i.e. time payroll covers but the team-summary cannot allocate
 * to a specific revenue-generating job.
 *
 * v2.546: every input now comes from approved-closed `clock_sessions` only.
 * Manual `people_hours` overrides and the salary "8h on a weekday with no
 * clock at all" phantom no longer surface rows. A salary weekday only counts
 * once we see an approved closed session for that person on that day.
 *
 * "Field hours" follows the same definition used in `derivePersonTeamSummary`:
 *
 *   approvedClockOnDay = Σ approved-closed clock for that person+date (any bucket)
 *   dayHoursRaw  = is_salary
 *                    ? (weekday && approvedClockOnDay > 0 ? 8 : 0)
 *                    : approvedClockOnDay
 *   overheadOnDay = Σ approved-closed office+bid clock for that person+date
 *                   (office = job_ledger_id === overheadOfficeJobLedgerId,
 *                    bid    = bid_id is set)
 *   fieldHours   = max(0, dayHoursRaw - overheadOnDay)
 *   crewAttributedHrs =
 *     Σ over crew job_assignments (excluding overheadOfficeJobLedgerId) of
 *       dayHoursRaw * pct / 100
 *   unallocatedHrs = max(0, fieldHours - crewAttributedHrs - subLaborHrs)
 *
 * `pct` is share of the total day (matches the `sync_crew_jobs_from_clock`
 * trigger denominator and the `payReportAssignmentsBreakdown` / `teamLabor.ts`
 * consumers). When sessions cover the paid day, the non-Office crew shares
 * sum to `(1 − officePct) × dayHoursRaw = fieldHours` and `unallocatedHrs`
 * collapses to zero. Real discrepancies surface only when sub-labor is
 * unmatched, a salary day has approved clock with no crew sync, or pct was
 * manually set to <100%.
 *
 * Pending (not-yet-approved) closed sessions are intentionally ignored: those
 * are surfaced separately by the Pending Sessions UI; the unallocated queue
 * waits until payroll-relevant approval has happened.
 *
 * Only the (person, date) cells with `unallocatedHrs > thresholdHours` are
 * emitted. The caller decides the threshold (typical Assistant queue uses 1h).
 */
export type PeopleHoursUnallocatedRow = {
  personName: string
  workDate: string
  /**
   * Underlying day-hours value used as the basis for field/crew math. For
   * hourly people this is the sum of approved-closed clock hours on the day;
   * for salary people it is `8` when there is approved clock activity that
   * weekday and `0` otherwise.
   */
  dayHoursRaw: number
  /** Approved-closed office+bid overhead clock for that person+date. */
  overheadOnDay: number
  /** dayHoursRaw - overheadOnDay (>= 0). */
  fieldHours: number
  /** Hours covered by crew assignments (excluding overhead office job). */
  crewAttributedHrs: number
  /** Hours covered by sub-labor rows on this person+date (0 when not supplied). */
  subLaborHrs: number
  /** Hours with no allocation = max(0, fieldHours - crewAttributedHrs - subLaborHrs). */
  unallocatedHrs: number
  /** True when the person is salary (record_hours_but_salary still counts as salary here). */
  isSalary: boolean
  /** Distinct job/bid ids already on the crew row (so the UI can show "1 job, 2 bids"). */
  crewAssignmentCount: number
}

export type PeopleHoursUnallocatedSummary = {
  /** Total `unallocatedHrs` across all emitted rows. */
  totalUnallocatedHrs: number
  /** Distinct people with at least one row above threshold. */
  peopleCount: number
  /** Distinct work_dates that have at least one row above threshold. */
  workDates: string[]
  /** Number of rows emitted. */
  rowCount: number
}

export type PeopleHoursUnallocatedPayConfigInput = {
  person_name: string
  is_salary: boolean
  /** Salary people who still record hours (still salary for "8h on weekday" rule). */
  record_hours_but_salary?: boolean
}

export type PeopleHoursUnallocatedCrewInput = {
  work_date: string
  person_name: string
  /** Job assignments on this person's crew row (already merged from people_crew_jobs). */
  job_assignments: Array<{ job_id: string; pct: number }>
  /** Bid assignments on this person's crew row (already merged from people_crew_bids). */
  bid_assignments: Array<{ bid_id: string; pct: number }>
}

export type PeopleHoursUnallocatedSubLaborInput = {
  /** Person the sub-labor row is for (assigned_to_name). */
  person_name: string
  /** Day the hours apply to. Sub-labor rows that have no usable date should be omitted. */
  work_date: string
  /** Decimal hours attributed to that person+date by the sub-labor line item. */
  hours: number
}

/**
 * Sum approved-closed office+bid overhead hours per (personName, work_date).
 *
 * Only counts sessions where `overheadBucketForSession(officeJobLedgerId, ...)`
 * returns a bucket — i.e. office-job clock or bid-only clock.
 */
export function buildOverheadHoursByPersonByDate(args: {
  sessions: readonly OverheadClockSessionRow[]
  officeJobLedgerId: string | null
}): Map<string, number> {
  const out = new Map<string, number>()
  for (const s of args.sessions) {
    if (s.rejected_at || s.revoked_at) continue
    if (s.approved_at == null) continue
    if (s.clocked_out_at == null) continue
    const bucket = overheadBucketForSession(args.officeJobLedgerId, s.job_ledger_id, s.bid_id)
    if (bucket == null) continue
    const hrs = approvedClosedSessionHours(s)
    if (hrs == null || hrs <= 0) continue
    const personName = (s.users?.name ?? '').trim()
    if (!personName) continue
    const key = `${personName}|${s.work_date}`
    out.set(key, (out.get(key) ?? 0) + hrs)
  }
  return out
}

/**
 * Sum approved-closed clock hours per (personName, work_date) across every
 * bucket (office, bid, field, unassigned). Used as the source-of-truth for
 * "did this person have any approved time on this day?" and as the basis for
 * hourly `dayHoursRaw` — replacing the old `people_hours.hours` lookup so
 * manual grid overrides and pending sessions never inflate the value.
 */
export function buildApprovedClosedHoursByPersonByDate(args: {
  sessions: readonly OverheadClockSessionRow[]
}): Map<string, number> {
  const out = new Map<string, number>()
  for (const s of args.sessions) {
    if (s.rejected_at || s.revoked_at) continue
    if (s.approved_at == null) continue
    if (s.clocked_out_at == null) continue
    const hrs = approvedClosedSessionHours(s)
    if (hrs == null || hrs <= 0) continue
    const personName = (s.users?.name ?? '').trim()
    if (!personName) continue
    const key = `${personName}|${s.work_date}`
    out.set(key, (out.get(key) ?? 0) + hrs)
  }
  return out
}

/**
 * Build the (person, work_date) → effective day-hours value used as the
 * starting "field-eligible" amount before subtracting overhead. Hourly
 * people read directly from approved clock; salary people get 8 only when
 * they actually showed up (≥1 approved closed session) on a weekday.
 */
function effectiveDayHoursRaw(args: {
  personName: string
  workDate: string
  payConfig: PeopleHoursUnallocatedPayConfigInput | undefined
  approvedHoursLookup: ReadonlyMap<string, number>
}): number {
  const cfg = args.payConfig
  const key = `${args.personName}|${args.workDate}`
  const approvedHours = args.approvedHoursLookup.get(key) ?? 0
  if (cfg?.is_salary) {
    const dayOfWeek = new Date(args.workDate + 'T12:00:00').getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) return 0
    if (approvedHours <= 0) return 0
    return 8
  }
  return approvedHours
}

/** True when the row should not generate an unallocated badge for this person. */
export function shouldSkipPersonForUnallocated(
  cfg: PeopleHoursUnallocatedPayConfigInput | undefined,
): boolean {
  if (!cfg) return true
  return false
}

export type ComputeUnallocatedFieldRowsArgs = {
  /** All people roster rows (used to know who's salaried and who's in hours grid). */
  payConfig: readonly PeopleHoursUnallocatedPayConfigInput[]
  /**
   * Deprecated — pre-v2.546 callers passed `people_hours` rows here. The field
   * is ignored; hourly `dayHoursRaw` is now derived from approved clock only.
   * Kept on the type so existing callers compile during rollout.
   */
  peopleHours?: ReadonlyArray<{ person_name: string; work_date: string; hours: number }>
  /** Crew assignment rows (already merged from people_crew_jobs + people_crew_bids). */
  crewRows: readonly PeopleHoursUnallocatedCrewInput[]
  /**
   * Approved-closed clock sessions in the window (`approved_at IS NOT NULL`,
   * `rejected_at/revoked_at IS NULL`, `clocked_out_at IS NOT NULL`). Drives
   * both `dayHoursRaw` and `overheadOnDay`; pending sessions are excluded by
   * the caller's query so they cannot influence the result.
   */
  overheadSessions: readonly OverheadClockSessionRow[]
  /** Configured org-level overhead office job (filtered out of crew attribution). */
  officeJobLedgerId: string | null
  /** Sub-labor rows attributable to a specific person+date (optional). */
  subLaborRows?: readonly PeopleHoursUnallocatedSubLaborInput[]
  /** Calendar days (YYYY-MM-DD) to consider; rows outside this set are ignored. */
  workDates: readonly string[]
  /** Minimum `unallocatedHrs` to emit a row. Use 0 to emit everything. */
  thresholdHours: number
}

/**
 * Pure computation that mirrors the `derivePersonTeamSummary` math, but on a
 * per (person, work_date) basis and emits one row per day with unallocated
 * field time above threshold.
 */
export function computeUnallocatedFieldRows(
  args: ComputeUnallocatedFieldRowsArgs,
): PeopleHoursUnallocatedRow[] {
  const workDateSet = new Set(args.workDates)
  const cfgByName = new Map<string, PeopleHoursUnallocatedPayConfigInput>()
  for (const cfg of args.payConfig) {
    const name = (cfg.person_name ?? '').trim()
    if (!name) continue
    cfgByName.set(name, cfg)
  }

  const approvedHoursByKey = buildApprovedClosedHoursByPersonByDate({
    sessions: args.overheadSessions,
  })
  // Strip keys outside the requested window so out-of-range sessions can't
  // pollute lookups when the caller passes a wider session list.
  for (const key of approvedHoursByKey.keys()) {
    const sep = key.indexOf('|')
    if (sep < 0) {
      approvedHoursByKey.delete(key)
      continue
    }
    const ymd = key.slice(sep + 1)
    if (!workDateSet.has(ymd)) approvedHoursByKey.delete(key)
  }

  const overheadByKey = buildOverheadHoursByPersonByDate({
    sessions: args.overheadSessions,
    officeJobLedgerId: args.officeJobLedgerId,
  })

  const subLaborByKey = new Map<string, number>()
  for (const row of args.subLaborRows ?? []) {
    if (!workDateSet.has(row.work_date)) continue
    const name = (row.person_name ?? '').trim()
    if (!name) continue
    const key = `${name}|${row.work_date}`
    subLaborByKey.set(key, (subLaborByKey.get(key) ?? 0) + (Number.isFinite(row.hours) ? row.hours : 0))
  }

  type CrewBucket = {
    pctTotal: number
    assignmentCount: number
  }
  const crewByKey = new Map<string, CrewBucket>()
  for (const r of args.crewRows) {
    if (!workDateSet.has(r.work_date)) continue
    const name = (r.person_name ?? '').trim()
    if (!name) continue
    const key = `${name}|${r.work_date}`
    let bucket = crewByKey.get(key)
    if (!bucket) {
      bucket = { pctTotal: 0, assignmentCount: 0 }
      crewByKey.set(key, bucket)
    }
    for (const a of r.job_assignments) {
      if (args.officeJobLedgerId && a.job_id === args.officeJobLedgerId) continue
      const pct = Number.isFinite(a.pct) ? a.pct : 0
      if (pct <= 0) continue
      bucket.pctTotal += pct
      bucket.assignmentCount += 1
    }
    for (const a of r.bid_assignments) {
      const pct = Number.isFinite(a.pct) ? a.pct : 0
      if (pct <= 0) continue
      bucket.pctTotal += pct
      bucket.assignmentCount += 1
    }
  }

  // Candidate keys come entirely from approved clock activity: anyone who
  // didn't show up that day cannot have unallocated field time. Salary
  // weekdays still get the 8h template via `effectiveDayHoursRaw`, but only
  // when the same person also has a non-zero approved clock entry for that
  // date (no more phantom 8h rows for people who took the day off).
  const candidateKeys = new Set<string>()
  for (const [key, hrs] of approvedHoursByKey) {
    if (hrs <= 0) continue
    const sep = key.indexOf('|')
    const name = key.slice(0, sep)
    const cfg = cfgByName.get(name)
    if (shouldSkipPersonForUnallocated(cfg)) continue
    candidateKeys.add(key)
  }

  const rows: PeopleHoursUnallocatedRow[] = []
  for (const key of candidateKeys) {
    const sep = key.indexOf('|')
    const personName = key.slice(0, sep)
    const workDate = key.slice(sep + 1)
    const cfg = cfgByName.get(personName)
    const dayHoursRaw = effectiveDayHoursRaw({
      personName,
      workDate,
      payConfig: cfg,
      approvedHoursLookup: approvedHoursByKey,
    })
    if (dayHoursRaw <= 0) continue
    const overheadOnDay = overheadByKey.get(key) ?? 0
    const fieldHours = Math.max(0, dayHoursRaw - overheadOnDay)
    if (fieldHours <= 0) continue
    const crew = crewByKey.get(key)
    const crewPct = crew ? Math.min(100, crew.pctTotal) : 0
    // Convention 1 — pct is share of the total day (matches the trigger
    // denominator). When sessions cover the day, non-Office crew shares sum
    // to (1 − officePct) × dayHoursRaw = fieldHours, so the remainder is the
    // genuine unattributed time.
    const crewAttributedHrs = (dayHoursRaw * crewPct) / 100
    const subLaborHrs = subLaborByKey.get(key) ?? 0
    const unallocatedHrs = Math.max(0, fieldHours - crewAttributedHrs - subLaborHrs)
    if (unallocatedHrs <= args.thresholdHours) continue
    rows.push({
      personName,
      workDate,
      dayHoursRaw,
      overheadOnDay,
      fieldHours,
      crewAttributedHrs,
      subLaborHrs,
      unallocatedHrs,
      isSalary: !!cfg?.is_salary,
      crewAssignmentCount: crew?.assignmentCount ?? 0,
    })
  }

  rows.sort((a, b) => {
    if (a.workDate !== b.workDate) return b.workDate.localeCompare(a.workDate)
    if (a.unallocatedHrs !== b.unallocatedHrs) return b.unallocatedHrs - a.unallocatedHrs
    return a.personName.localeCompare(b.personName)
  })
  return rows
}

export function summarizeUnallocatedFieldRows(
  rows: readonly PeopleHoursUnallocatedRow[],
): PeopleHoursUnallocatedSummary {
  let totalUnallocatedHrs = 0
  const people = new Set<string>()
  const dates = new Set<string>()
  for (const r of rows) {
    totalUnallocatedHrs += r.unallocatedHrs
    people.add(r.personName)
    dates.add(r.workDate)
  }
  return {
    totalUnallocatedHrs,
    peopleCount: people.size,
    workDates: Array.from(dates).sort(),
    rowCount: rows.length,
  }
}

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Build a YYYY-MM-DD list spanning `start..end` inclusive (Central-friendly noon anchor). */
export function buildWorkDateListInclusive(start: string, end: string): string[] {
  const out: string[] = []
  const a = new Date(start + 'T12:00:00')
  const b = new Date(end + 'T12:00:00')
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime()) || b < a) return out
  const cur = new Date(a)
  while (cur <= b) {
    out.push(formatLocalYmd(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export type UnallocatedFieldRowsByDate = Array<{
  workDate: string
  rows: PeopleHoursUnallocatedRow[]
  totalUnallocatedHrs: number
}>

export function groupUnallocatedFieldRowsByDate(
  rows: readonly PeopleHoursUnallocatedRow[],
): UnallocatedFieldRowsByDate {
  const byDate = new Map<string, PeopleHoursUnallocatedRow[]>()
  for (const r of rows) {
    const list = byDate.get(r.workDate) ?? []
    list.push(r)
    byDate.set(r.workDate, list)
  }
  return Array.from(byDate.entries())
    .map(([workDate, list]) => ({
      workDate,
      rows: list.slice().sort((a, b) => {
        if (a.unallocatedHrs !== b.unallocatedHrs) return b.unallocatedHrs - a.unallocatedHrs
        return a.personName.localeCompare(b.personName)
      }),
      totalUnallocatedHrs: list.reduce((s, r) => s + r.unallocatedHrs, 0),
    }))
    .sort((a, b) => b.workDate.localeCompare(a.workDate))
}
