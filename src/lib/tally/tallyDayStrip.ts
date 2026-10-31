import { appTzWallTimeMs, todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { pgTimeToMinutes } from '../jobScheduleChicago'
import type { TallyQueueCard } from './tallyTeamQueue'

/**
 * The holder's day as a strip (punch list #217, jobs-money-3, a prototype behind the Team queue's
 * *Day strip* switch): each clock session a bar in its job's colour, each schedule block a hollow
 * bar, each card charge a tick at the time of its swipe, the hours under. The evidence the day card
 * says in a sentence ("Clocked on JP101 from 7:02 AM to 3:40 PM") is times, so here it is drawn
 * as times, and each tick gets a verdict the eye could only guess at from the sentence: inside a
 * session's bar, in scheduled hours the holder never clocked, before the first clock-in, between
 * two sessions, after the last clock-out, or on a day with nothing at all.
 *
 * The verdict changes words and an order on the screen, nothing else: `tallySortSuggestion.ts`'s
 * rules, their `likely` marks and the writes are untouched. Pure: no React, no Supabase. Times are
 * company wall-clock (`APP_CALENDAR_TZ`), the day is the card's company day, and the strip runs
 * from 6 AM to 8 PM unless a session or a swipe falls outside, when it widens to the hour, never
 * past the day's own midnight.
 */

/** The strip's default hours: most of the team's days and swipes fall between them. */
export const TALLY_DAY_STRIP_START_HOUR = 6
export const TALLY_DAY_STRIP_END_HOUR = 20
/** `--timeline-job-0` … `--timeline-job-7` in `src/index.css`, light and dark. */
export const TALLY_DAY_STRIP_COLOURS = 8
/** Two amounts closer than this share of the strip take two rows; a third in the same room joins the label before it. */
export const TALLY_DAY_STRIP_LABEL_GAP_PCT = 14
/** Hour labels every this many hours from the strip's start; the end hour and noon always read. */
export const TALLY_DAY_STRIP_LABEL_EVERY_HOURS = 3

export type TallyDayStripSession = { jobId: string; clockedInAt: string; clockedOutAt: string | null }
/** One schedule block that day: `job_schedule_blocks.time_start` / `time_end`, Postgres times ("07:00:00"). */
export type TallyDayStripScheduled = { jobId: string; timeStart: string | null; timeEnd: string | null }
export type TallyDayStripCharge = { id: string; madeAt: string; amount: number }

export type TallyDayStripInput = {
  /** The card's company day. */
  ymd: string
  /** The holder's sessions on a job that day (time on a bid or with no job draws nothing). */
  sessions: readonly TallyDayStripSession[]
  /** The holder's schedule blocks that day. */
  scheduled: readonly TallyDayStripScheduled[]
  /** The day's unsorted charges. */
  charges: readonly TallyDayStripCharge[]
  /** A session still open on today runs to now. */
  nowMs: number
}

export type TallyDayStripBar = {
  kind: 'clocked' | 'scheduled'
  jobId: string
  /** 0 to 7: the job's colour token; one job keeps one colour across the strip. */
  colour: number
  startMs: number
  endMs: number
  /** The bar's edges as a share of the strip, 0 to 100. */
  startPct: number
  endPct: number
  /** A session with no clock-out: on today it runs to now, on a past day to the strip's end. */
  open: boolean
}

/** Where a tick sits against the holder's day. */
export type TallyTickPlace =
  /** Inside a clock session's bar. */
  | { kind: 'inside'; jobId: string }
  /** Inside a schedule block's hours, with no session over it. */
  | { kind: 'scheduled'; jobId: string }
  /** Before the first clock-in, by `gapMs`. */
  | { kind: 'before'; jobId: string; gapMs: number }
  /** Between two sessions: `gapMs` off the clock since the earlier one ended. */
  | { kind: 'between'; afterJobId: string; beforeJobId: string; gapMs: number }
  /** After the last clock-out, by `gapMs`. */
  | { kind: 'after'; jobId: string; gapMs: number }
  /** After a clock-in that never clocked out, on a past day: how long the session ran is unknown. */
  | { kind: 'open'; jobId: string }
  /** A day with no session and no schedule block. */
  | { kind: 'none' }

export type TallyDayStripTick = {
  chargeId: string
  ms: number
  /** The tick's place along the strip, 0 to 100. */
  pct: number
  amount: number
  place: TallyTickPlace
}

/** The amount over a tick, or over a run of ticks too close for one each: their count and their sum. */
export type TallyDayStripLabel = {
  /** Where the words sit, 0 to 100: the tick's place, or the middle of the run. */
  pct: number
  row: 0 | 1
  /** How many charges the label counts. */
  count: number
  /** Their signed sum. */
  amount: number
}

export type TallyDayStripHour = {
  hour: number
  pct: number
  /** The words under the mark, or null for a bare mark. */
  label: string | null
}

export type TallyDayStrip = {
  ymd: string
  startMs: number
  endMs: number
  /** Clocked bars in clock-in order, then scheduled bars in schedule order. */
  bars: TallyDayStripBar[]
  /** In the order the charges were made. */
  ticks: TallyDayStripTick[]
  /** The amounts over the ticks, left to right. */
  labels: TallyDayStripLabel[]
  hours: TallyDayStripHour[]
  /** Where now falls when the day is today and now is on the strip, else null. */
  nowPct: number | null
}

const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000

/** The job's number alone: "JP101 · Hill Street" reads "JP101" on a bar and in a chip's few words. */
export function tallyJobShortName(label: string): string {
  const head = label.split(/\s*[·—]\s*/)[0]?.trim() ?? ''
  return head || label.trim()
}

/** The wall-clock start of each hour of the day, 0 through 24 (24 is the next day's midnight). */
function hourStarts(ymd: string): number[] {
  const out: number[] = []
  for (let h = 0; h < 24; h++) out.push(appTzWallTimeMs(ymd, h, 0))
  out.push(appTzWallTimeMs(ymdAddDays(ymd, 1), 0, 0))
  return out
}

function clamp(ms: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, ms))
}

