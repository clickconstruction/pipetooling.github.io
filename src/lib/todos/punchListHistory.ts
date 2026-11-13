import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { sizeBucket, type SizeBucket } from './punchListShortlist'
import { BOARD_GROUPS, GROUP_LABELS, type BoardGroup, type BoardItem, type TodoDoc } from './todoBoard'

/**
 * The punch list's burndown: how many cards were open at each hour, what came in and what closed,
 * and when the list clears at the pace of a chosen stretch. Grace asked on 2026-11-12 for the chart
 * she had been reading in a chat to live on /punch-list, hour by hour, since the work comes in waves.
 *
 * Nothing is recorded for it. The build replays every commit on main that changed `to-dos/`
 * (`scripts/todos/readTodoHistory.ts`, loaded as `punchListHistoryData.ts`) and hands this kernel
 * each board as it stood; the rules below turn those boards into the numbers the page draws, so the
 * history is as true as the folder's own and cannot drift from it.
 *
 * The rules:
 * - A card is open while its file is in `to-dos/` on main. It closes when it leaves, shipped or dropped.
 *   A pointer card is a standing list and never counts.
 * - Points weigh a card by the size it has left, read from its own `size` words by `sizeBucket`:
 *   XS 1, S 2, M 4, L 8, XL 16, and 4 for a card that names no letter.
 * - The board is read at the end of each hour. The hour holding now is partial and never sets a pace.
 * - A pace is the cards (or points) closed and added per day over whole hours of the chosen stretch.
 *   *With no new cards* divides what is open by what closes a day. *At this pace* divides it by what
 *   closes less what arrives, and has no answer when more arrive than close.
 * - A stage drains by every card that left it, closed or moved on to another stage.
 * - Hours are instants. Days and the wave columns are the app calendar's (`APP_CALENDAR_TZ`).
 */

export const SIZE_POINTS: Record<SizeBucket, number> = { XS: 1, S: 2, M: 4, L: 8, XL: 16 }
/** A card whose size names no letter weighs as a middling one. */
export const UNSIZED_POINTS = 4

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
const G = BOARD_GROUPS.length

/** One card as the history keeps it: its number, its stage and its points. */
export interface HistoryCard {
  n: number
  g: BoardGroup
  p: number
}

/** The board at one commit: `t` is the commit's time in epoch seconds. */
export interface HistoryState {
  t: number
  cards: HistoryCard[]
}

/**
 * One change of the board, as the build ships it. The five-number arrays run in `BOARD_GROUPS` order.
 * `left` counts the cards that left each stage in this change, closed or moved to another stage.
 */
export interface HistoryEvent {
  t: number
  open: number
  pts: number
  byGroup: number[]
  ptsByGroup: number[]
  added: number
  closed: number
  addedPts: number
  burnedPts: number
  left: number[]
}

export interface PunchListHistory {
  /** True when the build read a cut-off copy of the repository, so the history starts late. */
  shallow: boolean
  events: HistoryEvent[]
}

export const EMPTY_HISTORY: PunchListHistory = { shallow: false, events: [] }

/**
 * The history as the build ships it: one row of 22 numbers a change, so sixteen hundred changes cost
 * a third of what the named fields would. The order is `HistoryEvent`'s, the arrays spread in place.
 */
export interface PackedHistory {
  shallow: boolean
  rows: number[][]
}

export function packHistory(history: PunchListHistory): PackedHistory {
  return {
    shallow: history.shallow,
    rows: history.events.map((e) => [e.t, e.open, e.pts, ...e.byGroup, ...e.ptsByGroup, e.added, e.closed, e.addedPts, e.burnedPts, ...e.left]),
  }
}

