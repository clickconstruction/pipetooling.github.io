import { timelineDaysBetween, type LegalTimeline, type LegalTimelineItem } from './legalTimeline'

/**
 * The Legal desk's Timeline as a strip of days (v2.6107, punch list #214, PR 4): one column a day
 * from a little before the first entry to the last deadline in reach, today marked, each day's
 * items as dots — a filled dot for a done step, a ring for a planned one, a red ring for an
 * overdue one, a diamond for a lien-clock deadline, and small lane dots for what was said, done and
 * filed. Pure: it reads `buildLegalTimeline`'s items and returns cells; the panel draws them and a
 * press on a day scrolls the line to it.
 *
 * The window: from the earlier of the first item and two weeks before today, to the later of the
 * last item and two weeks after today — but never more than `STRIP_MAX_DAYS` from its start, and a
 * deadline more than a year out (the § 53.158 suit) never stretches it. A day holds at most
 * `STRIP_DOTS_PER_DAY` dots, the ones that matter first (overdue, a deadline, done, planned, then
 * the lanes), and says how many more it holds.
 */

export type StripDot = 'late' | 'deadline' | 'done' | 'planned' | 'did' | 'paper' | 'said'

export type StripDay = {
  ymd: string
  /** 0 Sunday … 6 Saturday. */
  dow: number
  weekend: boolean
  today: boolean
  /** The dots drawn, the ones that matter first, at most `STRIP_DOTS_PER_DAY`. */
  dots: StripDot[]
  /** Items on the day the dots do not show. */
  more: number
  /** How many items sit on the day, in all. */
  count: number
  /** The axis label under the day — the month and day on each Monday, and on a first of the month that no Monday crowds; '' otherwise. */
  label: string
}

export type LegalTimelineStrip = {
  startYmd: string
  endYmd: string
  days: StripDay[]
  /** The whole strip in one sentence, for the hover and the screen reader. */
  words: string
}

export const STRIP_MAX_DAYS = 120
export const STRIP_DOTS_PER_DAY = 4
const STRIP_PAD_DAYS = 14
const FAR_DEADLINE_DAYS = 365

const DOT_ORDER: ReadonlyArray<StripDot> = ['late', 'deadline', 'done', 'planned', 'did', 'paper', 'said']
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function addDays(ymd: string, n: number): string {
  const d = new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)) + n))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function dowOf(ymd: string): number {
  return new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))).getUTCDay()
}

/** The dot an item draws; null for an undone item, which left the record. */
export function stripDotOf(item: Pick<LegalTimelineItem, 'kind' | 'state' | 'lane' | 'voided'>): StripDot | null {
  if (item.voided || item.state === 'undone') return null
  if (item.state === 'overdue') return 'late'
  if (item.kind === 'deadline') return 'deadline'
  if (item.kind === 'plan') return item.state === 'done' ? 'done' : 'planned'
  if (item.kind === 'document') return 'paper'
  if (item.lane === 'said') return 'said'
  if (item.lane === 'paper') return 'paper'
  return 'did'
}

