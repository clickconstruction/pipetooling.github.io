/**
 * My Time's picture: a person's last pay weeks as seven days each, with the time on the clock on every day.
 * The card counts time and does not grade it, so nothing here knows a quota, a set week or a percent
 * (the owner, 2026-11-23: a person wants to see how much time they are adding up, and on which days).
 *
 * A day's time is its sessions, closed or still running today. A day whose session nobody closed, so the
 * end-of-day stop closed it at 11:59 PM, is marked, because its time is not the time worked; an approved one is
 * not, since the office has looked at it. Pure: the section reads the sessions and the picture draws these.
 */
import { addDaysYmd } from '../emailSchedule/emailScheduleWeek'
import type { PayWeek } from '../payWeekAnchor'
import { isMidnightCappedClockOut } from '../people/approvalsSessionChips'
import { val } from '../valuesInPlace'

/** The weeks the picture shows, the newest last. */
export const MY_TIME_WEEKS = 8
/** A day's column is never drawn against less than this, so a short day does not look like a full one. */
export const MY_TIME_DAY_FLOOR_SECONDS = 8 * 3600

export type MyTimeSession = {
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  approved_at?: string | null
}

/** `done` is a day gone, `today` is today, `come` is a day of this week still ahead. */
export type MyTimeDayKind = 'done' | 'today' | 'come'

export type MyTimeDay = {
  /** YYYY-MM-DD on the company calendar. */
  ymd: string
  /** 0 Sunday to 6 Saturday. */
  dow: number
  seconds: number
  kind: MyTimeDayKind
  /** When the session still running today was started; null with none open. */
  openSince: string | null
  /** A session here was closed by the end-of-day stop and nobody has approved it. */
  capped: boolean
  /** Sessions on the day, for the press that opens it. */
  sessions: number
}

