import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { addDaysYmd, formatDayLabel, isWorkdayYmd } from './markHistory'
import { roundCloseSheet, type RoundCloseEvent } from './roundClose'

/**
 * The office's round as ten workday columns (punch list #217, office-5, a prototype). The
 * Dashboard card read ten days of `quickfill_section_mark_events` and said one verdict over them:
 * *No round Thu, Oct 29*, or *23 stations*. A day with one stamp read as a round the same as a
 * day with all 23, and a miss was a word, not a gap in a row of days, so the owner could not see
 * a pattern — every Thursday, or every day short. The owner, 2026-10-30: "This could potentially
 * work, I would like to see it as a prototype."
 *
 * This kernel turns the same events into the strip: one column a workday for the last ten, its
 * height the stations marked that day out of the stations the round visits, a missed workday an
 * empty red ring, today's column filling as the round runs. The card draws it; nothing here
 * touches the network. Days are the company calendar (`calendarYmdInAppTzFromIso`). Pure.
 */

export const ROUND_COLUMNS_DAYS = 10
/** Calendar days of events the card reads: two weeks hold ten workdays and the weekends between them. */
export const ROUND_COLUMNS_READ_DAYS = 14

export type RoundColumn = {
  ymd: string
  /** Stations marked that day, each once. */
  marked: number
  /** The stations the round visits: every station marked in the strip's window, each once. */
  total: number
  /** `marked / total`, 0 to 1; 0 when nothing was marked. The column's height. */
  fraction: number
  /** The day's last mark, *9:51 AM*; null with no mark. */
  at: string | null
  /** Whoever pressed most that day; null with no mark. */
  who: string | null
  /** Worked and still open at the day's last press per station. */
  open: number
  /** Handed up as a question. */
  questions: number
  /** A workday that passed with no mark at all. Today is never a miss while it runs. */
  miss: boolean
  today: boolean
}

export type RoundColumnLabelKind = 'first' | 'friday' | 'miss' | 'today'

export type RoundColumnLabel = {
  /** The column the label sits under. */
  index: number
  text: string
  kind: RoundColumnLabelKind
  /** The first label hangs from the strip's left edge, the last from its right; the rest centre on their column. */
  align: 'left' | 'center' | 'right'
}

export type RoundColumns = {
  /** Oldest first. The last is today on a workday, else the last workday before it. */
  columns: RoundColumn[]
  total: number
  /** Days a round ran, today left out. */
  ran: number
  /** Workdays that passed with no mark. */
  missed: number
  labels: RoundColumnLabel[]
  /** The strip in a few plain sentences, for its hover and the screen reader. */
  words: string
}

/** The last `days` workdays ending on `todayYmd` when it is a workday, else on the workday before it; oldest first. */
export function roundColumnDays(todayYmd: string, days: number = ROUND_COLUMNS_DAYS): string[] {
  const out: string[] = []
  let d = todayYmd
  while (!isWorkdayYmd(d)) d = addDaysYmd(d, -1)
  while (out.length < days) {
    if (isWorkdayYmd(d)) out.unshift(d)
    d = addDaysYmd(d, -1)
  }
  return out
}

