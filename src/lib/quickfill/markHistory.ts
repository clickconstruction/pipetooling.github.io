/**
 * Quickfill's Mark history window (punch list #156): the pure shaping of one station's
 * `quickfill_section_mark_events` into the checklist ledger's grammar — three tiles, one
 * cell a day for the last weeks with the open count in the cell, the habit line (who marks
 * it, the usual hour) and, for a station with boxes, the band of the boxes' own ticks.
 * Days are the company calendar (`calendarYmdInAppTzFromIso`); due days follow the
 * station's own rhythm (`sectionRhythmDays`, the rule the strip colours by). The window
 * fetches, this shapes; nothing here touches the network.
 */
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

export type MarkHistoryEvent = {
  id: string
  marked_at: string
  outstanding_count: number | null
  note_text: string | null
  marked_by: string | null
  marked_by_name: string | null
}

/** `marked` a day with a mark · `gap` a due workday with no mark (a dashed box) · `off` no box: a weekend, a day before the station's first mark, a day after today, or a day the rhythm did not expect. */
export type MarkHistoryCellKind = 'marked' | 'gap' | 'off'
/** `none` nothing open at the mark · `some` something open · `many` more than the station's usual (the third tint, off by default) · `tick` the station has no count. */
export type MarkHistoryTint = 'none' | 'some' | 'many' | 'tick'

export type MarkHistoryCell = {
  ymd: string
  kind: MarkHistoryCellKind
  today: boolean
  /** A workday the station's rhythm expected a look on. The tiles count these. */
  due: boolean
  /** The open count of the day's last mark; null when the station has no count or the day has no mark. */
  count: number | null
  tint: MarkHistoryTint | null
  who: string | null
  /** The `marked_at` of the day's last mark. */
  at: string | null
  /** How many marks landed that day. */
  marks: number
}

export type MarkHistoryWeek = {
  mondayYmd: string
  /** The short month, on the first week of a month only ("Sep"); null otherwise. */
  month: string | null
  cells: MarkHistoryCell[]
}

export const MARK_HISTORY_WEEKS = 8
export const MARK_HISTORY_BOX_WEEKS = 4
export const MARK_HISTORY_RECENT_DAYS = 7

const DAY_MS = 86_400_000

function parseYmd(ymd: string): Date {
  return new Date(ymd + 'T00:00:00')
}

function fmtYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = parseYmd(ymd)
  d.setDate(d.getDate() + days)
  return fmtYmd(d)
}

/** Whole days from `a` to `b` (both YYYY-MM-DD), timezone-inert. */
export function daysBetweenYmd(a: string, b: string): number {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / DAY_MS)
}

export function isWorkdayYmd(ymd: string): boolean {
  const dow = parseYmd(ymd).getDay()
  return dow >= 1 && dow <= 5
}

/** Workdays after `a` up to and including `b`: Friday to Monday is 1, Thursday to Friday is 1. */
export function workdaysBetweenYmd(a: string, b: string): number {
  let n = 0
  let d = a
  while (d < b) {
    d = addDaysYmd(d, 1)
    if (isWorkdayYmd(d)) n++
  }
  return n
}

export const MARK_HISTORY_RHYTHM_WINDOW = 5
export const MARK_HISTORY_RHYTHM_MIN_DAYS = 3

/**
 * The station's rhythm in workdays: the median workday gap between its last five marked
 * days, rounded down, at least one. The strip's own idea (`sectionRhythmDays` in round.ts)
 * in the grid's unit, since the grid never draws a weekend as due; rounded down rather
 * than to the nearest, so a missed day in the last five never hides itself by slowing the
 * rhythm. One under three marked days.
 */
export function markHistoryRhythmWorkdays(markedDaysSorted: ReadonlyArray<string>): number {
  const last = markedDaysSorted.slice(-MARK_HISTORY_RHYTHM_WINDOW)
  if (last.length < MARK_HISTORY_RHYTHM_MIN_DAYS) return 1
  const gaps: number[] = []
  for (let i = 1; i < last.length; i++) gaps.push(workdaysBetweenYmd(last[i - 1]!, last[i]!))
  const m = median(gaps) ?? 1
  return Math.max(1, Math.floor(m))
}

