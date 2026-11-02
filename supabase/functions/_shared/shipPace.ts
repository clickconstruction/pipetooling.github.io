/**
 * How fast a change ships (v2.6399): the rules behind Settings → How fast a change ships, pure, so the app's tests
 * read them as the `ship-pace` function does. The function reads the repository's pull requests and the merge
 * queue's builds from GitHub every 15 minutes, hands them here, and writes the picture this draws as one
 * `app_settings` row (`SHIP_PACE_KEY`); the client reads the row and never GitHub.
 *
 * The rules:
 * - The hour buckets are the app calendar's (`APP_CALENDAR_TZ`), never the browser's. Chicago's offset is a whole
 *   number of hours, so an hour's start is the same instant in UTC and on the wall; the bucket is the instant, and
 *   its label is the wall clock's (`Fri 3p`). On the fall-back night two instants share the label *Sun 1a*, on purpose.
 * - A pull request counts in the hour it merged. The median per hour is over that hour's merges; an hour with none is
 *   a gap (`null`), never a zero. A closed, unmerged pull request is not a merge. A draft is open.
 * - The headline's median and 90th percentile are over the merges of the last 24 hours.
 * - The series runs the last 72 hours: the hour holding now less 72 hours through the hour holding now.
 * - *Today* is the app calendar's day (`todayYmdInAppTz`), so a merge at 11 PM Central on Sunday is Sunday's.
 *
 * Tested from `src/lib/settings/shipPace.test.ts`.
 */
import { APP_CALENDAR_TZ, todayYmdInAppTz } from './appTimeZone.ts'

/** The one `app_settings` row the function writes and the section reads: `value_text` is a `ShipPacePicture` as JSON. */
export const SHIP_PACE_KEY = 'ship_pace_v1' as const
/** The series' reach, in hours. */
export const SHIP_PACE_WINDOW_HOURS = 72
/** The headline's reach, in hours. */
export const SHIP_PACE_HEADLINE_HOURS = 24
/** How often the cron reads GitHub, in minutes; a row older than four reads is called stale. */
export const SHIP_PACE_READ_MINUTES = 15
export const SHIP_PACE_STALE_MINUTES = SHIP_PACE_READ_MINUTES * 4

const HOUR_MS = 60 * 60 * 1000

/** One pull request as GitHub lists it, the four facts the rules need. */
export type PacePr = {
  number: number
  createdAt: string
  /** When it merged; null for an open or a closed-unmerged pull request. */
  mergedAt: string | null
  /** When it closed, merged or not; null while open. */
  closedAt: string | null
  draft: boolean
}

/** One merge-queue build (an Actions run of the `merge_group` event): when it started and how it ended. */
export type PaceQueueRun = {
  createdAt: string
  /** GitHub's conclusion: success, failure, cancelled, skipped, timed_out, or null while it runs. */
  conclusion: string | null
}

export type PaceInput = {
  now: string | Date
  prs: PacePr[]
  /** The queue's builds in the window; null when Actions was not read (the token lacks it), so the hours say so. */
  queueRuns: PaceQueueRun[] | null
  /** How many pull requests sit in the merge queue now; null when the queue was not read. */
  queueNow: number | null
}

export type PaceHour = {
  /** The hour's start as an ISO instant. */
  t: string
  /** The wall-clock label in the app calendar: `Fri 3p`, `Sat 12a`. */
  label: string
  /** Pull requests opened in the hour. */
  created: number
  /** Pull requests merged in the hour. */
  merged: number
  /** Pull requests open at the hour's end (or now, for the hour in progress). */
  open: number
  /** The median hours from opening to merge over the hour's merges, to a tenth; null when nothing merged. */
  cycleMedianH: number | null
  /** The merge queue's builds that started in the hour, and how many failed; null when Actions was not read. */
  queueBuilds: number | null
  queueFailed: number | null
}

export type PaceHeadline = {
  /** Merges and openings in the last 24 hours. */
  merged: number
  created: number
  /** Hours from opening to merge over those merges, to a tenth; null when nothing merged. */
  medianH: number | null
  p90H: number | null
}

export type ShipPacePicture = {
  v: 1
  /** When GitHub was read. */
  asOf: string
  /** The first hour's start. */
  windowStart: string
  hours: PaceHour[]
  last24h: PaceHeadline
  /** The app calendar's day and what opened and merged in it. */
  today: { ymd: string; created: number; merged: number }
  /** Open now, how many of those are drafts, and the merge queue's count (null when not read). */
  now: { open: number; drafts: number; queue: number | null }
}

