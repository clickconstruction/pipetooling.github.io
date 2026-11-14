/**
 * The lien month as one line (punch list #352, PR 2).
 *
 * On a computer the month is a bar of five zones across the top of the Lien desk's first view. On a phone the five
 * zones stood one over the other as cards, 516 px before a row of work. There the month is one line that says the
 * day's headline, with the five zones a press away in a sheet. The headline is the zone today is in, said as what is
 * left to do: *9 liens to file*. The line under it places the day and names what slipped earlier in the month, so a
 * slip is never out of sight behind the fold.
 *
 * Pure: it reads the month `lienMonthRhythm.ts` built and returns words. It counts nothing itself.
 */
import { pluralNoun } from '../batchWords'
import type { LienNextUpRow } from './lienNextUp'
import { lienMonthZoneHasRow, lienMonthZoneLine, type LienMonth, type LienMonthZone, type LienMonthZoneKey, type LienMonthZoneState } from './lienMonthRhythm'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The three working zones: what one piece of their work is called, and what is done to it. */
const WORK: Record<'reminders' | 'notices' | 'liens', { noun: readonly [string, string]; todo: string }> = {
  reminders: { noun: ['reminder', 'reminders'], todo: 'to send' },
  notices: { noun: ['notice', 'notices'], todo: 'to send' },
  liens: { noun: ['lien', 'liens'], todo: 'to file' },
}

/** Where in the month the day is, in two or three words. */
const WEEK: Record<LienMonthZoneKey, string> = {
  reminders: 'reminders week',
  notices: 'notices week',
  liens: 'liens week',
  catch_up: 'catch-up days',
  quiet: 'nothing scheduled',
}

export type LienMonthLineTone = 'now' | 'slipped' | 'done' | 'quiet'

export type LienMonthLineDue = {
  /** The earliest day a row of today's zone is due, as a civil date. */
  ymd: string
  /** Days from today to that day; negative when it has passed. */
  daysLeft: number
}

export type LienMonthLine = {
  /** The day's headline: what is left in the zone today is in. */
  head: string
  /** The month and the day, and where that falls in the rhythm. */
  sub: string
  /** What slipped in the zones the month has passed, as *8 slipped earlier*; empty when nothing did. Drawn in red. */
  slipWords: string
  /** The day the zone's first row is due and how long is left, when the desk knows it. */
  chip: { words: string; tone: 'red' | 'amber' | 'quiet' } | null
  tone: LienMonthLineTone
  /** The five zones as a strip, each as wide as its days. */
  segments: Array<{ key: LienMonthZoneKey; days: number; state: LienMonthZoneState; slipped: boolean }>
}

function monthName(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  return m ? MONTHS[Number(m[2]) - 1] ?? month : month
}

/** *Mon Nov 16* from a civil date. Read as UTC so no timezone moves the day. */
export function lienMonthDayWords(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return `${WEEKDAYS[d.getUTCDay()]} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`
}

function leftWords(daysLeft: number): string {
  if (daysLeft < 0) return `${-daysLeft} ${-daysLeft === 1 ? 'day' : 'days'} late`
  if (daysLeft === 0) return 'today'
  return `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`
}

/** What slipped in the zones the month has passed: Catch-up counts the same slips again, so it is left out. */
function slippedEarlier(month: LienMonth): number {
  return month.zones.filter((z) => z.state === 'behind' && z.key !== 'catch_up' && z.key !== 'quiet').reduce((sum, z) => sum + z.slipped, 0)
}

function headFor(zone: LienMonthZone): { head: string; tone: LienMonthLineTone } {
  if (zone.key === 'quiet') {
    const line = lienMonthZoneLine(zone)
    return { head: line.head === 'nothing queuing yet' ? 'Nothing scheduled' : `Next month: ${line.head}`, tone: 'quiet' }
  }
  if (zone.key === 'catch_up') {
    if (zone.left <= 0) return { head: 'Nothing slipped this month', tone: 'done' }
    return { head: `${zone.left} to catch up`, tone: 'slipped' }
  }
  const w = WORK[zone.key]
  if (zone.left > 0) return { head: `${zone.left} ${pluralNoun(w.noun, zone.left)} ${w.todo}`, tone: 'now' }
  // Nothing left in today's zone: say what went, in the zone's own words.
  const line = lienMonthZoneLine({ ...zone, state: 'behind' })
  return { head: `${zone.label}: ${line.head}`, tone: zone.slipped > 0 ? 'slipped' : 'done' }
}

export function lienMonthLine(month: LienMonth, due?: LienMonthLineDue | null): LienMonthLine {
  const zone = month.zones.find((z) => z.key === month.zone) ?? month.zones[0]
  const { head, tone } = zone ? headFor(zone) : { head: 'The lien month', tone: 'quiet' as const }
  const showDue = !!due && tone === 'now'
  const slipped = slippedEarlier(month)
  const sub = `${monthName(month.month)}, day ${month.today} · ${WEEK[month.zone]}`
  return {
    head: showDue ? `${head} by ${lienMonthDayWords(due.ymd)}` : head,
    sub,
    slipWords: slipped > 0 ? `${slipped} slipped earlier` : '',
    chip: showDue ? { words: leftWords(due.daysLeft), tone: due.daysLeft <= 3 ? 'red' : due.daysLeft <= 7 ? 'amber' : 'quiet' } : null,
    tone,
    segments: month.zones.map((z) => ({ key: z.key, days: Math.max(1, z.days), state: z.state, slipped: z.key !== 'quiet' && z.slipped > 0 && z.state !== 'ahead' })),
  }
}

/**
 * The earliest day a row of today's zone is due, from the rows the desk already holds. Null when the zone has no row
 * with a day: the line then says what is left and no more.
 */
export function lienMonthLineDue(month: LienMonth, rows: ReadonlyArray<Pick<LienNextUpRow, 'kind' | 'jobId' | 'action' | 'dueOn' | 'daysLeft'>>): LienMonthLineDue | null {
  const zone = month.zones.find((z) => z.key === month.zone)
  if (!zone) return null
  let first: LienMonthLineDue | null = null
  for (const row of rows) {
    if (!row.dueOn || row.daysLeft == null || !lienMonthZoneHasRow(zone, row)) continue
    if (!first || row.dueOn < first.ymd) first = { ymd: row.dueOn, daysLeft: row.daysLeft }
  }
  return first
}