/** *Thu 29*: the weekday and the day of the month, for a label that has little room. */
export function shortDayLabel(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ymd
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}`
}

function dowOf(ymd: string): number {
  return new Date(ymd + 'T00:00:00').getDay()
}

/**
 * The labels under the strip: the first day in full, each Friday after it as *Fri 23*, each miss
 * as *Thu 29 · no round*, and *today*. Two labels never sit on neighbouring columns, so none
 * overprints another on a phone: the first day and a miss outrank *today*, which outranks a
 * Friday, and the lesser label gives way. Today's column still shows itself by its wash and its
 * colour, and its hover says *Today*.
 */
export function roundColumnLabels(columns: ReadonlyArray<RoundColumn>): RoundColumnLabel[] {
  const n = columns.length
  if (n === 0) return []
  const align = (i: number): RoundColumnLabel['align'] => (i === 0 ? 'left' : i === n - 1 ? 'right' : 'center')
  const wanted: RoundColumnLabel[] = []
  columns.forEach((c, i) => {
    if (i === 0) wanted.push({ index: 0, text: formatDayLabel(c.ymd), kind: 'first', align: 'left' })
    else if (c.miss) wanted.push({ index: i, text: `${shortDayLabel(c.ymd)} · no round`, kind: 'miss', align: align(i) })
    else if (c.today) wanted.push({ index: i, text: 'today', kind: 'today', align: align(i) })
    else if (dowOf(c.ymd) === 5) wanted.push({ index: i, text: shortDayLabel(c.ymd), kind: 'friday', align: align(i) })
  })
  const rank: Record<RoundColumnLabelKind, number> = { first: 0, miss: 1, today: 2, friday: 3 }
  const kept: RoundColumnLabel[] = []
  for (const l of [...wanted].sort((a, b) => rank[a.kind] - rank[b.kind] || a.index - b.index)) {
    if (kept.some((k) => Math.abs(k.index - l.index) === 1)) continue
    kept.push(l)
  }
  return kept.sort((a, b) => a.index - b.index)
}

function plural(n: number, one: string, many: string = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** The strip in a few plain sentences: the span, the rounds that ran, the misses by day, today so far. */
export function roundColumnsWords(columns: ReadonlyArray<RoundColumn>, ran: number, missed: number, total: number): string {
  if (columns.length === 0) return 'No workdays to draw.'
  const first = columns[0]!
  const last = columns[columns.length - 1]!
  const past = columns.filter((c) => !c.today)
  const parts: string[] = []
  parts.push(`${plural(columns.length, 'workday')}, ${formatDayLabel(first.ymd)} to ${last.today ? 'today' : formatDayLabel(last.ymd)}.`)
  if (total === 0) parts.push('No round ran in these days.')
  else {
    parts.push(`The round ran on ${plural(ran, 'day')} of ${past.length}.`)
    const misses = past.filter((c) => c.miss)
    if (misses.length) parts.push(`${missed === 1 ? 'Missed' : 'Missed on'} ${misses.map((c) => formatDayLabel(c.ymd)).join(', ')}.`)
  }
  if (last.today) parts.push(last.marked > 0 ? `Today ${last.marked} of ${total} stations so far.` : 'No round yet today.')
  return parts.join(' ')
}

/**
 * The columns from the events (any order, any span that covers the window): one a workday for
 * the last `days`, the stations the round visits counted once across the window, each day's
 * sheet from `roundCloseSheet`. Events outside the window are left out.
 */
export function roundColumns(events: ReadonlyArray<RoundCloseEvent>, todayYmd: string, days: number = ROUND_COLUMNS_DAYS): RoundColumns {
  const ymds = roundColumnDays(todayYmd, days)
  const first = ymds[0] ?? todayYmd
  const last = ymds[ymds.length - 1] ?? todayYmd
  const inWindow = events.filter((e) => {
    const d = calendarYmdInAppTzFromIso(e.marked_at)
    return d !== '' && d >= first && d <= last
  })
  const total = new Set(inWindow.map((e) => e.section_id)).size
  let ran = 0
  let missed = 0
  const columns: RoundColumn[] = ymds.map((ymd) => {
    const sheet = roundCloseSheet(inWindow, ymd, (id) => id)
    const today = ymd === todayYmd
    const marked = sheet.stations
    const miss = !today && marked === 0
    if (!today && marked > 0) ran++
    if (miss) missed++
    return {
      ymd,
      marked,
      total,
      fraction: total > 0 ? marked / total : 0,
      at: sheet.at,
      who: sheet.who,
      open: sheet.open.length,
      questions: sheet.questions.length,
      miss,
      today,
    }
  })
  return { columns, total, ran, missed, labels: roundColumnLabels(columns), words: roundColumnsWords(columns, ran, missed, total) }
}

/** The words a column shows on hover: *Tue, Oct 27 · 9:40 AM · Dana · 21 of 23*, *Thu, Oct 29 · no round*, *Today · 9:51 AM · Dana · 9 of 23 so far*. */
export function roundColumnTitle(c: RoundColumn): string {
  const day = c.today ? 'Today' : formatDayLabel(c.ymd)
  if (c.marked === 0) return c.today ? `${day} · no round yet` : `${day} · no round`
  const parts = [day]
  if (c.at) parts.push(c.at)
  if (c.who) parts.push(c.who)
  parts.push(`${c.marked} of ${c.total}${c.today ? ' so far' : ''}`)
  return parts.join(' · ')
}

/**
 * The muted line under the strip, the old headline without its counts (the chips carry those):
 * *Today 9:51 AM · Dana · 9 of 23 stations*, *No round yet today · Thu, Oct 29 9:51 AM · 23 stations*,
 * *The round did not run Thu, Oct 29. The last round ran Wed, Oct 28 at 9:40 AM.*, or on a weekend
 * *Last round Fri, Oct 30 9:51 AM · 23 stations*.
 */
export function roundColumnsLine(cols: RoundColumns, todayYmd: string): string {
  const { columns } = cols
  if (columns.length === 0) return ''
  const last = columns[columns.length - 1]!
  const weekend = !isWorkdayYmd(todayYmd)
  if (last.today && last.marked > 0) {
    const parts = [`Today ${last.at ?? ''}`.trim()]
    if (last.who) parts.push(last.who)
    parts.push(`${last.marked} of ${last.total} ${last.total === 1 ? 'station' : 'stations'}`)
    if (last.open === 0 && last.questions === 0) parts.push('every station clean')
    return parts.join(' · ')
  }
  const previous = last.today ? columns[columns.length - 2] : last
  if (!previous) return weekend ? '' : 'No round yet today'
  if (previous.marked > 0) {
    const ran = `${formatDayLabel(previous.ymd)} ${previous.at ?? ''}`.trim() + ` · ${plural(previous.marked, 'station')}`
    return weekend ? `Last round ${ran}` : `No round yet today · ${ran}`
  }
  const lastRan = [...columns].reverse().find((c) => !c.today && c.marked > 0)
  const missWords = `The round did not run ${formatDayLabel(previous.ymd)}.`
  return lastRan ? `${missWords} The last round ran ${formatDayLabel(lastRan.ymd)}${lastRan.at ? ` at ${lastRan.at}` : ''}.` : `${missWords} No round ran in these ${plural(columns.length, 'workday')}.`
}

/** The chip's words: *still open 8*, *questions 2*; '' at zero, so no dead chip is drawn. */
export function roundCountChipWords(kind: 'open' | 'questions', n: number): string {
  if (n <= 0) return ''
  return kind === 'open' ? `still open ${n}` : `${n === 1 ? 'question' : 'questions'} ${n}`
}
