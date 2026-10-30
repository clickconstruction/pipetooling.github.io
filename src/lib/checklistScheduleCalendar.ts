/**
 * Punch list #217, office-13 (v2.6145): the New task window's schedule drawn. Under the weekday buttons, the next
 * weeks as a small calendar, one row a week, Sunday first: every day the task lands filled, the start and the end
 * marked, today ringed, a start that is not a picked day ringed amber, which is the warning the words give today. For
 * *days after it's done*, the days the chain would land on are dashed, since each moves with the one before it; for
 * a one-off, its day and the due day with a bar between. The sentence (`checklistScheduleSummary.ts`) stays under the
 * calendar as its caption. The days come from `materializeDates` (`checklistMaterialize.ts`), the one place that
 * decides them, so the calendar and Save agree. Pure.
 */
import { ymdAddDays } from '../utils/dateUtils'
import { dowOfYmd, materializeDates } from './checklistMaterialize'
import { startNotOnChosenDay } from './checklistScheduleSummary'

export interface ScheduleCalendarInput {
  when: 'today' | 'date' | 'repeat'
  repeatMode: 'weekly' | 'after_done'
  startDate: string
  todayStr: string
  daysOfWeek: number[]
  daysAfter: number
  endDate: string | null
  /** A one-off's deadline, when it has one. */
  dueDate?: string | null
}

export interface CalendarDay {
  ymd: string
  /** The day of the month, the number the cell prints. */
  day: number
  /** The task lands on this day. */
  lands: boolean
  /** A day the chain would land on, if each one before it is done on its day. */
  maybe: boolean
  today: boolean
  start: boolean
  /** The start is not one of the picked days: the amber ring. */
  startOff: boolean
  end: boolean
  due: boolean
  /** Between a one-off's day and its due day: the bar. */
  between: boolean
  /** Before the start, or past the end: the task never lands here. */
  dim: boolean
  /** What the cell says on hover and to a screen reader: "Wednesday, Nov 4. The task lands." */
  words: string
}

export interface CalendarWeek {
  /** The week's first day, "Oct 25". */
  label: string
  /** Seven days, Sunday first. */
  days: CalendarDay[]
}

export interface CalendarNote {
  tone: 'plain' | 'warn'
  words: string
}

export interface ScheduleCalendar {
  weeks: CalendarWeek[]
  /** The short notes under the grid. */
  notes: CalendarNote[]
}

/** The rows the calendar draws: this week and the next three. */
export const SCHEDULE_CALENDAR_WEEKS = 4

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const YMD = /^\d{4}-\d{2}-\d{2}$/

function validYmd(ymd: string | null | undefined): ymd is string {
  return !!ymd && YMD.test(ymd) && !Number.isNaN(new Date(ymd + 'T12:00:00').getTime())
}

const noon = (ymd: string): Date => new Date(ymd + 'T12:00:00')