export function unpackHistory(packed: PackedHistory | null | undefined): PunchListHistory {
  if (!packed || !Array.isArray(packed.rows)) return EMPTY_HISTORY
  const n = (v: number | undefined): number => v ?? 0
  return {
    shallow: packed.shallow === true,
    events: packed.rows.map((r) => ({
      t: n(r[0]),
      open: n(r[1]),
      pts: n(r[2]),
      byGroup: r.slice(3, 3 + G),
      ptsByGroup: r.slice(3 + G, 3 + 2 * G),
      added: n(r[3 + 2 * G]),
      closed: n(r[4 + 2 * G]),
      addedPts: n(r[5 + 2 * G]),
      burnedPts: n(r[6 + 2 * G]),
      left: r.slice(7 + 2 * G, 7 + 3 * G),
    })),
  }
}

export function pointsForSize(size: string): number {
  const bucket = sizeBucket(size)
  return bucket ? SIZE_POINTS[bucket] : UNSIZED_POINTS
}

/** The open cards of a parsed board: the pointer cards left out. */
export function cardsFromDocs(docs: readonly Pick<TodoDoc, 'meta'>[]): HistoryCard[] {
  return docs.filter((d) => !d.meta.pointer).map((d) => ({ n: d.meta.number, g: d.meta.group, p: pointsForSize(d.meta.size) }))
}

/** The open cards of the board the page already holds. */
export function cardsFromItems(items: readonly BoardItem[]): HistoryCard[] {
  return items.filter((i) => !i.pointer).map((i) => ({ n: i.number, g: i.group, p: pointsForSize(i.size) }))
}

const zeros = (): number[] => Array.from({ length: G }, () => 0)
const gi = (g: BoardGroup): number => BOARD_GROUPS.indexOf(g)

/** Each board against the one before it. The first board has no flows: nothing is known of what came before. */
export function historyFromStates(states: readonly HistoryState[]): HistoryEvent[] {
  const out: HistoryEvent[] = []
  let prev: Map<number, HistoryCard> | null = null
  for (const s of states) {
    const cur = new Map(s.cards.map((c) => [c.n, c]))
    const e: HistoryEvent = { t: s.t, open: cur.size, pts: 0, byGroup: zeros(), ptsByGroup: zeros(), added: 0, closed: 0, addedPts: 0, burnedPts: 0, left: zeros() }
    for (const c of cur.values()) {
      e.pts += c.p
      e.byGroup[gi(c.g)]! += 1
      e.ptsByGroup[gi(c.g)]! += c.p
    }
    if (prev) {
      for (const [n, c] of cur) {
        const p = prev.get(n)
        if (!p) {
          e.added += 1
          e.addedPts += c.p
          continue
        }
        if (p.g !== c.g) e.left[gi(p.g)]! += 1
        if (c.p > p.p) e.addedPts += c.p - p.p
        else if (c.p < p.p) e.burnedPts += p.p - c.p
      }
      for (const [n, p] of prev) {
        if (cur.has(n)) continue
        e.closed += 1
        e.burnedPts += p.p
        e.left[gi(p.g)]! += 1
      }
    }
    out.push(e)
    prev = cur
  }
  return out
}

/** One hour of the board: what stood at its end and what moved inside it. `end` is the hour's end, or now for the hour in progress. */
export interface HourRow {
  start: number
  end: number
  partial: boolean
  open: number
  pts: number
  byGroup: number[]
  ptsByGroup: number[]
  added: number
  closed: number
  addedPts: number
  burnedPts: number
  left: number[]
}