/** The start of the hour holding `ms`, as an instant. Chicago's offset is whole hours, so this is the wall hour's start too. */
export function hourStartMs(ms: number): number {
  return Math.floor(ms / HOUR_MS) * HOUR_MS
}

/** `Fri 3p`, `Sat 12a`: the weekday and the 12-hour hour in the app calendar. */
export function hourLabel(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, weekday: 'short', hour: 'numeric', hour12: true }).formatToParts(new Date(ms))
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const period = g('dayPeriod').toLowerCase().startsWith('p') ? 'p' : 'a'
  return `${g('weekday')} ${g('hour')}${period}`
}

function msOf(iso: string): number {
  const ms = new Date(iso).getTime()
  return Number.isFinite(ms) ? ms : Number.NaN
}

/** The median of a list of numbers; null for an empty list. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const hi = sorted[mid] ?? 0
  const lo = sorted[mid - 1] ?? hi
  return sorted.length % 2 === 1 ? hi : (lo + hi) / 2
}

/** The nearest-rank percentile (0–100) of a list; null for an empty list. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)))
  return sorted[rank - 1] ?? null
}

const tenth = (h: number | null): number | null => (h == null ? null : Math.round(h * 10) / 10)

/** The app calendar's YYYY-MM-DD of an instant. */
function ymdOf(ms: number): string {
  return todayYmdInAppTz(new Date(ms))
}

/** The whole picture from GitHub's lists: the 72-hour series, the headline, today and now. */
export function shipPacePicture(input: PaceInput): ShipPacePicture {
  const nowMs = typeof input.now === 'string' ? msOf(input.now) : input.now.getTime()
  const windowStart = hourStartMs(nowMs) - SHIP_PACE_WINDOW_HOURS * HOUR_MS
  const lastHour = hourStartMs(nowMs)

  // Each pull request once, with its instants; a row GitHub lists twice (a page shifted under the read) counts once.
  const seen = new Set<number>()
  const prs: { createdMs: number; mergedMs: number | null; closedMs: number | null; draft: boolean }[] = []
  for (const pr of input.prs) {
    if (seen.has(pr.number)) continue
    seen.add(pr.number)
    const createdMs = msOf(pr.createdAt)
    if (!Number.isFinite(createdMs)) continue
    const mergedMs = pr.mergedAt ? msOf(pr.mergedAt) : null
    const closedMs = pr.closedAt ? msOf(pr.closedAt) : mergedMs
    prs.push({ createdMs, mergedMs: mergedMs != null && Number.isFinite(mergedMs) ? mergedMs : null, closedMs: closedMs != null && Number.isFinite(closedMs) ? closedMs : null, draft: pr.draft })
  }

  const cycleH = (p: { createdMs: number; mergedMs: number | null }): number => ((p.mergedMs ?? 0) - p.createdMs) / HOUR_MS

  const hours: PaceHour[] = []
  for (let t = windowStart; t <= lastHour; t += HOUR_MS) {
    const end = Math.min(t + HOUR_MS, nowMs)
    const mergedHere = prs.filter((p) => p.mergedMs != null && hourStartMs(p.mergedMs) === t)
    const runsHere = input.queueRuns?.filter((r) => hourStartMs(msOf(r.createdAt)) === t) ?? null
    hours.push({
      t: new Date(t).toISOString(),
      label: hourLabel(t),
      created: prs.filter((p) => hourStartMs(p.createdMs) === t).length,
      merged: mergedHere.length,
      open: prs.filter((p) => p.createdMs <= end && (p.closedMs == null || p.closedMs > end)).length,
      cycleMedianH: tenth(median(mergedHere.map(cycleH))),
      queueBuilds: runsHere ? runsHere.length : null,
      queueFailed: runsHere ? runsHere.filter((r) => r.conclusion === 'failure' || r.conclusion === 'timed_out').length : null,
    })
  }

  const dayAgo = nowMs - SHIP_PACE_HEADLINE_HOURS * HOUR_MS
  const merged24 = prs.filter((p) => p.mergedMs != null && p.mergedMs > dayAgo && p.mergedMs <= nowMs)
  const cycles24 = merged24.map(cycleH)
  const todayYmd = ymdOf(nowMs)
  const openNow = prs.filter((p) => p.closedMs == null && p.mergedMs == null)

  return {
    v: 1,
    asOf: new Date(nowMs).toISOString(),
    windowStart: new Date(windowStart).toISOString(),
    hours,
    last24h: {
      merged: merged24.length,
      created: prs.filter((p) => p.createdMs > dayAgo && p.createdMs <= nowMs).length,
      medianH: tenth(median(cycles24)),
      p90H: tenth(percentile(cycles24, 90)),
    },
    today: {
      ymd: todayYmd,
      created: prs.filter((p) => ymdOf(p.createdMs) === todayYmd).length,
      merged: prs.filter((p) => p.mergedMs != null && ymdOf(p.mergedMs) === todayYmd).length,
    },
    now: { open: openNow.length, drafts: openNow.filter((p) => p.draft).length, queue: input.queueNow },
  }
}