export function timelineStrip(t: Pick<LegalTimeline, 'past' | 'today' | 'upcoming'>, todayYmd: string): LegalTimelineStrip {
  const items = [...t.past, ...t.today, ...t.upcoming].filter((i) => stripDotOf(i) !== null)
  // A deadline a year or more out never stretches the window; it stays on the line below.
  const inReach = items.filter((i) => !(i.kind === 'deadline' && timelineDaysBetween(todayYmd, i.ymd) >= FAR_DEADLINE_DAYS))
  const ymds = inReach.map((i) => i.ymd).filter((y) => /^\d{4}-\d{2}-\d{2}$/.test(y)).sort()
  let startYmd = addDays(todayYmd, -STRIP_PAD_DAYS)
  let endYmd = addDays(todayYmd, STRIP_PAD_DAYS)
  if (ymds.length) {
    if (ymds[0]! < startYmd) startYmd = ymds[0]!
    if (ymds[ymds.length - 1]! > endYmd) endYmd = ymds[ymds.length - 1]!
  }
  if (timelineDaysBetween(startYmd, endYmd) + 1 > STRIP_MAX_DAYS) {
    // Too long to read as columns: keep today in view, the past trimmed first, then the far future.
    const afterToday = Math.min(timelineDaysBetween(todayYmd, endYmd), STRIP_MAX_DAYS - 1 - STRIP_PAD_DAYS)
    endYmd = addDays(todayYmd, Math.max(STRIP_PAD_DAYS, afterToday))
    startYmd = addDays(endYmd, -(STRIP_MAX_DAYS - 1))
  }
  const byDay = new Map<string, StripDot[]>()
  for (const i of inReach) {
    if (i.ymd < startYmd || i.ymd > endYmd) continue
    const dot = stripDotOf(i)
    if (!dot) continue
    const list = byDay.get(i.ymd) ?? []
    list.push(dot)
    byDay.set(i.ymd, list)
  }
  const days: StripDay[] = []
  let late = 0
  let deadlines = 0
  for (let ymd = startYmd; ymd <= endYmd; ymd = addDays(ymd, 1)) {
    const all = (byDay.get(ymd) ?? []).slice().sort((a, b) => DOT_ORDER.indexOf(a) - DOT_ORDER.indexOf(b))
    const dots = all.slice(0, STRIP_DOTS_PER_DAY)
    const dow = dowOf(ymd)
    const day = Number(ymd.slice(8, 10))
    late += all.filter((d) => d === 'late').length
    deadlines += all.filter((d) => d === 'deadline').length
    days.push({
      ymd,
      dow,
      weekend: dow === 0 || dow === 6,
      today: ymd === todayYmd,
      dots,
      more: all.length - dots.length,
      count: all.length,
      // Mondays carry the month; the first of a month only when no Monday sits within two days of it, so two labels never touch.
      label: dow === 1 || (day === 1 && (dow === 4 || dow === 5)) ? `${MONTH[Number(ymd.slice(5, 7)) - 1]} ${day}` : '',
    })
  }
  const spanWords = `${MONTH[Number(startYmd.slice(5, 7)) - 1]} ${Number(startYmd.slice(8, 10))} to ${MONTH[Number(endYmd.slice(5, 7)) - 1]} ${Number(endYmd.slice(8, 10))}`
  const parts = [`${days.length} days, ${spanWords}, one column a day.`]
  if (late) parts.push(`${late} overdue step${late === 1 ? '' : 's'} as red rings.`)
  if (deadlines) parts.push(`${deadlines} lien-clock deadline${deadlines === 1 ? '' : 's'} as diamonds.`)
  parts.push('Press a day to jump to it.')
  return { startYmd, endYmd, days, words: parts.join(' ') }
}

export type TimelineCountChip = { key: 'planned' | 'overdue' | 'dueToday' | 'done' | 'deadlines'; text: string; tone: 'neutral' | 'stop' | 'warn' | 'ok' }

/** The header's counts as chips with numbers (v2.6107): what they are, in the order the line reads them. Nothing for a zero. */
export function timelineCountChips(c: LegalTimeline['counts']): TimelineCountChip[] {
  const out: TimelineCountChip[] = []
  if (c.planned) out.push({ key: 'planned', text: `planned ${c.planned}`, tone: 'neutral' })
  if (c.overdue) out.push({ key: 'overdue', text: `overdue ${c.overdue}`, tone: 'stop' })
  if (c.dueToday) out.push({ key: 'dueToday', text: `due today ${c.dueToday}`, tone: 'warn' })
  if (c.done) out.push({ key: 'done', text: `done ${c.done}`, tone: 'ok' })
  if (c.deadlines) out.push({ key: 'deadlines', text: `◆ deadlines ${c.deadlines}`, tone: 'warn' })
  return out
}