/** The board at the end of every hour from the first change to now, in milliseconds. Empty when there is no history. */
export function hourlyRows(events: readonly HistoryEvent[], nowMs: number): HourRow[] {
  const first = events[0]
  if (!first) return []
  const rows: HourRow[] = []
  let i = 0
  let standing: HistoryEvent = first
  for (let start = Math.floor((first.t * 1000) / HOUR_MS) * HOUR_MS; start < nowMs || rows.length === 0; start += HOUR_MS) {
    const end = Math.max(start, Math.min(start + HOUR_MS, nowMs))
    const row: HourRow = { start, end, partial: end < start + HOUR_MS, open: 0, pts: 0, byGroup: zeros(), ptsByGroup: zeros(), added: 0, closed: 0, addedPts: 0, burnedPts: 0, left: zeros() }
    for (; i < events.length && events[i]!.t * 1000 < start + HOUR_MS && events[i]!.t * 1000 <= nowMs; i++) {
      const e = events[i]!
      standing = e
      row.added += e.added
      row.closed += e.closed
      row.addedPts += e.addedPts
      row.burnedPts += e.burnedPts
      for (let k = 0; k < G; k++) row.left[k]! += e.left[k] ?? 0
    }
    row.open = standing.open
    row.pts = standing.pts
    row.byGroup = [...standing.byGroup]
    row.ptsByGroup = [...standing.ptsByGroup]
    rows.push(row)
  }
  return rows
}

export const BURNDOWN_RANGES = ['24h', '3d', '7d', '14d', 'all'] as const
export type BurndownRange = (typeof BURNDOWN_RANGES)[number]
export type BurndownMeasure = 'cards' | 'points'

const RANGE_HOURS: Record<BurndownRange, number | null> = { '24h': 24, '3d': 72, '7d': 168, '14d': 336, all: null }

/** The picker's label for a stretch; *since* names the history's first day. */
export function rangeLabel(range: BurndownRange, firstMs: number | null): string {
  if (range === '24h') return 'The last 24 hours'
  if (range === '3d') return 'The last 3 days'
  if (range === '7d') return 'The last 7 days'
  if (range === '14d') return 'The last 14 days'
  return firstMs === null ? 'All of it' : `Since ${dayWords(firstMs)}`
}

/** The stretch inside a sentence: *in the last 7 days*, *since Sep 22*. */
export function rangeWords(range: BurndownRange, firstMs: number | null): string {
  const label = rangeLabel(range, firstMs)
  return range === 'all' ? label.charAt(0).toLowerCase() + label.slice(1) : `in ${label.charAt(0).toLowerCase()}${label.slice(1)}`
}

/** The rows a stretch draws: every row whose end falls inside it. */
export function rowsInRange(rows: readonly HourRow[], range: BurndownRange): HourRow[] {
  const hours = RANGE_HOURS[range]
  const last = rows[rows.length - 1]
  if (hours === null || !last) return [...rows]
  return rows.filter((r) => r.end > last.end - hours * HOUR_MS)
}

export interface Pace {
  range: BurndownRange
  /** Whole hours the pace is read over. */
  hours: number
  closed: number
  added: number
  closedPerDay: number
  addedPerDay: number
  /** Added less closed, per day: below zero, the list shrinks. */
  netPerDay: number
  open: number
  /** Open now less open at the start of the stretch. */
  change: number
  changeSinceMs: number
  /** Whole days until the list clears with no new cards, and that day; null when nothing closed. */
  daysNoNew: number | null
  clearNoNewMs: number | null
  /** The same at the stretch's own pace; null when the list is not shrinking. */
  daysAtPace: number | null
  clearAtPaceMs: number | null
}

const round1 = (x: number): number => Math.round(x * 10) / 10

