/**
 * Quickfill's Email station (punch list #159, v2.5828, PR 5 of 5): the trend its Mark history window shows instead of
 * the retyped list. Per counted label, a bar a day for four weeks: how many threads sat (`email_box_days.count`), red on
 * a day the oldest was past the limit, marked on a day someone looked. Under it, a row per day for two weeks, the days
 * nobody looked included, since those are the days the station exists for: who looked, how many sat, the oldest, what
 * came and cleared, and what sat past the limit by name, rebuilt from the threads the count kept (each thread's arrival,
 * when the count first saw it, and when it was gone). Pure.
 */
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso, endOfYmdInAppTzMs, ymdAddDays } from '../../utils/dateUtils'
import { ageDays } from '../emailIn/labelSweep'
import type { StationThreadRow } from './emailStation'

/** A row of `email_box_days` as the window reads it. */
export interface TrendDayRow {
  watch_id: string
  label_name: string
  /** YYYY-MM-DD, the app's calendar. */
  day: string
  count: number
  oldest_days: number | null
  new_count: number
  cleared_count: number
}

/** A mark of the station, as the window reads it. */
export interface TrendMark {
  marked_at: string
  name: string | null
}

export interface TrendBar {
  ymd: string
  /** Null for a day the count did not run. */
  count: number | null
  oldestDays: number | null
  /** The oldest was past the limit that day. */
  hot: boolean
  /** Someone marked the station that day. */
  looked: boolean
}

export interface TrendSeries {
  key: string
  /** "bids@ · Inbox", "Marisol · Follow Up". */
  title: string
  todayCount: number | null
  todayOldest: number | null
  bars: TrendBar[]
}

export interface TrendSat {
  days: number
  from: string
  subject: string
}

export interface TrendRow {
  ymd: string
  /** "Fri Oct 23". */
  dayWords: string
  /** "Marisol · 9:55 AM", the day's first mark; null when nobody looked. */
  looked: string | null
  open: number | null
  oldestDays: number | null
  newCount: number
  clearedCount: number
  /** What sat past the limit at the end of that day, oldest first. */
  sat: TrendSat[]
}

export interface EmailTrend {
  series: TrendSeries[]
  rows: TrendRow[]
  /** How many of the rows' days nobody looked at. */
  daysNobodyLooked: number
}

export interface EmailTrendInput {
  /** The boxes the viewer may see, in the station's order, with the names the window uses. */
  boxes: readonly { watchId: string; words: string; labels: readonly string[] }[]
  days: readonly TrendDayRow[]
  threads: readonly StationThreadRow[]
  marks: readonly TrendMark[]
  limitDays: number
  nowIso: string
  /** Bars per series; 28 is four weeks. */
  barDays?: number
  /** Rows of the day by day; 14 is two weeks. */
  rowDays?: number
}

/** "Fri Oct 23". */
export function trendDayWords(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number]
  const noon = new Date(Date.UTC(y, m - 1, d, 17))
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, weekday: 'short', month: 'short', day: 'numeric' }).formatToParts(noon)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('weekday')} ${get('month')} ${get('day')}`
}

const timeWords = (iso: string): string => new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))

/** The trend for the window. */
export function emailTrend(input: EmailTrendInput): EmailTrend {
  const barDays = input.barDays ?? 28
  const rowDays = input.rowDays ?? 14
  const today = calendarYmdInAppTzFromIso(input.nowIso)
  const ymds = (n: number) => Array.from({ length: n }, (_, i) => ymdAddDays(today, i - (n - 1)))
  const lookedDays = new Map<string, TrendMark>()
  for (const m of [...input.marks].sort((a, b) => a.marked_at.localeCompare(b.marked_at))) {
    const ymd = calendarYmdInAppTzFromIso(m.marked_at)
    if (!lookedDays.has(ymd)) lookedDays.set(ymd, m)
  }
  const byKey = new Map<string, TrendDayRow>()
  for (const d of input.days) byKey.set(`${d.watch_id}|${d.label_name}|${d.day}`, d)

  const series: TrendSeries[] = input.boxes.flatMap((b) =>
    b.labels.map((label) => {
      const bars = ymds(barDays).map((ymd): TrendBar => {
        const d = byKey.get(`${b.watchId}|${label}|${ymd}`)
        return { ymd, count: d ? d.count : null, oldestDays: d?.oldest_days ?? null, hot: (d?.oldest_days ?? 0) > input.limitDays, looked: lookedDays.has(ymd) }
      })
      const last = bars[bars.length - 1]!
      return { key: `${b.watchId}|${label}`, title: `${b.words} · ${label}`, todayCount: last.count, todayOldest: last.oldestDays, bars }
    }),
  )

  const keys = new Set(input.boxes.flatMap((b) => b.labels.map((l) => `${b.watchId}|${l}`)))
  const rows: TrendRow[] = ymds(rowDays)
    .reverse()
    .map((ymd) => {
      const dayRows = input.days.filter((d) => d.day === ymd && keys.has(`${d.watch_id}|${d.label_name}`))
      const end = endOfYmdInAppTzMs(ymd)
      const endIso = new Date(Math.min(end, new Date(input.nowIso).getTime())).toISOString()
      const sat = input.threads
        .filter((t) => keys.has(`${t.watch_id}|${t.label_name}`))
        .filter((t) => new Date(t.first_seen_at).getTime() <= end && (!t.gone_at || new Date(t.gone_at).getTime() > end))
        .map((t) => ({ days: ageDays(t.arrived_at, endIso), from: t.from_name?.trim() || t.from_address?.trim() || 'someone', subject: t.subject.trim() || '(no subject)' }))
        .filter((t): t is TrendSat => t.days != null && t.days > input.limitDays)
        .sort((a, b) => b.days - a.days)
      const mark = lookedDays.get(ymd)
      return {
        ymd,
        dayWords: trendDayWords(ymd),
        looked: mark ? `${mark.name?.trim() || 'Someone'} · ${timeWords(mark.marked_at)}` : null,
        open: dayRows.length ? dayRows.reduce((n, d) => n + d.count, 0) : null,
        oldestDays: dayRows.some((d) => d.oldest_days != null) ? Math.max(...dayRows.map((d) => d.oldest_days ?? 0)) : null,
        newCount: dayRows.reduce((n, d) => n + d.new_count, 0),
        clearedCount: dayRows.reduce((n, d) => n + d.cleared_count, 0),
        sat,
      }
    })

  return { series, rows, daysNobodyLooked: rows.filter((r) => !r.looked).length }
}
