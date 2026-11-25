import type { ClockSessionRow } from '../../types/clockSessions'
import { formatDenverTimeOnly } from '../../utils/dateUtils'
import { buildHoursGridNameJoin, pendingByCellKey } from '../peopleHoursPendingByCell'
import { formatDaySheetDayLabel } from './hoursGridDaySheet'
import { decimalToHm, decimalToHms } from './hoursGridTime'

/**
 * People → Hours: who is on the clock right now, cell by cell (punch list #446; the day
 * head's count is journey-map J7-4).
 *
 * The grid's saved figures are closed sessions only. A person still clocked in used to
 * show an empty box that took typing, so a slip of the keyboard wrote a day's hours under
 * a session that was still running. This kernel folds the open sessions the page already
 * holds (`activeClockSessions` = pending rows with `clocked_out_at == null`) into one entry
 * per person and day. The grid draws that cell as a green press that opens My Time, never a
 * field, adds its running time to the row and day totals, and counts the people in the
 * column's head ("+N on the clock"). Pure: no React, no Supabase. Same name join as the
 * pending badge (`buildHoursGridNameJoin`), so the hints can never disagree about who a
 * session belongs to.
 *
 * The database clocks every open session out at 11:59 PM of its own day, so one still open
 * on a day before today was missed by that closer. It is a fault and not time accruing: the
 * cell says "left open" and "no clock-out", adds nothing to a total, and still opens My
 * Time, where Force clock out is. When it started is in the tooltip: the box is 72 wide.
 */
export type HoursGridLiveCell = {
  personName: string
  workDate: string
  /** Clock-in instants (ms) of the open sessions, earliest first. A person clocked in twice has two. */
  clockInsMs: number[]
}

/** Keyed by `pendingByCellKey(trimmed person name, work date)`. */
export type HoursGridLiveByCell = Map<string, HoursGridLiveCell>

export function hoursGridLiveCellKey(personName: string, workDate: string): string {
  return pendingByCellKey(personName.trim(), workDate)
}

export function buildHoursGridLiveByCell(args: {
  /** Open sessions (`clocked_out_at == null`); closed, rejected and revoked rows are ignored. */
  activeClockSessions: readonly ClockSessionRow[]
  /** Visible roster on the Hours grid: sessions from people not on it are not counted. */
  peopleNames: readonly string[]
  /** Visible day columns (YYYY-MM-DD). */
  workDates: readonly string[]
  /** Maps `clock_sessions.user_id` ↔ `people_hours.person_name`. */
  users: Array<{ id: string; name: string | null }>
}): HoursGridLiveByCell {
  const out: HoursGridLiveByCell = new Map()
  if (args.activeClockSessions.length === 0) return out
  const roster = new Set(args.peopleNames.map((n) => n.trim()).filter((n) => n.length > 0))
  const days = new Set(args.workDates)
  const { personNameByUserId } = buildHoursGridNameJoin(args.users)
  for (const s of args.activeClockSessions) {
    if (s.clocked_out_at != null) continue
    if (s.rejected_at || s.revoked_at) continue
    if (!days.has(s.work_date)) continue
    const personName = personNameByUserId.get(s.user_id)
    if (!personName || !roster.has(personName)) continue
    const inMs = new Date(s.clocked_in_at).getTime()
    if (!Number.isFinite(inMs)) continue
    const key = hoursGridLiveCellKey(personName, s.work_date)
    const cur = out.get(key) ?? { personName, workDate: s.work_date, clockInsMs: [] }
    cur.clockInsMs.push(inMs)
    out.set(key, cur)
  }
  for (const cell of out.values()) cell.clockInsMs.sort((a, b) => a - b)
  return out
}

/** Open on a day before today: the 11:59 PM closer missed it, so nobody is accruing time on it. */
export function isLiveCellLeftOpen(cell: HoursGridLiveCell, todayYmd: string): boolean {
  return cell.workDate < todayYmd
}

/** Running time across the cell's open sessions, decimal hours. A left-open cell has none. */
export function liveCellRunningHours(cell: HoursGridLiveCell, nowMs: number, todayYmd: string): number {
  if (isLiveCellLeftOpen(cell, todayYmd)) return 0
  return cell.clockInsMs.reduce((sum, inMs) => sum + Math.max(0, (nowMs - inMs) / 3_600_000), 0)
}

/**
 * What the cell adds to the grid's hours and totals. A salaried day counts its set hours
 * whatever the clock reads, so it adds nothing; neither does a session that was left open.
 */
export function liveCellAddedHours(
  cell: HoursGridLiveCell | undefined,
  args: { nowMs: number; todayYmd: string; salaryOnly: boolean },
): number {
  if (!cell || args.salaryOnly) return 0
  return liveCellRunningHours(cell, args.nowMs, args.todayYmd)
}