/** The pace of a stretch, in cards or in points. Null when there is no history. */
export function paceOver(rows: readonly HourRow[], range: BurndownRange, measure: BurndownMeasure): Pace | null {
  const now = rows[rows.length - 1]
  if (!now) return null
  const whole = rows.filter((r) => !r.partial)
  const hours = RANGE_HOURS[range]
  const win = hours === null ? whole : whole.slice(-hours)
  const sum = (f: (r: HourRow) => number): number => win.reduce((a, r) => a + f(r), 0)
  const days = Math.max(1, win.length) / 24
  const closed = sum((r) => (measure === 'points' ? r.burnedPts : r.closed))
  const added = sum((r) => (measure === 'points' ? r.addedPts : r.added))
  const closedPerDay = closed / days
  const addedPerDay = added / days
  const net = addedPerDay - closedPerDay
  const openOf = (r: HourRow): number => (measure === 'points' ? r.pts : r.open)
  const open = openOf(now)
  const firstIndex = win.length ? rows.indexOf(win[0]!) : rows.length - 1
  const before = rows[Math.max(0, firstIndex - 1)]!
  const daysNoNew = closedPerDay > 0 ? Math.ceil(open / closedPerDay) : null
  const daysAtPace = net < 0 ? Math.ceil(open / -net) : null
  return {
    range,
    hours: win.length,
    closed,
    added,
    closedPerDay: round1(closedPerDay),
    addedPerDay: round1(addedPerDay),
    netPerDay: round1(net),
    open,
    change: open - openOf(before),
    changeSinceMs: before.end,
    daysNoNew,
    clearNoNewMs: daysNoNew === null ? null : now.end + daysNoNew * DAY_MS,
    daysAtPace,
    clearAtPaceMs: daysAtPace === null ? null : now.end + daysAtPace * DAY_MS,
  }
}

/** One point of the chart: an hour's end with what was open, or a point of a projection past now. */
export interface ChartPoint {
  t: number
  open: number | null
  noNew: number | null
  atPace: number | null
}

/**
 * The chart's line: the stretch's hours, then both projections out to three quarters of the stretch
 * again (twelve hours at least), each ending where it reaches zero. A projection that does not fall
 * (nothing closed, or more arriving than closing) is drawn flat or rising to the chart's edge.
 */
export function chartPoints(rows: readonly HourRow[], range: BurndownRange, measure: BurndownMeasure, pace: Pace | null): ChartPoint[] {
  const shown = rowsInRange(rows, range)
  const now = shown[shown.length - 1]
  if (!now || !pace) return []
  const openOf = (r: HourRow): number => (measure === 'points' ? r.pts : r.open)
  const points: ChartPoint[] = shown.map((r) => ({ t: r.end, open: openOf(r), noNew: null, atPace: null }))
  const last = points[points.length - 1]!
  last.noNew = pace.open
  last.atPace = pace.open
  const reach = Math.max(12 * HOUR_MS, (now.end - shown[0]!.end + HOUR_MS) * 0.75)
  const edge = now.end + reach
  const at = (perDay: number, t: number): number => Math.max(0, pace.open + (perDay * (t - now.end)) / DAY_MS)
  const zeroAt = (perDay: number): number | null => (perDay < 0 ? now.end + (pace.open / -perDay) * DAY_MS : null)
  const noNewEnd = Math.min(zeroAt(-pace.closedPerDay) ?? edge, edge)
  const paceEnd = Math.min(zeroAt(pace.netPerDay) ?? edge, edge)
  const stops = [...new Set([noNewEnd, paceEnd])].sort((a, b) => a - b)
  for (const t of stops) {
    points.push({
      t,
      open: null,
      noNew: t <= noNewEnd ? round1(at(-pace.closedPerDay, t)) : null,
      atPace: t <= paceEnd ? round1(at(pace.netPerDay, t)) : null,
    })
  }
  return points
}

/** The app calendar's offset at an instant, in milliseconds east of UTC. */
export function appTzOffsetMs(ms: number): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(ms))
  const n = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - Math.floor(ms / 1000) * 1000
}

export interface WaveBin {
  start: number
  end: number
  added: number
  closed: number
  partial: boolean
}

/** The widest column that still shows waves: an hour for a day or three, then three hours, six, and a day. */
export function waveHours(range: BurndownRange, rowCount: number): 1 | 3 | 6 | 24 {
  const hours = RANGE_HOURS[range] ?? rowCount
  if (hours <= 72) return 1
  if (hours <= 168) return 3
  if (hours <= 336) return 6
  return 24
}

