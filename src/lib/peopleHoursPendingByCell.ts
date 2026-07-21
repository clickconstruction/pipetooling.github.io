import type { ClockSessionRow } from '../types/clockSessions'

/**
 * Per-cell pending entry on the People → Hours grid.
 *
 * Only emitted when `pendingHours > peopleHoursValue` so the badge means
 * "extra hours that payroll is currently missing", not "this day used a clock-in".
 */
export type PeopleHoursPendingCellEntry = {
  personName: string
  workDate: string
  userId: string
  /** Number of closed pending clock sessions on this person+day. */
  count: number
  /** Decimal hours sum of those pending closed sessions. */
  pendingHours: number
  /** Decimal hours currently saved in `people_hours` for this person+day. */
  peopleHoursValue: number
  /** `pendingHours - peopleHoursValue` (always > 0). */
  diffHours: number
  sessionIds: string[]
  sessions: ClockSessionRow[]
}

export type PeopleHoursPendingByCellMap = Map<string, PeopleHoursPendingCellEntry>

export type PeopleHoursPendingSummary = {
  /** Total pending closed clock sessions across all visible cells. */
  totalSessions: number
  /** Sum of `diffHours` across all visible cells (= the amount payroll currently undercounts). */
  totalDiffHours: number
  /** Distinct people with at least one cell that has pending > saved. */
  peopleCount: number
  /** Distinct work dates that have any cell with pending > saved. */
  workDates: string[]
  /** All pending session IDs (across cells) — handy for "Approve all". */
  allSessionIds: string[]
}

export function pendingByCellKey(personName: string, workDate: string): string {
  return `${personName}|${workDate}`
}

/**
 * Trimmed-name user join shared by the badge map and the Hours grid cell
 * pending sums (v2.839): ONE resolution of `clock_sessions.user_id` ↔
 * `people_hours.person_name`, so the two surfaces can never disagree about
 * who a pending session belongs to.
 */
export function buildHoursGridNameJoin(users: Array<{ id: string; name: string | null }>): {
  userIdByPersonName: Map<string, string>
  personNameByUserId: Map<string, string>
} {
  const userIdByPersonName = new Map<string, string>()
  const personNameByUserId = new Map<string, string>()
  for (const u of users) {
    const trimmed = (u.name ?? '').trim()
    if (!trimmed || !u.id) continue
    userIdByPersonName.set(trimmed, u.id)
    personNameByUserId.set(u.id, trimmed)
  }
  return { userIdByPersonName, personNameByUserId }
}

/**
 * Raw closed-pending hour sums per (personName, workDate) cell using the
 * shared join — the grid cell display's source (v2.839). Same inclusion
 * rules as the badge map: closed, not rejected/revoked, positive finite
 * duration. Unlike the badge map this has no roster/salary filters and no
 * pending-exceeds-saved threshold — the cell needs the raw sum.
 */
export function buildClosedPendingHoursSumsByCell(
  pendingClockSessions: readonly ClockSessionRow[],
  personNameByUserId: Map<string, string>,
): Map<string, number> {
  const sums = new Map<string, number>()
  for (const s of pendingClockSessions) {
    if (s.clocked_out_at == null) continue
    if (s.rejected_at || s.revoked_at) continue
    const personName = personNameByUserId.get(s.user_id)
    if (!personName) continue
    const inMs = new Date(s.clocked_in_at).getTime()
    const outMs = new Date(s.clocked_out_at).getTime()
    if (!Number.isFinite(inMs) || !Number.isFinite(outMs)) continue
    const dur = (outMs - inMs) / 3_600_000
    if (dur <= 0) continue
    const key = pendingByCellKey(personName, s.work_date)
    sums.set(key, (sums.get(key) ?? 0) + dur)
  }
  return sums
}

/**
 * Closed pending clock sessions only (`clocked_out_at != null`); excludes rejected/revoked.
 * Salary and non-salary input rows are both kept — caller decides whether to skip salaried people.
 */