export type HoursGridLiveCellView = {
  tone: 'running' | 'leftOpen'
  /** The box's first line: the day so far to the minute, a salaried day's set hours, or "left open". */
  figure: string
  /** The second line: the mark that does not lean on colour. */
  word: string
  /** A salaried day's figure is not accruing, so it stays grey. */
  figureMuted: boolean
  /** The tooltip and the screen reader's name: who, the day, the time, and what a press opens. */
  title: string
}

/** The words of one green box. `settledHours` is what the cell would show with nobody on the clock. */
export function hoursGridLiveCellView(args: {
  cell: HoursGridLiveCell
  settledHours: number
  salaryOnly: boolean
  nowMs: number
  todayYmd: string
}): HoursGridLiveCellView {
  const { cell, settledHours, salaryOnly, nowMs, todayYmd } = args
  const since = formatDenverTimeOnly(cell.clockInsMs[0] ?? nowMs)
  const who = `${cell.personName}, ${formatDaySheetDayLabel(cell.workDate, Number(todayYmd.slice(0, 4)))}`
  if (isLiveCellLeftOpen(cell, todayYmd)) {
    return {
      tone: 'leftOpen',
      figure: 'left open',
      word: 'no clock-out',
      figureMuted: false,
      title: `${who}: a session left open since ${since}. It adds no time here. Opens My Time, where Force clock out is.`,
    }
  }
  if (salaryOnly) {
    const set = decimalToHms(settledHours)
    return {
      tone: 'running',
      figure: set || '-',
      word: 'on the clock',
      figureMuted: true,
      title: `${who}: on the clock since ${since}. A salaried day counts its set hours${set ? `, ${set}` : ''}. Opens My Time.`,
    }
  }
  const figure = decimalToHm(settledHours + liveCellRunningHours(cell, nowMs, todayYmd))
  return {
    tone: 'running',
    figure,
    word: 'on the clock',
    figureMuted: false,
    title: `${who}: ${figure} so far, on the clock since ${since}. Opens My Time.`,
  }
}

export type HoursGridLiveDay = {
  workDate: string
  /** Distinct people clocked in on this day right now (a person clocked in twice counts once). */
  people: number
  /** Distinct people with a session left open on this day. */
  leftOpen: number
  /** Running time across the people clocked in, decimal hours, as of `nowMs`. */
  elapsedHours: number
}

export type HoursGridLiveByWorkDate = Map<string, HoursGridLiveDay>

/** One entry per day column that has anyone on the clock or left open: the head's line. */
export function summarizeHoursGridLiveDays(liveByCell: HoursGridLiveByCell, nowMs: number, todayYmd: string): HoursGridLiveByWorkDate {
  const out: HoursGridLiveByWorkDate = new Map()
  for (const cell of liveByCell.values()) {
    const cur = out.get(cell.workDate) ?? { workDate: cell.workDate, people: 0, leftOpen: 0, elapsedHours: 0 }
    if (isLiveCellLeftOpen(cell, todayYmd)) cur.leftOpen += 1
    else {
      cur.people += 1
      cur.elapsedHours += liveCellRunningHours(cell, nowMs, todayYmd)
    }
    out.set(cell.workDate, cur)
  }
  return out
}

/** The head's line: "+3 on the clock". */
export function liveDayChipLabel(day: HoursGridLiveDay): string {
  return `+${day.people} on the clock`
}

/** The head line's tooltip: who the count is, how much time, and where it shows. */
export function liveDayChipTitle(day: HoursGridLiveDay): string {
  const who = day.people === 1 ? '1 person is' : `${day.people} people are`
  const boxes = day.people === 1 ? 'Their box in this column is green' : 'Their boxes in this column are green'
  return `${who} clocked in right now (${day.elapsedHours.toFixed(2)} h so far). ${boxes}, and the totals count the time so far.`
}

/** The head's amber line for a day somebody never clocked out of: "1 left open". */
export function leftOpenDayChipLabel(day: HoursGridLiveDay): string {
  return `${day.leftOpen} left open`
}

export function leftOpenDayChipTitle(day: HoursGridLiveDay): string {
  const who = day.leftOpen === 1 ? '1 person has a session' : `${day.leftOpen} people have sessions`
  return `${who} left open on this day. Nobody clocked out, and it adds no time here. Press the amber box to open My Time and clock it out.`
}

/** Under a row total that has running time in it: "7:38 on the clock". */
export function liveTotalSubLabel(runningHours: number): string {
  return `${decimalToHm(runningHours)} on the clock`
}

/** A running total's tooltip: the settled part and the running part, apart. */
export function liveTotalTitle(settledHours: number, runningHours: number): string {
  return `${decimalToHms(settledHours) || '0:00:00'} settled and ${decimalToHm(runningHours)} still running. The running part is not in payroll until it is clocked out and approved.`
}
