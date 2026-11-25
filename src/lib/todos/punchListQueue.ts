/**
 * The merge queue on /punch-list (punch list #444, PR 3): the rules behind **In the merge queue**, the block above
 * the Burndown. The owner asked on 2026-11-24 to see the queue beside the pace of the list.
 *
 * Nothing new is read. The block draws the one `app_settings` row the `ship-pace` cron writes every 15 minutes
 * (`ShipPacePicture`), the row Settings → How fast a change ships draws, so the two screens cannot disagree. The
 * queue's own rules and words stay in `supabase/functions/_shared/shipPace.ts`; this file adds what the punch list
 * draws differently:
 *
 * - A line of the queue as its values apart: the place, the title, its state (checks running, ready), how long in
 *   the queue, and what is left. A row written before the function read the state has none, and draws no column.
 * - Merges an hour: the merges of the picture's recent stretch (six hours) over its hours, to one decimal. One hour
 *   swings too much, and a whole day's average is dragged down by the night.
 * - The day hour by hour: the merges of each hour of the app calendar's today, midnight first; an hour that has
 *   not come yet is null, so the row is always a whole day wide.
 * - A dev's page asks GitHub for a fresh read when the row is over five minutes old: once an opening, never on a
 *   timer. Everyone else reads the row as the cron left it, since the function answers a dev alone.
 */
import {
  ordinalWords,
  queueSpanWords,
  queueStateTone,
  queueStateWords,
  queueTitleWords,
  SHIP_PACE_QUEUE_SHOWN,
  type PaceQueueEntry,
  type PaceQueueStateTone,
  type ShipPacePicture,
} from '../../../supabase/functions/_shared/shipPace'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { val } from '../valuesInPlace'

/** A dev's opening asks for a read when the row is older than this. */
export const QUEUE_FRESH_MINUTES = 5

/** The words the block prints, in one place for the smoke and the guide. */
export const PUNCH_QUEUE_WORDS = {
  title: 'In the merge queue',
  hide: 'Hide the queue',
  show: 'Show the queue',
  order: 'The order changes go live in, the top one next.',
  loading: 'Reading the queue…',
  place: 'Place',
  change: 'Change',
  state: 'State',
  waited: 'In the queue',
  toGo: 'To go',
  noEstimate: 'no estimate yet',
  mergedToday: 'Merged today',
  sinceMidnight: 'since midnight',
  anHour: 'Merges an hour',
  hourByHour: 'Merges, hour by hour today',
  door: 'How fast a change ships',
  /** The empty state's who: *Nothing waiting on the queue.* */
  who: 'the queue',
} as const

/** One line of the queue with each value apart, as the block's columns draw it. */
export interface QueueRow {
  number: number
  /** *1st*, *2nd*, *11th*. */
  place: string
  /** The title after its version, cut on a word. */
  title: string
  /** *Checks running*, *Ready*, *Waiting its turn*, *Merging now*, *Will not merge*; empty when the row has no state. */
  state: string
  /** How the state's chip is toned; null with no state. */
  tone: PaceQueueStateTone | null
  /** *9 minutes*, *1 hour 5 minutes*, *under a minute*. */
  waited: string
  /** *about 3 minutes*, *under a minute*, or null when GitHub gave no estimate. */
  toGo: string | null
}

/** The first ten entries as rows. `nowMs` is the clock the waits are read against. */
export function queueRows(entries: readonly PaceQueueEntry[], nowMs: number): QueueRow[] {
  return entries.slice(0, SHIP_PACE_QUEUE_SHOWN).map((e) => {
    const since = Date.parse(e.enqueuedAt)
    const waited = Number.isFinite(since) ? Math.max(0, (nowMs - since) / 60_000) : 0
    return {
      number: e.number,
      place: ordinalWords(e.position),
      title: queueTitleWords(e.title),
      state: queueStateWords(e.state),
      tone: queueStateTone(e.state),
      waited: queueSpanWords(waited),
      toGo: e.estimatedMinutes == null ? null : e.estimatedMinutes < 1 ? queueSpanWords(0) : `about ${queueSpanWords(e.estimatedMinutes)}`,
    }
  })
}

/** Whether the State column draws: some row has a state. A row from before the read has none, and the column stays away. */
export function rowsHaveState(rows: readonly QueueRow[]): boolean {
  return rows.some((r) => r.state !== '')
}

/** How many are in line: the queue's own count when it was read, else the entries listed; null when the queue was not read. */
export function inLineCount(picture: Pick<ShipPacePicture, 'now' | 'queue'>): number | null {
  if (!picture.queue) return null
  return picture.now.queue ?? picture.queue.entries.length
}

/** *4 in line*, *1 in line*, *0 in line*; *not read* when the cron could not see the queue. */
export function inLineWords(picture: Pick<ShipPacePicture, 'now' | 'queue'>): string {
  const n = inLineCount(picture)
  return n === null ? 'not read' : `${n.toLocaleString('en-US')} in line`
}