/** What came in and what closed, in columns of `bin` hours of the app calendar's day. */
export function waveBins(rows: readonly HourRow[], range: BurndownRange, measure: BurndownMeasure, bin: number): WaveBin[] {
  const out: WaveBin[] = []
  let key: number | null = null
  for (const r of rowsInRange(rows, range)) {
    const k = Math.floor((r.start + appTzOffsetMs(r.start)) / (bin * HOUR_MS))
    let b = out[out.length - 1]
    if (k !== key || !b) {
      b = { start: r.start, end: r.end, added: 0, closed: 0, partial: false }
      out.push(b)
      key = k
    }
    b.end = r.end
    b.added += measure === 'points' ? r.addedPts : r.added
    b.closed += measure === 'points' ? r.burnedPts : r.closed
    if (r.partial) b.partial = true
  }
  return out
}

export interface StageRow {
  group: BoardGroup
  label: string
  cards: number
  points: number
  /** Cards that left the stage in the stretch, closed or moved on. */
  left: number
  perDay: number
  /** Whole days until the stage empties at that rate with nothing new; null when nothing left it. */
  days: number | null
  clearMs: number | null
  /** The stage's open cards (or points) at each hour's end in the stretch, for its small line. */
  line: number[]
}

/** Each stage now, and how fast it drains over the stretch. */
export function stageRows(rows: readonly HourRow[], cards: readonly HistoryCard[], range: BurndownRange, measure: BurndownMeasure): StageRow[] {
  const whole = rows.filter((r) => !r.partial)
  const hours = RANGE_HOURS[range]
  const win = hours === null ? whole : whole.slice(-hours)
  const shown = rowsInRange(rows, range)
  const nowEnd = rows[rows.length - 1]?.end ?? 0
  return BOARD_GROUPS.map((group, k) => {
    const mine = cards.filter((c) => c.g === group)
    const left = win.reduce((a, r) => a + (r.left[k] ?? 0), 0)
    const perDay = win.length ? left / (win.length / 24) : 0
    const days = perDay > 0 && mine.length > 0 ? Math.ceil(mine.length / perDay) : null
    return {
      group,
      label: GROUP_LABELS[group],
      cards: mine.length,
      points: mine.reduce((a, c) => a + c.p, 0),
      left,
      perDay: round1(perDay),
      days,
      clearMs: days === null ? null : nowEnd + days * DAY_MS,
      line: shown.map((r) => (measure === 'points' ? r.ptsByGroup[k] : r.byGroup[k]) ?? 0),
    }
  })
}

const fmt = (opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, ...opts })

/** *Nov 25*, with the year when it is not this one. */
export function dayWords(ms: number, nowMs: number = Date.now()): string {
  const year = (t: number): string => fmt({ year: 'numeric' }).format(new Date(t))
  return fmt(year(ms) === year(nowMs) ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(ms))
}

/** *Nov 12, 2 PM*. */
export function hourWords(ms: number): string {
  return fmt({ month: 'short', day: 'numeric', hour: 'numeric' }).format(new Date(ms))
}

/** An axis tick: the day at the app calendar's midnight, the hour otherwise. */
export function tickWords(ms: number): string {
  const hour = fmt({ hour: 'numeric', hourCycle: 'h23' }).format(new Date(ms))
  return Number(hour) % 24 === 0 ? fmt({ month: 'short', day: 'numeric' }).format(new Date(ms)) : fmt({ hour: 'numeric' }).format(new Date(ms))
}

/**
 * The chart's ticks between two instants: every six hours for two days, then a day, two days, a week
 * and two weeks as the span grows, each on the app calendar's midnight (or a six-hour mark of its day).
 */
