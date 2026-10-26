/**
 * Assistant Dailys reads its siblings (punch list #180, PR 1). Three of the station's boxes
 * restated the Schedule, Email and Physical inbox stations, which the round visits anyway, and
 * a tick said looked but never what was there. A box can now be marked as reading a station: its
 * row is satisfied by that station's own mark today, by anyone, and shows the station's live
 * count beside it. A box marked as reading time off lists who is off in the next
 * `DAILYS_TIME_OFF_WINDOW_DAYS` days from `user_time_off`; it stays a tick (Told the lead) and is
 * satisfied on its own when nobody is off. Every other box is a tick as before. The count is the
 * rows not yet satisfied, the Next line names the first, and the note the Mark saves is written
 * from the rows. Pure: the section loads, this shapes.
 */
import type { ChecklistItem } from './checklistItems'

export const DAILYS_READ_STATIONS = ['schedule', 'email-inbox', 'physical-inbox'] as const
export type DailysReadStation = (typeof DAILYS_READ_STATIONS)[number]
export type DailysRead = DailysReadStation | 'time-off'

export const DAILYS_STATION_LABELS: Readonly<Record<DailysReadStation, string>> = {
  schedule: 'Schedule',
  'email-inbox': 'Email',
  'physical-inbox': 'Physical inbox',
}

/** The dev's pick per box, in the Edit checklist select. */
export const DAILYS_READ_OPTIONS: ReadonlyArray<{ value: DailysRead | ''; label: string }> = [
  { value: '', label: 'A tick' },
  { value: 'schedule', label: 'Reads the Schedule station' },
  { value: 'email-inbox', label: 'Reads the Email station' },
  { value: 'physical-inbox', label: 'Reads the Physical inbox station' },
  { value: 'time-off', label: 'Reads time off coming up' },
]

export const DAILYS_TIME_OFF_WINDOW_DAYS = 14

/** The time-off row for a role the table shows only their own rows to. */
export const TIME_OFF_NOT_READABLE = 'The app reads time off for the office roles. Ask, then tick.'

export type DailyItem = ChecklistItem & { reads?: DailysRead }

export function isDailysRead(v: unknown): v is DailysRead {
  return v === 'time-off' || (typeof v === 'string' && (DAILYS_READ_STATIONS as readonly string[]).includes(v))
}

/** The items as `app_settings` stores them: JSON `[{ id, label, reads? }]`; anything else is an empty list. */
export function parseDailyItems(raw: string | null | undefined): DailyItem[] {
  if (raw == null || raw === '') return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: DailyItem[] = []
    for (const x of parsed) {
      if (x == null || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      const id = typeof o.id === 'string' ? o.id : ''
      const label = typeof o.label === 'string' ? o.label.trim() : ''
      if (!id || !label) continue
      out.push(isDailysRead(o.reads) ? { id, label, reads: o.reads } : { id, label })
    }
    return out
  } catch {
    return []
  }
}

/** The list with one box's read changed in place; null when nothing changes. */
export function setDailyItemRead(items: ReadonlyArray<DailyItem>, id: string, reads: DailysRead | ''): DailyItem[] | null {
  const current = items.find((i) => i.id === id)
  if (!current || (current.reads ?? '') === reads) return null
  return items.map((i) => {
    if (i.id !== id) return i
    const next: DailyItem = { id: i.id, label: i.label }
    if (reads) next.reads = reads
    return next
  })
}

export type DailyCheck = { checkedByName: string | null; checkedAt: string }
export type StationMarkLike = { marked_at: string; marked_by_name?: string | null }
export type SiblingMetric = { count: number | null; nextLine?: string | null }
export type TimeOffRow = { user_id: string; name: string | null; start_date: string; end_date: string }

export type TimeOffPerson = { userId: string; name: string; /** "off Thu Oct 29 to Fri Oct 30" */ words: string; startYmd: string }

export type DailysRow =
  | { kind: 'tick'; item: DailyItem; ticked: boolean; satisfied: boolean }
  | {
      kind: 'station'
      item: DailyItem
      station: DailysReadStation
      stationLabel: string
      satisfied: boolean
      /** "marked today at 8:52 AM by Marisol", or null when the station has no mark today. */
      markedWords: string | null
      /** "6 open", or null when the station's count is not on the page (collapsed, loading, no count). */
      countWords: string | null
      nextLine: string | null
    }
  | { kind: 'time-off'; item: DailyItem; ticked: boolean; satisfied: boolean; people: TimeOffPerson[]; words: string }

export type DailysContext = {
  todayYmd: string
  checks: ReadonlyMap<string, DailyCheck>
  marks: Readonly<Record<string, StationMarkLike | undefined>>
  metrics: Readonly<Record<string, SiblingMetric | undefined>>
  timeOff: ReadonlyArray<TimeOffRow>
  /** False for a role the table shows only their own rows to: the row stays a tick and says so. Default true. */
  timeOffReadable?: boolean
  /** The company calendar day of an ISO stamp. */
  ymdOf: (iso: string) => string
  /** "8:52 AM" for an ISO stamp. */
  timeOf: (iso: string) => string
  windowDays?: number
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00`)
  d.setDate(d.getDate() + days)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function dayWords(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ymd
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' })
  const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${wd} ${md}`
}