/** The row's JSON read back; null for an empty, malformed or older-shaped row. */
export function parseShipPacePicture(valueText: string | null | undefined): ShipPacePicture | null {
  if (!valueText) return null
  try {
    const raw = JSON.parse(valueText) as Partial<ShipPacePicture> | null
    if (!raw || raw.v !== 1 || typeof raw.asOf !== 'string' || !Array.isArray(raw.hours) || !raw.last24h || !raw.today || !raw.now) return null
    return raw as ShipPacePicture
  } catch {
    return null
  }
}

/** `about 4 hours`, `about an hour`, `about half an hour`: a span of hours in the words the headline says. */
export function hoursWords(h: number): string {
  if (h < 0.75) return 'about half an hour'
  if (h < 1.5) return 'about an hour'
  return `about ${Math.round(h)} hours`
}

/** `inside 9 hours`, `inside an hour`: the 90th percentile rounded up to a whole hour. */
export function insideWords(h: number): string {
  const whole = Math.max(1, Math.ceil(h))
  return whole === 1 ? 'inside an hour' : `inside ${whole} hours`
}

/**
 * The headline, two sentences the owner can say out loud: how long a change asked for today has been taking, and
 * where nine in ten land. With no merge in the last 24 hours it says so instead.
 */
export function paceHeadlineWords(h: PaceHeadline): string {
  if (h.medianH == null || h.p90H == null) return 'Nothing has merged in the last 24 hours, so there is no number for today yet.'
  return `A change asked for today has been taking ${hoursWords(h.medianH)} to reach the app. Nine in ten land ${insideWords(h.p90H)}.`
}

/** The clock time of an instant in the app calendar: `3:37 PM`. */
export function clockWords(iso: string): string {
  const ms = msOf(iso)
  if (!Number.isFinite(ms)) return ''
  return new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(ms))
}

/** How old the row is, and whether it is stale: more than four reads old, so the cron or its token is in trouble. */
export function paceFreshness(asOf: string, nowMs: number): { minutes: number; stale: boolean } {
  const ms = msOf(asOf)
  const minutes = Number.isFinite(ms) ? Math.max(0, Math.round((nowMs - ms) / 60_000)) : Number.POSITIVE_INFINITY
  return { minutes, stale: minutes > SHIP_PACE_STALE_MINUTES }
}

/** *As of 3:37 PM.*, or when stale, when the last read was and that the reader may be stuck. */
export function paceAsOfWords(asOf: string, nowMs: number): string {
  const { stale } = paceFreshness(asOf, nowMs)
  const clock = clockWords(asOf)
  if (!stale) return `As of ${clock}.`
  const day = ymdOf(msOf(asOf)) === ymdOf(nowMs) ? '' : ` on ${ymdOf(msOf(asOf))}`
  return `The last read was at ${clock}${day}, more than an hour ago. The reader may be stuck. Ask a dev.`
}

/** The x-axis ticks: every sixth hour from the first, by the hour's instant, so two hours sharing a label stay apart. */
export function paceTicks(hours: PaceHour[], every = 6): string[] {
  return hours.filter((_, i) => i % every === 0).map((h) => h.t)
}

/** The y-axis top: a multiple of 4 above the tallest median, never under 8. */
export function paceYMax(hours: PaceHour[]): number {
  const top = Math.max(0, ...hours.map((h) => h.cycleMedianH ?? 0))
  return Math.max(8, Math.ceil(top / 4) * 4)
}

/** `77 opened`, `1 opened`: a count with its noun, never pluralized. */
export function countWords(n: number, what: string): string {
  return `${n.toLocaleString('en-US')} ${what}`
}
