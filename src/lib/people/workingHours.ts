/**
 * Working hours (punch list #429): a week with a start and an end for each day, set for a person by a dev or the
 * controller, in 15-minute blocks. It is a `set` row on `person_available_hours`, written only by
 * `set_working_hours`, and it wins over the week a person says they can work. For a salaried person the seven
 * hour numbers on pay are worked out from it, each day's hours with the break left out, so the two cannot disagree.
 *
 * This kernel holds the shape the database holds (`working_week_ok`), the set week in force, the days grouped
 * into the lines a screen draws (days that share hours are one line, wherever they fall), the words, and the
 * small moves the row's field makes. Pure. Times are minutes from midnight on the person's own clock.
 */
import { addDaysYmd } from '../emailSchedule/emailScheduleWeek'
import { payWeekContaining } from '../payWeekAnchor'
import { val } from '../valuesInPlace'
import type { AvailableHoursAnswer } from './utilization'
import type { Segment, WeekDays } from './weekAvailability'

export const WORKING_HOURS_STEP_MINUTES = 15
/** A day holds one range, or two with a break between. */
export const WORKING_HOURS_MAX_RANGES = 2
export const WORKING_HOURS_MAX_DAY_MINUTES = 16 * 60
export const WORKING_HOURS_MAX_WEEK_HOURS = 80
const MINUTES_IN_DAY = 24 * 60
/** Monday first: the order a week is read in. */
const READ_ORDER = [1, 2, 3, 4, 5, 6, 0] as const
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'] as const

// ---------- the shape ----------

/** Why a day's ranges cannot be kept, in plain words, or null. `name` is the day as the sentence says it. */
export function workingDayProblem(segs: readonly Segment[], name = 'A day'): string | null {
  if (segs.length > WORKING_HOURS_MAX_RANGES) return `${name} holds two ranges at most.`
  let prevEnd: number | null = null
  let total = 0
  for (const [s, e] of segs) {
    if (!Number.isInteger(s) || !Number.isInteger(e) || s % WORKING_HOURS_STEP_MINUTES !== 0 || e % WORKING_HOURS_STEP_MINUTES !== 0) return `${name} has a time off the quarter hour.`
    if (s < 0 || e > MINUTES_IN_DAY) return `${name} runs outside the day.`
    if (s >= e) return `${name} ends before it starts.`
    if (prevEnd != null && s <= prevEnd) return `${name} needs a break between its two ranges.`
    prevEnd = e
    total += e - s
  }
  if (total > WORKING_HOURS_MAX_DAY_MINUTES) return `${name} is over 16 hours.`
  return null
}

/** Why a week cannot be kept, or null. The same rule as `working_week_ok` in SQL, with the 80-hour cap the door adds. */
export function workingWeekProblem(days: WeekDays): string | null {
  if (!Array.isArray(days) || days.length !== 7) return 'A week is seven days.'
  for (const dow of READ_ORDER) {
    const problem = workingDayProblem(days[dow] ?? [], DAY_LONG[dow])
    if (problem) return problem
  }
  const hours = workingWeekHours(days)
  if (hours > WORKING_HOURS_MAX_WEEK_HOURS) return `A week holds no more than ${WORKING_HOURS_MAX_WEEK_HOURS} hours. This one is ${formatHours(hours)}.`
  return null
}

/** A stored week as the kernel reads it, or null when it is not seven days of sound ranges. Never repaired. */
export function parseWorkingWeek(raw: unknown): WeekDays | null {
  if (!Array.isArray(raw) || raw.length !== 7) return null
  const days: WeekDays = []
  for (const day of raw) {
    if (!Array.isArray(day)) return null
    const segs: Segment[] = []
    for (const seg of day) {
      if (!Array.isArray(seg) || seg.length !== 2 || typeof seg[0] !== 'number' || typeof seg[1] !== 'number') return null
      segs.push([seg[0], seg[1]])
    }
    if (workingDayProblem(segs)) return null
    days.push(segs)
  }
  return days
}