/**
 * Who is off in the window, one line a person, soonest first: a row that overlaps today through
 * today + windowDays, clipped to the window's words. Two rows for one person read as the earlier one.
 */
export function timeOffPeople(rows: ReadonlyArray<TimeOffRow>, todayYmd: string, windowDays = DAILYS_TIME_OFF_WINDOW_DAYS): TimeOffPerson[] {
  const endYmd = addDaysYmd(todayYmd, windowDays)
  const byUser = new Map<string, TimeOffRow>()
  for (const r of rows) {
    if (r.end_date < todayYmd || r.start_date > endYmd) continue
    const have = byUser.get(r.user_id)
    if (!have || r.start_date < have.start_date) byUser.set(r.user_id, r)
  }
  return [...byUser.values()]
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || (a.name ?? '').localeCompare(b.name ?? ''))
    .map((r) => {
      const name = r.name?.trim() || 'Someone'
      const start = r.start_date < todayYmd ? todayYmd : r.start_date
      const words = r.end_date === start ? `${name} off ${dayWords(start)}` : `${name} off ${dayWords(start)} to ${dayWords(r.end_date)}`
      return { userId: r.user_id, name, words, startYmd: start }
    })
}

/** One row per box, in the list's order. */
export function dailysRows(items: ReadonlyArray<DailyItem>, ctx: DailysContext): DailysRow[] {
  const people = timeOffPeople(ctx.timeOff, ctx.todayYmd, ctx.windowDays)
  return items.map((item): DailysRow => {
    const ticked = ctx.checks.has(item.id)
    if (item.reads === 'time-off') {
      if (ctx.timeOffReadable === false) {
        return { kind: 'time-off', item, ticked, satisfied: ticked, people: [], words: TIME_OFF_NOT_READABLE }
      }
      const n = people.length
      const words = n === 0 ? `Nobody is off in the next ${ctx.windowDays ?? DAILYS_TIME_OFF_WINDOW_DAYS} days.` : people.map((p) => p.words).join(' · ')
      return { kind: 'time-off', item, ticked, satisfied: n === 0 || ticked, people, words }
    }
    if (item.reads) {
      const station = item.reads
      const mark = ctx.marks[station]
      const today = mark ? ctx.ymdOf(mark.marked_at) === ctx.todayYmd : false
      const markedWords = mark && today ? `marked today at ${ctx.timeOf(mark.marked_at)}${mark.marked_by_name ? ` by ${mark.marked_by_name}` : ''}` : null
      const metric = ctx.metrics[station]
      const countWords = metric && typeof metric.count === 'number' ? `${metric.count} open` : null
      return { kind: 'station', item, station, stationLabel: DAILYS_STATION_LABELS[station], satisfied: today, markedWords, countWords, nextLine: metric?.nextLine ?? null }
    }
    return { kind: 'tick', item, ticked, satisfied: ticked }
  })
}

/** The rows not yet satisfied: the station's count. */
export function dailysOpenCount(rows: ReadonlyArray<DailysRow>): number {
  return rows.filter((r) => !r.satisfied).length
}

/** The first row not yet satisfied and its verb, under the station's question. Null at zero. */
export function dailysNextLine(rows: ReadonlyArray<DailysRow>): string | null {
  const r = rows.find((x) => !x.satisfied)
  if (!r) return null
  if (r.kind === 'station') return `Mark ${r.stationLabel}${r.countWords ? ` · ${r.countWords}` : ''}`
  if (r.kind === 'time-off') {
    const first = r.people[0]
    const more = r.people.length - 1
    return first ? `Tell the lead · ${first.words}${more > 0 ? ` · +${more} more` : ''}` : 'Tell the lead about time off'
  }
  return `Tick “${r.item.label}”`
}

/** What the Mark saves when nobody typed: every row's state in a few words, or null with no rows. */
export function dailysMarkNote(rows: ReadonlyArray<DailysRow>): string | null {
  if (rows.length === 0) return null
  return rows
    .map((r) => {
      if (r.kind === 'station') return `${r.stationLabel} ${r.satisfied ? r.markedWords ?? 'marked today' : 'not marked'}${r.countWords ? ` (${r.countWords})` : ''}`
      if (r.kind === 'time-off') {
        const n = r.people.length
        if (n === 0) return 'no time off coming up'
        return `time off: ${n === 1 ? '1 person' : `${n} people`} in the next ${DAILYS_TIME_OFF_WINDOW_DAYS} days, ${r.ticked ? 'told' : 'not told yet'}`
      }
      return `${r.item.label}: ${r.ticked ? 'done' : 'open'}`
    })
    .join(' · ')
}