export type MyTimeWeek = {
  week: PayWeek
  days: MyTimeDay[]
  seconds: number
  /** The week today is in. */
  current: boolean
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export const myTimeDayShort = (dow: number): string => DAY_SHORT[dow] ?? ''

/** One session's seconds: a closed one its length, a running one up to now, and only on today. */
export function myTimeSessionSeconds(s: MyTimeSession, todayYmd: string, nowMs: number): number {
  const inMs = Date.parse(s.clocked_in_at)
  if (!Number.isFinite(inMs)) return 0
  if (s.clocked_out_at) {
    const outMs = Date.parse(s.clocked_out_at)
    return Number.isFinite(outMs) && outMs > inMs ? Math.floor((outMs - inMs) / 1000) : 0
  }
  if (s.work_date !== todayYmd) return 0
  return nowMs > inMs ? Math.floor((nowMs - inMs) / 1000) : 0
}

/** The weeks as the picture draws them, in the order given. A session outside every week is left out. */
export function buildMyTimeWeeks(args: { weeks: readonly PayWeek[]; sessions: readonly MyTimeSession[]; todayYmd: string; nowMs: number }): MyTimeWeek[] {
  const { weeks, sessions, todayYmd, nowMs } = args
  const byDay = new Map<string, MyTimeSession[]>()
  for (const s of sessions) {
    const list = byDay.get(s.work_date)
    if (list) list.push(s)
    else byDay.set(s.work_date, [s])
  }
  return weeks.map((week) => {
    const days: MyTimeDay[] = []
    for (let i = 0; i < 7; i++) {
      const ymd = addDaysYmd(week.start, i)
      const list = byDay.get(ymd) ?? []
      let seconds = 0
      let openSince: string | null = null
      let capped = false
      for (const s of list) {
        seconds += myTimeSessionSeconds(s, todayYmd, nowMs)
        if (!s.clocked_out_at && ymd === todayYmd && (openSince == null || s.clocked_in_at < openSince)) openSince = s.clocked_in_at
        if (!s.approved_at && isMidnightCappedClockOut(s.clocked_out_at)) capped = true
      }
      days.push({ ymd, dow: i, seconds, kind: ymd === todayYmd ? 'today' : ymd > todayYmd ? 'come' : 'done', openSince, capped, sessions: list.length })
    }
    return { week, days, seconds: days.reduce((a, d) => a + d.seconds, 0), current: todayYmd >= week.start && todayYmd <= week.end }
  })
}

/** Whole hours and the minutes left over, as the picture prints them apart. */
export function myTimeHm(seconds: number): { h: number; m: number } {
  const mins = Math.max(0, Math.floor(seconds / 60))
  return { h: Math.floor(mins / 60), m: mins % 60 }
}

/** "7h 24m", "45m", "0m": one figure on one line. */
export function myTimeDuration(seconds: number): string {
  const { h, m } = myTimeHm(seconds)
  return h === 0 ? `${m}m` : `${h}h ${m}m`
}

/** "14 h 45 m", "8 h", "45 m": a figure inside a sentence. */
export function myTimeDurationWords(seconds: number): string {
  const { h, m } = myTimeHm(seconds)
  if (h === 0) return `${m} m`
  return m ? `${h} h ${m} m` : `${h} h`
}

function monthDay(ymd: string): string {
  const [, mm, dd] = ymd.split('-')
  return `${MONTH_SHORT[Number(mm) - 1] ?? ''} ${Number(dd)}`
}

/** "This week", "Last week", "Week of Nov 1". `index` is the week's place in `weeks`, the current one last. */
export function myTimeWeekLabel(weeks: readonly MyTimeWeek[], index: number): string {
  const w = weeks[index]
  if (!w) return ''
  if (w.current) return 'This week'
  if (weeks[index + 1]?.current) return 'Last week'
  return `Week of ${monthDay(w.week.start)}`
}

/** "Nov 1 to Nov 7". */
export function myTimeWeekRange(week: PayWeek): string {
  return `${monthDay(week.start)} to ${monthDay(week.end)}`
}

/** "11/1": the week's Sunday, under its column. */
export function myTimeWeekSunday(week: PayWeek): string {
  const [, mm, dd] = week.start.split('-')
  return `${Number(mm)}/${Number(dd)}`
}

/** The height of a column in percent of the tallest it is drawn against, never under 4 for a column with time. */
export function myTimeColumnPct(seconds: number, topSeconds: number): number {
  if (!(seconds > 0) || !(topSeconds > 0)) return 0
  return Math.max(4, Math.min(100, Math.round((seconds / topSeconds) * 100)))
}

/** The tallest day a week's columns are drawn against: its longest day, and never under the floor. */
export function myTimeDayTop(week: MyTimeWeek): number {
  return Math.max(MY_TIME_DAY_FLOOR_SECONDS, ...week.days.map((d) => d.seconds))
}

/** The tallest week the weeks' columns are drawn against. */
export function myTimeWeekTop(weeks: readonly MyTimeWeek[]): number {
  return Math.max(MY_TIME_DAY_FLOOR_SECONDS, ...weeks.map((w) => w.seconds))
}

/**
 * What the picture says about a day the end-of-day stop closed. `canFix` is a person who can open the day
 * themself; a salaried person's days are the office's to fix. The day and the time are marked as values.
 */
export function myTimeCappedSentence(day: MyTimeDay, canFix: boolean): string {
  const who = canFix ? 'Press the day to fix it.' : 'Ask the office to fix it.'
  return `Check ${val('day', DAY_LONG[day.dow] ?? '')}. Nobody clocked out, so the clock stopped itself at midnight. It shows ${val('time', myTimeDurationWords(day.seconds))}. ${who}`
}

/** "On the clock since 8:00 AM." The time is handed in already formatted on the company clock. */
export function myTimeOnClockSentence(sinceWords: string): string {
  return `On the clock since ${val('time', sinceWords)}.`
}

/** What a screen reader hears for a day's column. */
export function myTimeDayLabel(day: MyTimeDay): string {
  const name = `${DAY_LONG[day.dow] ?? ''} ${monthDay(day.ymd)}`
  if (day.kind === 'come') return `${name}, still to come`
  return `${name}, ${myTimeDurationWords(day.seconds)}${day.kind === 'today' ? ', today' : ''}${day.capped ? ', the clock stopped itself at midnight' : ''}`
}