export function axisTicks(startMs: number, endMs: number): number[] {
  const span = endMs - startMs
  const step = span <= 2 * DAY_MS ? 6 * HOUR_MS : span <= 6 * DAY_MS ? DAY_MS : span <= 16 * DAY_MS ? 2 * DAY_MS : span <= 40 * DAY_MS ? 7 * DAY_MS : 14 * DAY_MS
  const out: number[] = []
  const off = appTzOffsetMs(startMs)
  for (let local = Math.ceil((startMs + off) / step) * step; local - off <= endMs; local += step) {
    const t = local - off
    out.push(t - (appTzOffsetMs(t) - off))
  }
  return out
}

export function countWords(n: number, measure: BurndownMeasure): string {
  const noun = measure === 'points' ? 'point' : 'card'
  return `${n.toLocaleString('en-US')} ${noun}${Math.abs(n) === 1 ? '' : 's'}`
}

/** A signed figure with an ASCII minus, so a reader can copy it. */
export function signedWords(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toLocaleString('en-US', { maximumFractionDigits: 1 })}`
}

/**
 * The sentences over the chart: what is open, what the stretch did, and when the list clears.
 * `held` is the open cards waiting on an owner decision or on time, which no building pace closes.
 */
export function takeawayWords(input: { cards: Pace; points: Pace; held: number; firstMs: number | null; nowMs: number }): string[] {
  const { cards, points, held, firstMs, nowMs } = input
  const stretch = rangeWords(cards.range, firstMs)
  const lead = `${stretch.charAt(0).toUpperCase()}${stretch.slice(1)}`
  const out = [`${countWords(cards.open, 'cards')} are open, ${countWords(points.open, 'points')} of work.`]
  const moved = `${lead} ${countWords(cards.closed, 'cards')} closed and ${cards.added.toLocaleString('en-US')} new ones came in`
  out.push(cards.netPerDay < 0 ? `${moved}, so the list is shrinking.` : cards.netPerDay > 0 ? `${moved}, so the list is growing.` : `${moved}, so the list is holding level.`)
  if (cards.clearNoNewMs !== null) out.push(`With no new cards it clears by ${dayWords(cards.clearNoNewMs, nowMs)}.`)
  else out.push(`Nothing closed ${stretch}, so there is no pace to read.`)
  if (cards.clearAtPaceMs !== null) out.push(`At this pace it clears by ${dayWords(cards.clearAtPaceMs, nowMs)}.`)
  else if (cards.clearNoNewMs !== null) out.push(`At this pace it does not clear, because new cards arrive ${cards.netPerDay > 0 ? 'faster than' : 'as fast as'} old ones close.`)
  if (held > 0) out.push(`${countWords(held, 'cards')} wait on an owner decision or on time, so building alone cannot clear them.`)
  return out
}

/** The open cards a building pace cannot close: the ones waiting on an owner decision or on time. */
export function heldCount(cards: readonly HistoryCard[]): number {
  return cards.filter((c) => c.g === 'gated' || c.g === 'waiting').length
}

/** The stage that empties last at its own rate, in words; empty when no stage has a rate. */
export function slowestStageWords(stages: readonly StageRow[], range: BurndownRange, firstMs: number | null, nowMs: number): string {
  const timed = stages.filter((s) => s.days !== null && s.clearMs !== null).sort((a, b) => (b.days ?? 0) - (a.days ?? 0))
  const stuck = stages.filter((s) => s.cards > 0 && s.days === null)
  const parts: string[] = []
  const first = timed[0]
  if (first && first.days !== null && first.clearMs !== null) {
    parts.push(`At the rate cards left each stage ${rangeWords(range, firstMs)}, the last to clear is ${first.label}, in ${first.days.toLocaleString('en-US')} days, about ${dayWords(first.clearMs, nowMs)}.`)
  }
  if (stuck.length > 0) {
    parts.push(`No card left ${stuck.map((s) => s.label).join(' or ')} ${rangeWords(range, firstMs)}, so ${stuck.length === 1 ? 'that stage has' : 'those stages have'} no rate yet.`)
  }
  return parts.join(' ')
}