// ---------- the hours ----------

const round2 = (n: number): number => Math.round(n * 100) / 100

export function workingDayMinutes(segs: readonly Segment[]): number {
  return segs.reduce((a, [s, e]) => a + Math.max(0, e - s), 0)
}

/** A day's hours, to the quarter. */
export function workingDayHours(segs: readonly Segment[]): number {
  return round2(workingDayMinutes(segs) / 60)
}

export function workingWeekHours(days: WeekDays): number {
  return round2(days.reduce((a, segs) => a + workingDayMinutes(segs), 0) / 60)
}

/** The seven hour numbers pay keeps for a salaried person, Sunday first: each day's hours with the break left out. */
export function paidWeekOf(days: WeekDays): number[] {
  return Array.from({ length: 7 }, (_, d) => workingDayHours(days[d] ?? []))
}

/** A salaried person's pay moves when a day's length is not the number pay holds for it. */
export function workingHoursMovePay(days: WeekDays, paidWeek: readonly number[]): boolean {
  return paidWeekOf(days).some((h, d) => Math.abs(h - (Number(paidWeek[d]) || 0)) > 0.001)
}

/**
 * The first time, for a person on a set week: every paid day starts at `startMinute` and runs its paid hours, so
 * pay cannot move. Null when a day would run past midnight or lands off the quarter hour.
 */
export function workingWeekFromPaidWeek(paidWeek: readonly number[], startMinute: number): WeekDays | null {
  const days: WeekDays = []
  for (let d = 0; d < 7; d++) {
    const hours = Number(paidWeek[d]) || 0
    if (!(hours > 0)) {
      days.push([])
      continue
    }
    const end = startMinute + Math.round(hours * 60)
    if (workingDayProblem([[startMinute, end]])) return null
    days.push([[startMinute, end]])
  }
  return days
}

// ---------- the set week in force ----------

const isSet = (a: AvailableHoursAnswer): boolean => a.kind === 'set'
const newer = (a: AvailableHoursAnswer, b: AvailableHoursAnswer): boolean => a.effective_from > b.effective_from || (a.effective_from === b.effective_from && a.set_at > b.set_at)

/**
 * The set row that holds on a day: the newest one on or before it. Unlike an answer, the first set row does not
 * reach back before its Sunday. A row with no week means the hours were taken off, and it is still the row in force.
 */
export function setRowInForce(rows: readonly AvailableHoursAnswer[], ymd: string): AvailableHoursAnswer | null {
  let best: AvailableHoursAnswer | null = null
  for (const a of rows) {
    if (!isSet(a) || a.effective_from > ymd) continue
    if (!best || newer(a, best)) best = a
  }
  return best
}

/** A person's working hours on a day, or null with none set or with them taken off. */
export function workingHoursInForce(rows: readonly AvailableHoursAnswer[], ymd: string): WeekDays | null {
  return setRowInForce(rows, ymd)?.days ?? null
}

/** The set row that starts after today, when the hours are about to change: the newest of the earliest Sunday ahead. */
export function workingHoursComing(rows: readonly AvailableHoursAnswer[], todayYmd: string): AvailableHoursAnswer | null {
  let best: AvailableHoursAnswer | null = null
  for (const a of rows) {
    if (!isSet(a) || a.effective_from <= todayYmd) continue
    if (!best || a.effective_from < best.effective_from || (a.effective_from === best.effective_from && a.set_at > best.set_at)) best = a
  }
  return best
}

/** Every set row, the newest first: what the hours were, who set each and why. */
export function workingHoursHistory(rows: readonly AvailableHoursAnswer[]): AvailableHoursAnswer[] {
  return rows.filter(isSet).sort((a, b) => (newer(a, b) ? -1 : newer(b, a) ? 1 : 0))
}