function hour12(h: number): string {
  const n = h % 12 === 0 ? 12 : h % 12
  return `${n}`
}

function hourLabel(h: number, startHour: number, endHour: number): string | null {
  if (h === startHour || h === endHour) return h === 12 ? 'noon' : `${hour12(h)} ${h < 12 || h === 24 ? 'AM' : 'PM'}`
  if (h === 12) return 'noon'
  if ((h - startHour) % TALLY_DAY_STRIP_LABEL_EVERY_HOURS !== 0) return null
  // A bare number against the end label would crowd it.
  if (endHour - h < 2) return null
  return hour12(h)
}

/** The strip for one holder-day: bars, ticks with their verdicts, and the hours. */
export function buildTallyDayStrip(input: TallyDayStripInput): TallyDayStrip {
  const { ymd, nowMs } = input
  const starts = hourStarts(ymd)
  const dayStart = starts[0]!
  const dayEnd = starts[24]!
  const today = todayYmdInAppTz(new Date(nowMs)) === ymd

  // Colours: by first appearance among the clocked jobs in clock-in order, then the scheduled ones.
  const colourOf = new Map<string, number>()
  const colour = (jobId: string): number => {
    const have = colourOf.get(jobId)
    if (have != null) return have
    const next = colourOf.size % TALLY_DAY_STRIP_COLOURS
    colourOf.set(jobId, next)
    return next
  }

  /** A span on the day; `endMs` is null for a session still open on a past day, whose end nobody knows. */
  type Span = { jobId: string; startMs: number; endMs: number | null; kind: 'clocked' | 'scheduled'; open: boolean }
  const clocked: Span[] = []
  for (const s of input.sessions) {
    const inMs = Date.parse(s.clockedInAt)
    if (!Number.isFinite(inMs)) continue
    const outMs = s.clockedOutAt ? Date.parse(s.clockedOutAt) : null
    const open = outMs == null || !Number.isFinite(outMs)
    clocked.push({
      jobId: s.jobId,
      startMs: clamp(inMs, dayStart, dayEnd),
      endMs: open ? (today ? clamp(Math.max(nowMs, inMs), dayStart, dayEnd) : null) : clamp(Math.max(outMs, inMs), dayStart, dayEnd),
      kind: 'clocked',
      open,
    })
  }
  clocked.sort((a, b) => a.startMs - b.startMs || a.jobId.localeCompare(b.jobId))
  for (const c of clocked) colour(c.jobId)

  const scheduled: Span[] = []
  for (const b of input.scheduled) {
    if (!b.timeStart || !b.timeEnd) continue
    const startMin = pgTimeToMinutes(b.timeStart)
    const endMin = pgTimeToMinutes(b.timeEnd)
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) continue
    scheduled.push({
      jobId: b.jobId,
      startMs: clamp(dayStart + startMin * MINUTE_MS, dayStart, dayEnd),
      endMs: clamp(dayStart + endMin * MINUTE_MS, dayStart, dayEnd),
      kind: 'scheduled',
      open: false,
    })
  }
  for (const s of scheduled) colour(s.jobId)

  const ticksRaw = input.charges
    .map((c) => ({ charge: c, ms: Date.parse(c.madeAt) }))
    .filter((t) => Number.isFinite(t.ms))
    .map((t) => ({ ...t, ms: clamp(t.ms, dayStart, dayEnd) }))
    .sort((a, b) => a.ms - b.ms)

  // The strip's hours: 6 AM to 8 PM, widened to the hour around anything outside, within the day.
  let startHour = TALLY_DAY_STRIP_START_HOUR
  let endHour = TALLY_DAY_STRIP_END_HOUR
  const widen = (ms: number) => {
    while (startHour > 0 && starts[startHour]! > ms) startHour -= 1
    while (endHour < 24 && starts[endHour]! < ms) endHour += 1
  }
  for (const s of [...clocked, ...scheduled]) {
    widen(s.startMs)
    if (s.endMs != null) widen(s.endMs)
  }
  for (const t of ticksRaw) widen(t.ms)
  const startMs = starts[startHour]!
  const endMs = starts[endHour]!
  const span = Math.max(1, endMs - startMs)
  const pctOf = (ms: number) => Math.round(((ms - startMs) / span) * 1000) / 10

  const bars: TallyDayStripBar[] = [...clocked, ...scheduled].map((s) => {
    const end = s.endMs ?? endMs
    return {
      kind: s.kind,
      jobId: s.jobId,
      colour: colour(s.jobId),
      startMs: s.startMs,
      endMs: end,
      startPct: pctOf(s.startMs),
      endPct: pctOf(end),
      open: s.open,
    }
  })

  type Closed = Span & { endMs: number }
  const place = (ms: number): TallyTickPlace => {
    for (const c of clocked) {
      if (c.endMs != null && ms >= c.startMs && ms <= c.endMs) return { kind: 'inside', jobId: c.jobId }
    }
    for (const c of clocked) {
      if (c.endMs == null && ms >= c.startMs) return { kind: 'open', jobId: c.jobId }
    }
    for (const s of scheduled) {
      if (s.endMs != null && ms >= s.startMs && ms <= s.endMs) return { kind: 'scheduled', jobId: s.jobId }
    }
    const first = clocked[0]
    if (!first) return { kind: 'none' }
    if (ms < first.startMs) return { kind: 'before', jobId: first.jobId, gapMs: first.startMs - ms }
    const closed = clocked.filter((c): c is Closed => c.endMs != null)
    if (closed.length === 0) return { kind: 'none' }
    const last = closed.reduce((a, b) => (b.endMs > a.endMs ? b : a))
    if (ms > last.endMs) return { kind: 'after', jobId: last.jobId, gapMs: ms - last.endMs }
    let before: Closed | null = null
    let after: Closed | null = null
    for (const c of closed) {
      if (c.endMs <= ms && (before == null || c.endMs > before.endMs)) before = c
      if (c.startMs >= ms && (after == null || c.startMs < after.startMs)) after = c
    }
    if (before && after) return { kind: 'between', afterJobId: before.jobId, beforeJobId: after.jobId, gapMs: ms - before.endMs }
    return { kind: 'none' }
  }

  const ticks: TallyDayStripTick[] = ticksRaw.map((t) => ({
    chargeId: t.charge.id,
    ms: t.ms,
    pct: pctOf(t.ms),
    amount: t.charge.amount,
    place: place(t.ms),
  }))

  // The amounts: a free row within the gap, else the tick joins the label before it.
  const labels: TallyDayStripLabel[] = []
  const members: number[][] = []
  const lastOnRow: [number, number] = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
  for (const t of ticks) {
    const row = ([0, 1] as const).find((r) => t.pct - lastOnRow[r] >= TALLY_DAY_STRIP_LABEL_GAP_PCT)
    const last = labels[labels.length - 1]
    if (row == null && last) {
      const pcts = members[members.length - 1]!
      pcts.push(t.pct)
      last.count += 1
      last.amount = Math.round((last.amount + t.amount) * 100) / 100
      last.pct = Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10
      lastOnRow[last.row] = t.pct
      continue
    }
    const r = row ?? 0
    lastOnRow[r] = t.pct
    labels.push({ pct: t.pct, row: r, count: 1, amount: t.amount })
    members.push([t.pct])
  }

  const hours: TallyDayStripHour[] = []
  for (let h = startHour; h <= endHour; h++) hours.push({ hour: h, pct: pctOf(starts[h]!), label: hourLabel(h, startHour, endHour) })

  const nowPct = today && nowMs >= startMs && nowMs <= endMs ? pctOf(nowMs) : null

  return { ymd, startMs, endMs, bars, ticks, labels, hours, nowPct }
}

