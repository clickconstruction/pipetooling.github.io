import type { ClockSessionRow } from '../../types/clockSessions'
import { buildHoursGridNameJoin } from '../peopleHoursPendingByCell'

/**
 * People → Hours: who is on the clock right now, per day column (journey-map J7-4).
 *
 * The grid's cells sum CLOSED sessions only, while the clock strip above it shows the
 * live ones — mid-week an owner reads today's column as "hours worked today", sees a
 * fraction of what the strip shows, and distrusts the grid. Nothing labelled the
 * difference. This kernel folds the open sessions the page already holds
 * (`activeClockSessions` = pending rows with `clocked_out_at == null`) into one entry
 * per work date so the column header can say "+N on the clock". Pure: no React, no
 * Supabase. Same name join as the pending badge (`buildHoursGridNameJoin`) so the two
 * hints can never disagree about who a session belongs to.
 */
export type HoursGridLiveDay = {
  workDate: string
  /** Distinct people with an open session on this day (a person clocked in twice counts once). */
  people: number
  /** Running time across those open sessions, decimal hours, as of `nowMs`. */
  elapsedHours: number
}

export type HoursGridLiveByWorkDate = Map<string, HoursGridLiveDay>

export function buildHoursGridLiveByWorkDate(args: {
  /** Open sessions (`clocked_out_at == null`); closed, rejected and revoked rows are ignored. */
  activeClockSessions: readonly ClockSessionRow[]
  /** Visible roster on the Hours grid — sessions from people not on it are not counted. */
  peopleNames: readonly string[]
  /** Visible day columns (YYYY-MM-DD). */
  workDates: readonly string[]
  /** Maps `clock_sessions.user_id` ↔ `people_hours.person_name`. */
  users: Array<{ id: string; name: string | null }>
  nowMs: number
}): HoursGridLiveByWorkDate {
  const out: HoursGridLiveByWorkDate = new Map()
  if (args.activeClockSessions.length === 0) return out
  const roster = new Set(args.peopleNames.map((n) => n.trim()).filter((n) => n.length > 0))
  const days = new Set(args.workDates)
  const { personNameByUserId } = buildHoursGridNameJoin(args.users)
  const peopleByDay = new Map<string, Set<string>>()
  for (const s of args.activeClockSessions) {
    if (s.clocked_out_at != null) continue
    if (s.rejected_at || s.revoked_at) continue
    if (!days.has(s.work_date)) continue
    const personName = personNameByUserId.get(s.user_id)
    if (!personName || !roster.has(personName)) continue
    const inMs = new Date(s.clocked_in_at).getTime()
    if (!Number.isFinite(inMs)) continue
    const elapsed = Math.max(0, (args.nowMs - inMs) / 3_600_000)
    const cur = out.get(s.work_date) ?? { workDate: s.work_date, people: 0, elapsedHours: 0 }
    const set = peopleByDay.get(s.work_date) ?? new Set<string>()
    set.add(personName)
    peopleByDay.set(s.work_date, set)
    cur.people = set.size
    cur.elapsedHours += elapsed
    out.set(s.work_date, cur)
  }
  return out
}

/** The header chip: "+3 on the clock". */
export function liveDayChipLabel(day: HoursGridLiveDay): string {
  return `+${day.people} on the clock`
}

/** The header chip's tooltip — says what the column is NOT counting, and how much. */
export function liveDayChipTitle(day: HoursGridLiveDay): string {
  const who = day.people === 1 ? '1 person is' : `${day.people} people are`
  const running = day.elapsedHours.toFixed(2)
  return `${who} clocked in right now (${running} h so far). This column counts closed sessions only — their time lands here when they clock out.`
}