/** The two Sundays hours may start on: this week's and next week's. */
export function workingHoursStarts(todayYmd: string): { thisWeek: string; nextWeek: string } {
  const thisWeek = payWeekContaining(todayYmd).start
  return { thisWeek, nextWeek: addDaysYmd(thisWeek, 7) }
}

// ---------- the lines ----------

export type WorkingHoursLine = {
  /** The days on the line, in reading order, Monday first. */
  days: number[]
  /** The ranges those days share; empty for a line of days off. */
  segs: Segment[]
}

const sameSegs = (a: readonly Segment[], b: readonly Segment[]): boolean => a.length === b.length && a.every(([s, e], i) => s === b[i]![0] && e === b[i]![1])

/** The week as the lines a screen draws: days that share their hours are one line, wherever they fall in the week. */
export function workingHoursLines(days: WeekDays): WorkingHoursLine[] {
  const lines: WorkingHoursLine[] = []
  for (const dow of READ_ORDER) {
    const segs = days[dow] ?? []
    const hit = lines.find((l) => sameSegs(l.segs, segs))
    if (hit) hit.days.push(dow)
    else lines.push({ days: [dow], segs: segs.map(([s, e]): Segment => [s, e]) })
  }
  return lines
}

/** "Mon to Fri", "Sat, Sun", "Mon, Tue, Thu, Fri": a run of three days or more reads as a range. */
export function workingDaysLabel(dows: readonly number[]): string {
  const runs: number[][] = []
  for (const d of dows) {
    const last = runs[runs.length - 1]
    const prev = last?.[last.length - 1]
    if (last && prev != null && READ_ORDER.indexOf(d as (typeof READ_ORDER)[number]) === READ_ORDER.indexOf(prev as (typeof READ_ORDER)[number]) + 1) last.push(d)
    else runs.push([d])
  }
  return runs.map((r) => (r.length > 2 ? `${DAY_SHORT[r[0]!]} to ${DAY_SHORT[r[r.length - 1]!]}` : r.map((d) => DAY_SHORT[d]).join(', '))).join(', ')
}

/** The week with one line's days given new ranges, or made days off with an empty list. */
export function withWorkingDays(days: WeekDays, dows: readonly number[], segs: readonly Segment[]): WeekDays {
  return Array.from({ length: 7 }, (_, d) => (dows.includes(d) ? segs.map(([s, e]): Segment => [s, e]) : (days[d] ?? []).map(([s, e]): Segment => [s, e])))
}

/** A day cut to half its length from its start, on the quarter hour. A day with a break is halved as one range. */
export function halfDay(segs: readonly Segment[]): Segment[] {
  const first = segs[0]
  if (!first) return []
  const half = Math.max(WORKING_HOURS_STEP_MINUTES, Math.round(workingDayMinutes(segs) / 2 / WORKING_HOURS_STEP_MINUTES) * WORKING_HOURS_STEP_MINUTES)
  return [[first[0], Math.min(MINUTES_IN_DAY, first[0] + half)]]
}

/** The ranges most working days share, leaving out the days named: what "Same as the other days" gives. */
export function usualWorkingDay(days: WeekDays, leaveOut: readonly number[] = []): Segment[] | null {
  let best: WorkingHoursLine | null = null
  for (const line of workingHoursLines(Array.from({ length: 7 }, (_, d) => (leaveOut.includes(d) ? [] : (days[d] ?? []))))) {
    if (line.segs.length && (!best || line.days.length > best.days.length)) best = line
  }
  return best ? best.segs : null
}

// ---------- words ----------