/** "Tue, Nov 3", or "today". */
function dayWords(ymd: string, todayStr: string): string {
  if (ymd === todayStr) return 'today'
  return noon(ymd).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

/** "Wednesday, Nov 4": the cell's own words. */
function longDayWords(ymd: string): string {
  return noon(ymd).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

/** "Oct 25": a week's label. */
function weekLabel(ymd: string): string {
  return noon(ymd).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/** The Sunday on or before a day. */
function sundayOf(ymd: string): string {
  return ymdAddDays(ymd, -dowOfYmd(ymd))
}

/** "Mon or Wed": the picked days, for the note on a start off them. */
function orDays(days: readonly number[]): string {
  return [...new Set(days)]
    .sort((a, b) => a - b)
    .map((d) => DAY_SHORT[d] ?? '?')
    .join(' or ')
}

/** Whole days from one day to another, both counted: Mon to Fri is 5. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86_400_000) + 1
}

/**
 * The calendar for what the form says, or null when there is nothing to draw: a start the form cannot read, or a
 * one-off on today with no due day, which the sentence says whole. The frame is this week and the next three; when
 * the start is further out, the frame opens on the start's week instead, and today is off it.
 */
export function checklistScheduleCalendar(input: ScheduleCalendarInput): ScheduleCalendar | null {
  const todayStr = input.todayStr
  if (!validYmd(todayStr)) return null
  const start = input.when === 'today' ? todayStr : input.startDate
  if (!validYmd(start)) return null
  const once = input.when !== 'repeat'
  const weekly = !once && input.repeatMode === 'weekly'
  const afterDone = !once && input.repeatMode === 'after_done'
  const due = once && validYmd(input.dueDate) && input.dueDate > start ? input.dueDate : null
  if (once && input.when === 'today' && !due) return null
  const end = weekly && validYmd(input.endDate) ? input.endDate : null

  const todayWeek = sundayOf(todayStr)
  const startWeek = sundayOf(start)
  const first = startWeek > ymdAddDays(todayWeek, 7) ? startWeek : todayWeek
  const last = ymdAddDays(first, SCHEDULE_CALENDAR_WEEKS * 7 - 1)

  const cfg = { repeat_type: weekly ? ('day_of_week' as const) : ('once' as const), repeat_days_of_week: input.daysOfWeek, start_date: start, repeat_end_date: end }
  const lands = new Set(materializeDates(cfg, first, last))
  const every = Math.max(1, Math.floor(input.daysAfter) || 1)
  const maybe = new Set<string>()
  if (afterDone) {
    for (let d = ymdAddDays(start, every); d <= last; d = ymdAddDays(d, every)) if (d >= first) maybe.add(d)
  }
  const startOff = weekly && startNotOnChosenDay(start, input.daysOfWeek)
  const lastLanding = once ? (due ?? start) : end

  const weeks: CalendarWeek[] = []
  for (let w = 0; w < SCHEDULE_CALENDAR_WEEKS; w++) {
    const sunday = ymdAddDays(first, w * 7)
    const days: CalendarDay[] = []
    for (let i = 0; i < 7; i++) {
      const ymd = ymdAddDays(sunday, i)
      const day: CalendarDay = {
        ymd,
        day: Number(ymd.slice(8, 10)),
        lands: lands.has(ymd),
        maybe: maybe.has(ymd),
        today: ymd === todayStr,
        start: ymd === start,
        startOff: ymd === start && startOff,
        end: !!end && ymd === end,
        due: !!due && ymd === due,
        between: !!due && ymd > start && ymd < due,
        dim: ymd < start || (!!lastLanding && ymd > lastLanding),
        words: '',
      }
      day.words = cellWords(day, every)
      days.push(day)
    }
    weeks.push({ label: weekLabel(sunday), days })
  }

  const notes: CalendarNote[] = []
  if (weekly && startOff) {
    const firstLanding = materializeDates(cfg, start, ymdAddDays(start, 6))[0]
    if (firstLanding) notes.push({ tone: 'warn', words: `Starts ${dayWords(start, todayStr)}. The first ${orDays(input.daysOfWeek)} is ${dayWords(firstLanding, todayStr)}.` })
  }
  if (weekly && end) {
    const count = materializeDates(cfg, start, end).length
    notes.push({ tone: 'plain', words: count === 0 ? `Ends ${dayWords(end, todayStr)}. No day lands.` : `Ends ${dayWords(end, todayStr)}. ${count} ${count === 1 ? 'day' : 'days'} in all.` })
  }
  if (afterDone) notes.push({ tone: 'plain', words: `Then ${every} ${every === 1 ? 'day' : 'days'} after each one is done.` })
  if (due) {
    const n = daysBetween(start, due)
    notes.push({ tone: 'plain', words: `Due ${dayWords(due, todayStr)}. ${n} days to do it.` })
  }
  return { weeks, notes }
}

/** The cell's words: the day, then what the task does on it. */
function cellWords(day: CalendarDay, every: number): string {
  const parts: string[] = []
  if (day.today) parts.push('Today.')
  if (day.startOff) parts.push('Starts here, which is not a picked day.')
  else if (day.start && day.lands) parts.push('Starts here. The task lands.')
  else if (day.start) parts.push('Starts here.')
  else if (day.lands) parts.push('The task lands.')
  if (day.maybe) parts.push(`Lands here if the one ${every === 1 ? '1 day' : `${every} days`} before is done on its day.`)
  if (day.due) parts.push('Due.')
  if (day.between) parts.push('On the list.')
  if (day.end) parts.push(day.lands ? 'The last day.' : 'Ends here.')
  return [`${longDayWords(day.ymd)}.`, ...parts].join(' ')
}