/** The Monday on or before the day. */
export function mondayOnOrBefore(ymd: string): string {
  const d = parseYmd(ymd)
  const dow = d.getDay()
  return addDaysYmd(ymd, dow === 0 ? -6 : 1 - dow)
}

/** The company-calendar day a mark belongs to; '' for a bad timestamp. */
export function markHistoryDayKey(markedAtIso: string): string {
  return calendarYmdInAppTzFromIso(markedAtIso)
}

/** The hour of day of a mark in the company's time zone, as a decimal (9:30 AM → 9.5); null for a bad timestamp. */
export function markHistoryHour(markedAtIso: string): number | null {
  const d = new Date(markedAtIso)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(d)
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? NaN)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? NaN)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h + m / 60
}

/** "9:40 AM" for a decimal hour. */
export function formatHourLabel(hour: number): string {
  const total = Math.round(hour * 60)
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

/** "9:37 AM" for a mark's timestamp, in the company's time zone. */
export function formatMarkTime(markedAtIso: string): string {
  const d = new Date(markedAtIso)
  if (Number.isNaN(d.getTime())) return markedAtIso
  return d.toLocaleTimeString('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', minute: '2-digit' })
}

/** "Tue, Oct 20" for a day. */
export function formatDayLabel(ymd: string): string {
  const d = parseYmd(ymd)
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/** The station's usual count: the median of the counted marks given (the window's). Null with none. */
export function markHistoryUsual(events: ReadonlyArray<MarkHistoryEvent>): number | null {
  return median(events.map((e) => e.outstanding_count).filter((n): n is number => typeof n === 'number'))
}

/** The tint of a cell for its count. The third tint, `many`, only when asked for and the count is above the usual. */
export function markHistoryTint(count: number | null, usual: number | null, thirdTint: boolean): MarkHistoryTint {
  if (count == null) return 'tick'
  if (count <= 0) return 'none'
  if (thirdTint && usual != null && count > usual) return 'many'
  return 'some'
}

/** Events keyed by their company-calendar day, each day's marks oldest first. Bad timestamps are left out. */
function eventsByDay(events: ReadonlyArray<MarkHistoryEvent>): Map<string, MarkHistoryEvent[]> {
  const byDay = new Map<string, MarkHistoryEvent[]>()
  for (const e of events) {
    const ymd = markHistoryDayKey(e.marked_at)
    if (!ymd) continue
    const list = byDay.get(ymd)
    if (list) list.push(e)
    else byDay.set(ymd, [e])
  }
  for (const list of byDay.values()) list.sort((a, b) => a.marked_at.localeCompare(b.marked_at))
  return byDay
}

/**
 * The weeks grid: `weeks` rows ending on the week that holds `todayYmd`, Monday to Sunday,
 * oldest week first. A day with a mark is `marked` (its last mark's count, who and time;
 * `marks` says how many). A workday the rhythm expected a look on, with no mark, is a `gap`.
 * Everything else is `off`: weekends, days before the station's first mark ever (`events`
 * should be the station's whole history, so the birth is known), days after today, and days
 * the rhythm did not expect. The rhythm is `markHistoryRhythmWorkdays`: a workday is due
 * when the station's last marked day before it is that many workdays back or more, and it
 * stays due until a mark lands.
 */
export function markHistoryWeeks(
  events: ReadonlyArray<MarkHistoryEvent>,
  todayYmd: string,
  options: { weeks?: number; usual?: number | null; thirdTint?: boolean } = {},
): MarkHistoryWeek[] {
  const weeks = options.weeks ?? MARK_HISTORY_WEEKS
  const thirdTint = options.thirdTint ?? false
  const byDay = eventsByDay(events)
  const markedDays = [...byDay.keys()].sort()
  const birth = markedDays[0] ?? null
  const rhythm = markHistoryRhythmWorkdays(markedDays)
  const lastMonday = mondayOnOrBefore(todayYmd)
  const firstMonday = addDaysYmd(lastMonday, -7 * (weeks - 1))
  const windowEvents = events.filter((e) => {
    const ymd = markHistoryDayKey(e.marked_at)
    return ymd >= firstMonday && ymd <= todayYmd
  })
  const usual = options.usual === undefined ? markHistoryUsual(windowEvents) : options.usual

  const out: MarkHistoryWeek[] = []
  let lastMonth: string | null = null
  let monday = firstMonday
  for (let w = 0; w < weeks; w++) {
    const month = parseYmd(monday).toLocaleDateString('en-US', { month: 'short' })
    const cells: MarkHistoryCell[] = []
    for (let i = 0; i < 7; i++) {
      const ymd = addDaysYmd(monday, i)
      const dayEvents = byDay.get(ymd) ?? []
      const last = dayEvents[dayEvents.length - 1]
      const today = ymd === todayYmd
      const beforeBirth = birth == null || ymd < birth
      let due = false
      if (!beforeBirth && ymd <= todayYmd && isWorkdayYmd(ymd)) {
        // The last marked day strictly before this one.
        let prev: string | null = null
        for (let k = markedDays.length - 1; k >= 0; k--) {
          const d = markedDays[k]!
          if (d < ymd) {
            prev = d
            break
          }
        }
        due = prev != null ? workdaysBetweenYmd(prev, ymd) >= rhythm : false
      }
      if (last) {
        cells.push({
          ymd,
          kind: 'marked',
          today,
          due,
          count: last.outstanding_count,
          tint: markHistoryTint(last.outstanding_count, usual, thirdTint),
          who: last.marked_by_name,
          at: last.marked_at,
          marks: dayEvents.length,
        })
      } else {
        cells.push({ ymd, kind: due ? 'gap' : 'off', today, due, count: null, tint: null, who: null, at: null, marks: 0 })
      }
    }
    out.push({ mondayYmd: monday, month: month === lastMonth ? null : month, cells })
    lastMonth = month
    monday = addDaysYmd(monday, 7)
  }
  return out
}

export type MarkHistoryTiles = {
  /** Looks this week against the days the rhythm expected (a look on a day it did not expect counts in both). */
  thisWeek: { marked: number; due: number }
  /** Due days in a row with a look, walking back from today; an unfinished today never breaks it. */
  streak: number
  /** Due days with no look in the window, today left out. */
  missed: number
  /** Days in the window a look was expected on or landed on, today left out. */
  due: number
}

export function markHistoryTiles(weeks: ReadonlyArray<MarkHistoryWeek>, todayYmd: string): MarkHistoryTiles {
  const cells = weeks.flatMap((w) => w.cells).filter((c) => c.ymd <= todayYmd)
  const thisMonday = mondayOnOrBefore(todayYmd)
  let weekMarked = 0
  let weekDue = 0
  let missed = 0
  let due = 0
  for (const c of cells) {
    const expected = c.due || c.kind === 'marked'
    if (c.ymd >= thisMonday) {
      if (c.kind === 'marked') weekMarked++
      if (expected) weekDue++
    }
    if (c.today) continue
    if (expected) due++
    if (c.kind === 'gap') missed++
  }
  let streak = 0
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i]!
    if (c.kind === 'marked') {
      streak++
      continue
    }
    if (c.kind === 'gap') {
      if (c.today) continue
      break
    }
  }
  return { thisWeek: { marked: weekMarked, due: weekDue }, streak, missed, due }
}