/** "6:00 AM", "12:00 PM", "12:00 AM" for midnight at either end. */
export function formatWorkingClock(minute: number): string {
  const m = ((Math.round(minute) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY
  const h24 = Math.floor(m / 60)
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m % 60).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`
}

/** Hours without a trailing zero: "6", "4.25", "36". */
export function formatHours(hours: number): string {
  return String(round2(hours))
}

/** "6:00 AM to 12:00 PM", "7:00 AM to 11:30 AM, then 12:00 PM to 3:30 PM", "Off". */
export function workingRangesWords(segs: readonly Segment[]): string {
  if (!segs.length) return 'Off'
  return segs.map(([s, e]) => `${formatWorkingClock(s)} to ${formatWorkingClock(e)}`).join(', then ')
}

/** The week on one line, for a table cell: "6:00 AM to 12:00 PM Mon to Fri", lines joined by a full stop. */
export function workingWeekLineWords(days: WeekDays): string {
  const lines = workingHoursLines(days).filter((l) => l.segs.length > 0)
  if (lines.length === 0) return 'no working days'
  return lines.map((l) => `${workingRangesWords(l.segs)} ${workingDaysLabel(l.days)}`).join('. ')
}

/** "6 h a day" for a line of several days, "4.25 h" for one, "0 h" for days off. */
export function workingLineHoursWords(line: WorkingHoursLine): string {
  const h = formatHours(workingDayHours(line.segs))
  return line.segs.length && line.days.length > 1 ? `${h} h a day` : `${h} h`
}

/** "five days": the days with hours, as a word. */
export function workingDaysCountWords(days: WeekDays): string {
  const n = days.filter((segs) => segs.length > 0).length
  return `${COUNT_WORDS[n] ?? n} ${n === 1 ? 'day' : 'days'}`
}

/** Every quarter hour a start (from midnight) or an end (to the next midnight) may be, for the row's field. */
export function workingClockChoices(which: 'start' | 'end'): Array<{ value: string; label: string }> {
  const from = which === 'start' ? 0 : WORKING_HOURS_STEP_MINUTES
  const to = which === 'start' ? MINUTES_IN_DAY - WORKING_HOURS_STEP_MINUTES : MINUTES_IN_DAY
  const out: Array<{ value: string; label: string }> = []
  for (let m = from; m <= to; m += WORKING_HOURS_STEP_MINUTES) out.push({ value: String(m), label: formatWorkingClock(m) })
  return out
}

/**
 * A person's hours as the sentences their own card reads, each with its values marked: one line of hours reads
 * *Your hours are 6:00 AM to 12:00 PM, Mon to Fri.* and a week of several lines names each.
 */
export function workingHoursSentences(days: WeekDays): string[] {
  const lines = workingHoursLines(days).filter((l) => l.segs.length > 0)
  if (lines.length === 0) return ['You have no working days set.']
  const rangesOf = (l: WorkingHoursLine) => l.segs.map(([s, e]) => `${val('time', formatWorkingClock(s))} to ${val('time', formatWorkingClock(e))}`).join(', then ')
  if (lines.length === 1) return [`Your hours are ${rangesOf(lines[0]!)}, ${val('days', workingDaysLabel(lines[0]!.days))}.`]
  return lines.map((l) => `${val('days', workingDaysLabel(l.days))}: ${rangesOf(l)}.`)
}

/** What a change comes to, said before Keep: the line's new hours and the week's new total. */
export function workingChangeSentence(args: { days: WeekDays; dows: readonly number[]; segs: readonly Segment[] }): string {
  const label = workingDaysLabel(args.dows)
  const week = withWorkingDays(args.days, args.dows, args.segs)
  const total = `The week would be ${val('hours', `${formatHours(workingWeekHours(week))} h`)}.`
  if (!args.segs.length) return `${label} would be off. ${total}`
  const each = `${val('hours', `${formatHours(workingDayHours(args.segs))} h`)}${args.dows.length > 1 ? ' a day' : ''}`
  const ranges = args.segs.map(([s, e]) => `${val('time', formatWorkingClock(s))} to ${val('time', formatWorkingClock(e))}`).join(', then ')
  return `${label} would be ${ranges}, ${each}. ${total}`
}