export function buildPeopleHoursPendingByCellMap(args: {
  pendingClockSessions: ClockSessionRow[]
  peopleHours: Array<{ person_name: string; work_date: string; hours: number }>
  /** Visible roster on the Hours grid; used to limit work and to look up display name. */
  peopleNames: string[]
  /** Visible day columns on the Hours grid (YYYY-MM-DD). */
  workDates: string[]
  /** Used to map `clock_sessions.user_id` ↔ `people_hours.person_name`. */
  users: Array<{ id: string; name: string | null }>
  /** When true, skip people whose pay config is "is_salary && !record_hours_but_salary" — those rows are not editable in the grid and the badge would be noise. */
  isSalaryOnly: (personName: string) => boolean
}): PeopleHoursPendingByCellMap {
  const out: PeopleHoursPendingByCellMap = new Map()
  if (args.pendingClockSessions.length === 0) return out

  const personNameSet = new Set(args.peopleNames.map((n) => n.trim()).filter((n) => n.length > 0))
  const workDateSet = new Set(args.workDates)

  // Shared join (v2.839) — roster/salary filters are applied at the use sites
  // below so the badge keeps its historical scope while the join itself is the
  // one the grid-cell sums use.
  const { userIdByPersonName: fullUserIdByName, personNameByUserId } = buildHoursGridNameJoin(args.users)
  const userIdByPersonName = new Map<string, string>()
  for (const [name, id] of fullUserIdByName) {
    if (!personNameSet.has(name)) continue
    if (args.isSalaryOnly(name)) continue
    userIdByPersonName.set(name, id)
  }
  if (userIdByPersonName.size === 0) return out

  const peopleHoursLookup = new Map<string, number>()
  for (const row of args.peopleHours) {
    if (!workDateSet.has(row.work_date)) continue
    const trimmed = (row.person_name ?? '').trim()
    if (!trimmed) continue
    if (!userIdByPersonName.has(trimmed)) continue
    peopleHoursLookup.set(pendingByCellKey(trimmed, row.work_date), row.hours)
  }

  type Bucket = { hours: number; sessions: ClockSessionRow[] }
  const buckets = new Map<string, Bucket>()
  for (const s of args.pendingClockSessions) {
    if (!s.clocked_out_at) continue
    if (s.rejected_at || s.revoked_at) continue
    if (!workDateSet.has(s.work_date)) continue
    const personName = personNameByUserId.get(s.user_id)
    if (!personName || !userIdByPersonName.has(personName)) continue
    const inMs = new Date(s.clocked_in_at).getTime()
    const outMs = new Date(s.clocked_out_at).getTime()
    const dur = (outMs - inMs) / 3_600_000
    if (!Number.isFinite(dur) || dur <= 0) continue
    const key = pendingByCellKey(personName, s.work_date)
    let b = buckets.get(key)
    if (!b) {
      b = { hours: 0, sessions: [] }
      buckets.set(key, b)
    }
    b.hours += dur
    b.sessions.push(s)
  }

  for (const [key, bucket] of buckets) {
    const sep = key.indexOf('|')
    const personName = key.slice(0, sep)
    const workDate = key.slice(sep + 1)
    const peopleHoursValue = peopleHoursLookup.get(key) ?? 0
    if (bucket.hours <= peopleHoursValue + 1e-9) continue
    const userId = userIdByPersonName.get(personName)!
    bucket.sessions.sort(
      (a, b) => new Date(a.clocked_in_at).getTime() - new Date(b.clocked_in_at).getTime(),
    )
    out.set(key, {
      personName,
      workDate,
      userId,
      count: bucket.sessions.length,
      pendingHours: bucket.hours,
      peopleHoursValue,
      diffHours: bucket.hours - peopleHoursValue,
      sessionIds: bucket.sessions.map((s) => s.id),
      sessions: bucket.sessions,
    })
  }
  return out
}

export function summarizePeopleHoursPendingByCell(
  map: PeopleHoursPendingByCellMap,
): PeopleHoursPendingSummary {
  let totalSessions = 0
  let totalDiffHours = 0
  const people = new Set<string>()
  const days = new Set<string>()
  const allSessionIds: string[] = []
  for (const entry of map.values()) {
    totalSessions += entry.count
    totalDiffHours += entry.diffHours
    people.add(entry.personName)
    days.add(entry.workDate)
    for (const id of entry.sessionIds) allSessionIds.push(id)
  }
  return {
    totalSessions,
    totalDiffHours,
    peopleCount: people.size,
    workDates: Array.from(days).sort(),
    allSessionIds,
  }
}

/** True if any visible cell on `workDate` has pending > saved (drives the column header dot). */
export function workDateHasAnyPendingExcess(
  map: PeopleHoursPendingByCellMap,
  workDate: string,
): boolean {
  for (const entry of map.values()) {
    if (entry.workDate === workDate) return true
  }
  return false
}

/** Sum of `diffHours` across all cells for `personName` (drives the row total badge). */
export function personPendingExcessHours(
  map: PeopleHoursPendingByCellMap,
  personName: string,
): number {
  let sum = 0
  for (const entry of map.values()) {
    if (entry.personName === personName) sum += entry.diffHours
  }
  return sum
}

/**
 * Sum of closed pending clock hours for one (user, work_date) cell on the People → Hours grid.
 *
 * Excludes rejected and revoked sessions so revocation immediately removes hours from the grid
 * (revoke decrements `people_hours` server-side; without this filter, the revoked session row —
 * still present in `pendingClockSessions` because `revoked_at` clears `approved_at` and leaves
 * `rejected_at` null — would keep `getHoursGridDisplayHours = max(people_hours, pendingSum)` high).
 */
export function sumClosedPendingClockHoursForCell(
  pendingClockSessions: readonly ClockSessionRow[],
  userId: string | null | undefined,
  workDate: string,
): number {
  if (!userId) return 0
  let sum = 0
  for (const s of pendingClockSessions) {
    if (s.user_id !== userId) continue
    if (s.work_date !== workDate) continue
    if (s.clocked_out_at == null) continue
    if (s.rejected_at || s.revoked_at) continue
    const inMs = new Date(s.clocked_in_at).getTime()
    const outMs = new Date(s.clocked_out_at).getTime()
    if (!Number.isFinite(inMs) || !Number.isFinite(outMs)) continue
    const dur = (outMs - inMs) / 3_600_000
    if (dur <= 0) continue
    sum += dur
  }
  return sum
}