export type MarkHistoryHabit = {
  people: Array<{ name: string; count: number }>
  /** Each mark's hour of day, a decimal, for the hour band. */
  hours: number[]
  medianHour: number | null
  /** The 25th and 75th percentile hours, for the band's shaded middle. */
  middleHalf: [number, number] | null
  /** "Dana marked it 34 times and Marisol 3 times. The usual time is about 9:40 AM." */
  sentence: string
  /** "Nothing open at 28 of 37 looks. Lately about 1 open at a look, down from about 3." or "Something was open at every one of the 38 looks. About 1 open at a look, as before." */
  countSentence: string
}

function nameOf(e: MarkHistoryEvent): string {
  return (e.marked_by_name ?? '').trim() || 'Someone'
}

function timesWord(n: number): string {
  return n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`
}

/** The habit line over the marks given (the window's): who, the hours, the count's drift. */
export function markHistoryHabit(events: ReadonlyArray<MarkHistoryEvent>): MarkHistoryHabit {
  const sorted = [...events].sort((a, b) => a.marked_at.localeCompare(b.marked_at))
  const counts = new Map<string, number>()
  for (const e of sorted) counts.set(nameOf(e), (counts.get(nameOf(e)) ?? 0) + 1)
  const people = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  const hours = sorted.map((e) => markHistoryHour(e.marked_at)).filter((h): h is number => h != null)
  const sortedHours = [...hours].sort((a, b) => a - b)
  const medianHour = median(hours)
  const middleHalf: [number, number] | null =
    sortedHours.length >= 4 ? [sortedHours[Math.floor(sortedHours.length * 0.25)]!, sortedHours[Math.floor(sortedHours.length * 0.75)]!] : null

  let sentence: string
  if (people.length === 0) sentence = 'No marks in these weeks.'
  else {
    const first = people[0]!
    const rest = people.slice(1)
    let who = `${first.name} marked it ${timesWord(first.count)}`
    if (rest.length === 1) who += ` and ${rest[0]!.name} ${timesWord(rest[0]!.count)}`
    else if (rest.length > 1) who += `, ` + rest.map((p) => `${p.name} ${timesWord(p.count)}`).join(', ')
    sentence = `${who}.`
    if (medianHour != null) sentence += ` The usual time is about ${formatHourLabel(medianHour)}.`
  }

  const counted = sorted.filter((e) => typeof e.outstanding_count === 'number')
  let countSentence: string
  if (sorted.length === 0) countSentence = ''
  else if (counted.length === 0) countSentence = 'This station has no count. A mark is a look.'
  else {
    const zero = counted.filter((e) => e.outstanding_count === 0).length
    const looks = counted.length
    if (zero === looks) countSentence = `Nothing was open at any of the ${looks} looks.`
    else {
      countSentence = zero === 0 ? `Something was open at every one of the ${looks} looks.` : `Nothing open at ${zero} of ${looks} looks.`
      const half = Math.floor(looks / 2)
      if (half >= 2) {
        const avg = (list: MarkHistoryEvent[]) => list.reduce((s, e) => s + (e.outstanding_count ?? 0), 0) / list.length
        const early = Math.round(avg(counted.slice(0, half)))
        const late = Math.round(avg(counted.slice(looks - half)))
        if (late < early) countSentence += ` Lately about ${late} open at a look, down from about ${early}.`
        else if (late > early) countSentence += ` Lately about ${late} open at a look, up from about ${early}.`
        else if (late > 0) countSentence += ` About ${late} open at a look, as before.`
      }
    }
  }
  return { people, hours, medianHour, middleHalf, sentence, countSentence }
}

/** The rows under the grid: the last seven days and the rest, newest first. */
export function markHistoryRows(events: ReadonlyArray<MarkHistoryEvent>, todayYmd: string): { recent: MarkHistoryEvent[]; older: MarkHistoryEvent[] } {
  const cutoff = addDaysYmd(todayYmd, -(MARK_HISTORY_RECENT_DAYS - 1))
  const sorted = [...events].sort((a, b) => b.marked_at.localeCompare(a.marked_at))
  const recent: MarkHistoryEvent[] = []
  const older: MarkHistoryEvent[] = []
  for (const e of sorted) {
    const ymd = markHistoryDayKey(e.marked_at)
    if (ymd && ymd >= cutoff) recent.push(e)
    else older.push(e)
  }
  return { recent, older }
}

/** Whether the Note column is drawn: only when a mark carries a note. */
export function markHistoryHasNotes(events: ReadonlyArray<MarkHistoryEvent>): boolean {
  return events.some((e) => (e.note_text ?? '').trim() !== '')
}

/** "Tue, Oct 20 · 9:37 AM · Dana · 3 open", the words a cell shows on hover or a tap. */
export function markHistoryCellTitle(cell: MarkHistoryCell): string {
  const day = formatDayLabel(cell.ymd)
  if (cell.kind === 'marked' && cell.at) {
    const parts = [day, formatMarkTime(cell.at), cell.who ?? 'Someone']
    if (cell.count != null) parts.push(`${cell.count} open`)
    if (cell.marks > 1) parts.push(`${cell.marks} marks that day`)
    return parts.join(' · ')
  }
  if (cell.kind === 'gap') return `${day} · no mark`
  return day
}

// ---------------------------------------------------------------------------
// The boxes band: the stations whose boxes write a row a tick (who and when).
// ---------------------------------------------------------------------------

export type MarkHistoryBoxSource = {
  /** The daily-checks table: `(item_id, work_date, checked_at, checked_by)`. */
  table: string
  /** The labels: an `app_settings` key holding JSON `[{ id, label }]`, or a table whose rows are the items. */
  items: { kind: 'app_settings'; key: string } | { kind: 'table'; table: string; labelColumn: string }
}

/** Which stations keep their boxes' ticks, and where. Office Leaving keeps none (a done map in app_settings). */
export const MARK_HISTORY_BOX_SOURCES: Readonly<Record<string, MarkHistoryBoxSource>> = {
  'office-arriving': { table: 'quickfill_office_arriving_daily_checks', items: { kind: 'app_settings', key: 'quickfill_office_arriving_items' } },
  'assistant-dailys': { table: 'quickfill_assistant_dailys_daily_checks', items: { kind: 'app_settings', key: 'quickfill_assistant_dailys_items' } },
  'difficult-people': { table: 'quickfill_difficult_people_daily_checks', items: { kind: 'table', table: 'quickfill_difficult_people_items', labelColumn: 'action_text' } },
}

export type MarkHistoryBoxItem = { id: string; label: string }
export type MarkHistoryTick = { item_id: string; work_date: string; checked_at: string; checked_by_name: string | null }

export type MarkHistoryBoxCell = {
  ymd: string
  on: boolean
  at: string | null
  who: string | null
  /** The station was marked that day. */
  marked: boolean
  /** Before the box's first tick on record: drawn as no box and not counted against it. */
  before: boolean
}
export type MarkHistoryBoxRow = {
  id: string
  label: string
  cells: MarkHistoryBoxCell[]
  ticked: number
  due: number
  /** Ticked on fewer than half the due days. */
  low: boolean
  /** The box's first tick on record when it falls inside the band, the day it is counted from; null otherwise. */
  since: string | null
}
export type MarkHistoryBoxes = {
  rows: MarkHistoryBoxRow[]
  /** The workdays the band covers, oldest first. */
  days: string[]
  leftUnticked: Array<{ label: string; unticked: number; due: number }>
  tickedBy: string | null
  /** "Dana ticks the boxes." */
  sentence: string
  /** "Left unticked most days: Trash out when leaving, 18 of 20." or '' */
  leftSentence: string
  /** "2 boxes count from their first tick on Fri, Oct 23." or '' */
  newerSentence: string
}

/** The items as `app_settings` stores them: JSON `[{ id, label }]`; anything else is an empty list. */
export function parseMarkHistoryBoxItems(raw: string | null | undefined): MarkHistoryBoxItem[] {
  if (raw == null || raw === '') return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: MarkHistoryBoxItem[] = []
    for (const x of parsed) {
      if (x == null || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      const id = typeof o.id === 'string' ? o.id : ''
      const label = typeof o.label === 'string' ? o.label.trim() : ''
      if (id && label) out.push({ id, label })
    }
    return out
  } catch {
    return []
  }
}

/**
 * The boxes band over the last `boxWeeks` weeks of the grid: one row a box, one cell a
 * workday the station was marked on or the rhythm expected (`due`), on when a tick row
 * exists for that box and day. Ticks are keyed on `work_date` as the page wrote it, never
 * recomputed from `checked_at`.
 *
 * Each box is measured from its first tick on record (`firstTickByItem`, from the box's
 * whole history), as the checklist grid starts a task at its birthday: the boxes' labels
 * carry no creation day, so a box added later has no ticks before it. Until v2.5829 removing a
 * box also deleted every tick it had, and rewording meant removing and adding, so some boxes
 * have no past before that; since then a box is reworded in place and removal keeps its rows.
 * The days before its first tick draw no box and are not counted against it. A box with no
 * tick on record is measured over every day.
 */
export function markHistoryBoxes(
  items: ReadonlyArray<MarkHistoryBoxItem>,
  ticks: ReadonlyArray<MarkHistoryTick>,
  weeks: ReadonlyArray<MarkHistoryWeek>,
  boxWeeks: number = MARK_HISTORY_BOX_WEEKS,
  firstTickByItem: Readonly<Record<string, string>> = {},
): MarkHistoryBoxes {
  const tail = weeks.slice(Math.max(0, weeks.length - boxWeeks))
  const dayCells = tail.flatMap((w) => w.cells).filter((c) => c.due || c.kind === 'marked')
  const days = dayCells.map((c) => c.ymd)
  const byKey = new Map<string, MarkHistoryTick>()
  for (const t of ticks) byKey.set(`${t.item_id}|${t.work_date}`, t)
  const who = new Map<string, number>()
  const rows: MarkHistoryBoxRow[] = items.map((item) => {
    const first = firstTickByItem[item.id] ?? null
    let ticked = 0
    let due = 0
    const cells = dayCells.map((c) => {
      const t = byKey.get(`${item.id}|${c.ymd}`)
      if (t) {
        ticked++
        const name = (t.checked_by_name ?? '').trim() || 'Someone'
        who.set(name, (who.get(name) ?? 0) + 1)
      }
      const before = !t && first != null && c.ymd < first
      if (!before) due++
      return { ymd: c.ymd, on: !!t, at: t?.checked_at ?? null, who: t ? (t.checked_by_name ?? '').trim() || 'Someone' : null, marked: c.kind === 'marked', before }
    })
    const since = first != null && days.length > 0 && first > days[0]! ? first : null
    return { id: item.id, label: item.label, cells, ticked, due, low: due > 0 && ticked < due / 2, since }
  })
  const leftUnticked = rows.filter((r) => r.low).map((r) => ({ label: r.label, unticked: r.due - r.ticked, due: r.due }))
  const tickedBy = [...who.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
  const sentence = tickedBy ? `${tickedBy} ticks the boxes.` : rows.length === 0 ? 'This station has no boxes.' : 'No box was ticked in these weeks.'
  const leftSentence = leftUnticked.length > 0 ? `Left unticked most days: ${leftUnticked.map((l) => `${l.label}, ${l.unticked} of ${l.due}`).join(' and ')}.` : ''
  const newer = rows.map((r) => r.since).filter((d): d is string => d != null)
  const newerDays = [...new Set(newer)].sort()
  let newerSentence = ''
  if (newer.length === 1) newerSentence = `One box counts from its first tick on ${formatDayLabel(newer[0]!)}.`
  else if (newer.length > 1 && newerDays.length === 1) newerSentence = `${newer.length} boxes count from their first tick on ${formatDayLabel(newerDays[0]!)}.`
  else if (newer.length > 1) newerSentence = `${newer.length} boxes count from their first tick, the first on ${formatDayLabel(newerDays[0]!)}.`
  return { rows, days, leftUnticked, tickedBy, sentence, leftSentence, newerSentence }
}