/** The strip from a Team queue card: its clocked spans, the holder's schedule blocks that day and its charges. */
export function tallyDayStripFromCard(card: TallyQueueCard, scheduled: readonly TallyDayStripScheduled[], nowMs: number): TallyDayStrip {
  return buildTallyDayStrip({
    ymd: card.ymd,
    sessions: card.suggestion.clockedJobs.flatMap((j) => j.spans.map((s) => ({ jobId: j.jobId, clockedInAt: s.clockedInAt, clockedOutAt: s.clockedOutAt }))),
    scheduled,
    charges: card.charges.map((c) => ({ id: c.charge.id, madeAt: c.charge.madeAt, amount: c.charge.amount })),
    nowMs,
  })
}

/** The DOM id of a charge's line on the day card, where a tick's press goes; `suffix` tells two drawings of one card apart. */
export function tallyTeamLineDomId(chargeId: string, suffix = ''): string {
  return `tally-team-line-${chargeId}${suffix ? `-${suffix}` : ''}`
}

/** The job a tick's picker leads with: the session or the schedule block it sits in; none for a gap. */
export function tallyStripLeadJobId(place: TallyTickPlace): string | null {
  return place.kind === 'inside' || place.kind === 'scheduled' ? place.jobId : null
}

/** A gap in few words: under an hour to the nearest 5 minutes, else to the nearest half hour. */
export function tallyGapWords(gapMs: number): string {
  if (gapMs < HOUR_MS) {
    const min = Math.max(5, Math.round(gapMs / MINUTE_MS / 5) * 5)
    return min >= 60 ? '1 h' : `${min} min`
  }
  const h = Math.round((gapMs / HOUR_MS) * 2) / 2
  return `${h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)} h`
}

/** A tick's verdict in a chip's few words, plain (`plainWords.ts`); `name` is the job's short name. */
export function tallyTickPlaceWords(place: TallyTickPlace, name: (jobId: string) => string): string {
  switch (place.kind) {
    case 'inside':
      return `in ${name(place.jobId)}’s hours`
    case 'scheduled':
      return `in ${name(place.jobId)}’s scheduled hours, not clocked`
    case 'before':
      return `${tallyGapWords(place.gapMs)} before clock-in`
    case 'between':
      return `${tallyGapWords(place.gapMs)} between ${name(place.afterJobId)} and ${name(place.beforeJobId)}`
    case 'after':
      return `${tallyGapWords(place.gapMs)} after clock-out`
    case 'open':
      return `after clock-in on ${name(place.jobId)}, with no clock-out`
    case 'none':
      return 'off the clock all day'
  }
}

/** The switch, remembered per person on the device, like the Dashboard's Job Mode. Off until turned on. */
const STORAGE_PREFIX = 'tally_team_day_strip'

export function tallyDayStripStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}_${userId}`
}

/** `'1'` is on; anything else, and no value, is off. */
export function parseTallyDayStripStored(raw: string | null | undefined): boolean {
  return raw === '1'
}