/** Merges an hour over the picture's recent stretch, to one decimal; null when the stretch has no hours. */
export function mergesAnHour(recent: Pick<ShipPacePicture['recent'], 'hours' | 'merged'>): number | null {
  if (!(recent.hours > 0)) return null
  return Math.round((recent.merged / recent.hours) * 10) / 10
}

const figure = (n: number): string => n.toLocaleString('en-US', { maximumFractionDigits: 1 })

/** *6.2*, the figure the block draws; a dash when there is none. */
export function mergesAnHourFigure(recent: Pick<ShipPacePicture['recent'], 'hours' | 'merged'>): string {
  const n = mergesAnHour(recent)
  return n === null ? '—' : figure(n)
}

/** *over the last 6 hours*, *over the last hour*. */
export function recentStretchWords(hours: number): string {
  return hours === 1 ? 'over the last hour' : `over the last ${hours.toLocaleString('en-US')} hours`
}

/** One hour of today: its hour of the day (0 to 23), its label and its merges; null merges for an hour not yet come. */
export interface DayHour {
  hour: number
  /** *12a*, *9a*, *12p*, *6p*. */
  label: string
  merged: number | null
}

const hourOfDay = (ms: number): number => Number(new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date(ms))) % 24

/** *12a*, *9a*, *12p*, *6p* for an hour of the day. */
export function dayHourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24
  return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`
}

/**
 * The app calendar's today as twenty-four hours, midnight first. An hour the picture holds carries its merges (the
 * hour in progress included); an hour after the read is null. On the day the clocks go back the repeated hour's
 * merges add up, and on the day they go forward the skipped hour stays at zero.
 */
export function dayHours(picture: Pick<ShipPacePicture, 'hours' | 'today' | 'asOf'>): DayHour[] {
  const asOf = Date.parse(picture.asOf)
  const last = Number.isFinite(asOf) && calendarYmdInAppTzFromIso(picture.asOf) === picture.today.ymd ? hourOfDay(asOf) : 23
  const out: DayHour[] = Array.from({ length: 24 }, (_, hour) => ({ hour, label: dayHourLabel(hour), merged: hour <= last ? 0 : null }))
  for (const h of picture.hours) {
    const t = Date.parse(h.t)
    if (!Number.isFinite(t) || calendarYmdInAppTzFromIso(h.t) !== picture.today.ymd) continue
    const slot = out[hourOfDay(t)]!
    slot.merged = (slot.merged ?? 0) + h.merged
  }
  return out
}

/** The tallest column's merges, at least one, so an empty day still has a scale. */
export function dayHoursMax(hours: readonly DayHour[]): number {
  return Math.max(1, ...hours.map((h) => h.merged ?? 0))
}

/** The chart's words for a screen reader, and one column's tooltip. */
export function dayHoursLabel(hours: readonly DayHour[], mergedToday: number): string {
  const busiest = hours.reduce<DayHour | null>((top, h) => ((h.merged ?? 0) > (top?.merged ?? 0) ? h : top), null)
  const head = `${mergedToday.toLocaleString('en-US')} merged today.`
  return busiest ? `${head} The busiest hour was ${busiest.label}, with ${busiest.merged}.` : head
}

export function dayHourTitle(h: DayHour): string {
  return h.merged === null ? `${h.label}: not yet` : `${h.label}: ${h.merged.toLocaleString('en-US')} merged`
}

/**
 * The folded block's words after its count, each figure marked as a value: *the next one in about 3 minutes ·
 * 6.2 merges an hour*. With nothing in line, or no estimate, only the merges an hour; empty when the row has none.
 */
export function queueFoldedWords(picture: Pick<ShipPacePicture, 'queue' | 'recent'>): string {
  const parts: string[] = []
  const first = picture.queue?.entries.slice().sort((a, b) => a.position - b.position)[0]
  if (first && first.estimatedMinutes != null) {
    parts.push(`the next one in ${val('count', first.estimatedMinutes < 1 ? queueSpanWords(0) : `about ${queueSpanWords(first.estimatedMinutes)}`)}`)
  }
  const rate = mergesAnHour(picture.recent)
  if (rate !== null) parts.push(`${val('count', figure(rate))} ${rate === 1 ? 'merge' : 'merges'} an hour`)
  return parts.join(' · ')
}

/** Minutes since the row was written; infinite for a stamp that does not parse. */
export function rowAgeMinutes(asOf: string, nowMs: number): number {
  const ms = Date.parse(asOf)
  return Number.isFinite(ms) ? Math.max(0, (nowMs - ms) / 60_000) : Number.POSITIVE_INFINITY
}

/**
 * Whether this opening asks GitHub for a fresh read: a dev's alone (the function answers a dev), and only when the
 * row is missing or older than `QUEUE_FRESH_MINUTES`. The caller asks once an opening.
 */
export function shouldReadOnOpen(input: { role: string | null | undefined; picture: Pick<ShipPacePicture, 'asOf'> | null; nowMs: number }): boolean {
  if (input.role !== 'dev') return false
  if (!input.picture) return true
  return rowAgeMinutes(input.picture.asOf, input.nowMs) > QUEUE_FRESH_MINUTES
}
