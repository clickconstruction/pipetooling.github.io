/**
 * The week a person can work, drawn (design spike): seven days, Sunday first, each a list of
 * minute ranges on the company clock. "Off at 3 on Fridays" is Friday's range ending at 15:00.
 * The painter paints half-hour slots between 5 AM and 8 PM; this kernel turns slots into ranges
 * and back, totals the hours, says the week in words, and measures the minutes a clock session
 * fell outside the day's drawn hours. Pure.
 */
import { appTzWallTimeMs } from '../../utils/dateUtils'

/** Minutes from midnight on the company clock, end exclusive. */
export type Segment = [start: number, end: number]
/** Seven days, Sunday first. */
export type WeekDays = Segment[][]

export const SLOT_MINUTES = 30
export const PAINT_START_HOUR = 5
export const PAINT_END_HOUR = 20
export const PAINT_SLOTS = ((PAINT_END_HOUR - PAINT_START_HOUR) * 60) / SLOT_MINUTES
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MINUTES_IN_DAY = 24 * 60

/** The company day on the painter: 7 AM to 3 PM, Monday to Friday. */
export const DEFAULT_DAY: Segment[] = [[7 * 60, 15 * 60]]
export const DEFAULT_WEEK: WeekDays = [[], [...DEFAULT_DAY], [...DEFAULT_DAY], [...DEFAULT_DAY], [...DEFAULT_DAY], [...DEFAULT_DAY], []]

export function emptyWeek(): WeekDays {
  return [[], [], [], [], [], [], []]
}

/** Sorted, merged, clipped to the day; empty and backwards ranges dropped. */
export function normalizeSegments(segs: readonly Segment[]): Segment[] {
  const clean = segs
    .map(([s, e]): Segment => [Math.max(0, Math.min(MINUTES_IN_DAY, Math.round(s))), Math.max(0, Math.min(MINUTES_IN_DAY, Math.round(e)))])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0])
  const out: Segment[] = []
  for (const seg of clean) {
    const last = out[out.length - 1]
    if (last && seg[0] <= last[1]) last[1] = Math.max(last[1], seg[1])
    else out.push([seg[0], seg[1]])
  }
  return out
}

export function normalizeWeek(days: WeekDays): WeekDays {
  return Array.from({ length: 7 }, (_, d) => normalizeSegments(days[d] ?? []))
}

export function segmentsHours(segs: readonly Segment[]): number {
  return Math.round((segs.reduce((a, [s, e]) => a + Math.max(0, e - s), 0) / 60) * 10) / 10
}

export function weekHours(days: WeekDays): number {
  return Math.round(days.reduce((a, segs) => a + segmentsHours(segs), 0) * 10) / 10
}

export function dayHours(days: WeekDays, dow: number): number {
  return segmentsHours(days[dow] ?? [])
}

/** The week as JSON, or null when the shape is not seven days of [start, end] pairs. */
export function parseWeekDays(raw: unknown): WeekDays | null {
  if (!Array.isArray(raw) || raw.length !== 7) return null
  const days: WeekDays = []
  for (const day of raw) {
    if (!Array.isArray(day)) return null
    const segs: Segment[] = []
    for (const seg of day) {
      if (!Array.isArray(seg) || seg.length !== 2 || typeof seg[0] !== 'number' || typeof seg[1] !== 'number') return null
      segs.push([seg[0], seg[1]])
    }
    days.push(segs)
  }
  return normalizeWeek(days)
}

// ---------- slots (the painter's cells) ----------

export const slotStartMinutes = (slot: number): number => PAINT_START_HOUR * 60 + slot * SLOT_MINUTES

export function slotsFromSegments(segs: readonly Segment[]): boolean[] {
  const slots = new Array<boolean>(PAINT_SLOTS).fill(false)
  for (let i = 0; i < PAINT_SLOTS; i++) {
    const s = slotStartMinutes(i)
    const e = s + SLOT_MINUTES
    if (segs.some(([a, b]) => a < e && s < b)) slots[i] = true
  }
  return slots
}

export function segmentsFromSlots(slots: readonly boolean[]): Segment[] {
  const segs: Segment[] = []
  let open: number | null = null
  for (let i = 0; i <= slots.length; i++) {
    const on = i < slots.length && slots[i] === true
    if (on && open == null) open = slotStartMinutes(i)
    if (!on && open != null) {
      segs.push([open, slotStartMinutes(i)])
      open = null
    }
  }
  return segs
}

export type Cell = { day: number; slot: number }

/** Paint (or erase) the rectangle between two cells, the way a selection sweeps. */
export function paintRect(days: WeekDays, a: Cell, b: Cell, on: boolean): WeekDays {
  const d0 = Math.min(a.day, b.day)
  const d1 = Math.max(a.day, b.day)
  const s0 = Math.max(0, Math.min(a.slot, b.slot))
  const s1 = Math.min(PAINT_SLOTS - 1, Math.max(a.slot, b.slot))
  const next = normalizeWeek(days)
  for (let d = d0; d <= d1; d++) {
    const slots = slotsFromSegments(next[d]!)
    for (let s = s0; s <= s1; s++) slots[s] = on
    next[d] = segmentsFromSlots(slots)
  }
  return next
}

/** The day most of the week looks like: the commonest non-empty day, else the company day. */
export function typicalDay(days: WeekDays): Segment[] {
  const counts = new Map<string, { n: number; segs: Segment[] }>()
  for (const segs of days) {
    if (!segs.length) continue
    const key = JSON.stringify(segs)
    const hit = counts.get(key)
    if (hit) hit.n += 1
    else counts.set(key, { n: 1, segs: segs.map(([s, e]) => [s, e]) })
  }
  let best: { n: number; segs: Segment[] } | null = null
  for (const c of counts.values()) if (!best || c.n > best.n) best = c
  return best ? best.segs : DEFAULT_DAY.map(([s, e]) => [s, e])
}

/** A day header press: an off day takes the typical day; a day with hours goes off. */
export function toggleDay(days: WeekDays, dow: number): WeekDays {
  const next = normalizeWeek(days)
  next[dow] = next[dow]!.length ? [] : typicalDay(days)
  return next
}

export function setDayRange(days: WeekDays, dow: number, start: number, end: number): WeekDays {
  const next = normalizeWeek(days)
  next[dow] = normalizeSegments([[start, end]])
  return next
}

// ---------- words ----------

/** "7a", "3:30p", "12p", "12a" */
export function formatClockShort(min: number): string {
  const m = ((min % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY
  const h24 = Math.floor(m / 60)
  const mm = m % 60
  const suffix = h24 >= 12 ? 'p' : 'a'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return mm ? `${h12}:${String(mm).padStart(2, '0')}${suffix}` : `${h12}${suffix}`
}

/** "7a–3:30p" or "7a–11a, 1p–3p"; "off" for an empty day. */
export function describeSegments(segs: readonly Segment[]): string {
  if (!segs.length) return 'off'
  return segs.map(([s, e]) => `${formatClockShort(s)}–${formatClockShort(e)}`).join(', ')
}

const READING_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

/** The runs alone, for a table cell: "Mon–Thu 7a–3:30p, Fri 7a–3p". */
export function describeWeekShort(days: WeekDays): string {
  const full = describeWeek(days)
  return full.replace(/\. Off [^.]*\.$/, '').replace(/\.$/, '')
}

/** "Mon–Thu 7a–3:30p, Fri 7a–3p. Off Sat and Sun." Runs of like days read as a range. */
export function describeWeek(days: WeekDays): string {
  const norm = normalizeWeek(days)
  if (norm.every((d) => d.length === 0)) return 'No hours drawn yet.'
  const groups: { from: number; to: number; words: string }[] = []
  const off: string[] = []
  for (const dow of READING_ORDER) {
    const segs = norm[dow]!
    if (!segs.length) {
      off.push(WEEKDAY_SHORT[dow])
      continue
    }
    const words = describeSegments(segs)
    const last = groups[groups.length - 1]
    if (last && last.words === words && READING_ORDER.indexOf(last.to as (typeof READING_ORDER)[number]) === READING_ORDER.indexOf(dow) - 1) last.to = dow
    else groups.push({ from: dow, to: dow, words })
  }
  const parts = groups.map((g) => `${g.from === g.to ? WEEKDAY_SHORT[g.from] : `${WEEKDAY_SHORT[g.from]}–${WEEKDAY_SHORT[g.to]}`} ${g.words}`)
  let out = parts.join(', ') + '.'
  if (off.length) out += ` Off ${off.length === 1 ? off[0] : `${off.slice(0, -1).join(', ')} and ${off[off.length - 1]}`}.`
  return out
}

// ---------- the clock against the drawing ----------

/**
 * Minutes of a session that fell outside the day's drawn hours, on the company clock. A session
 * with no close counts to `nowMs`. A day with nothing drawn puts every minute outside.
 */
export function outsideMinutes(args: { ymd: string; inMs: number; outMs: number; segs: readonly Segment[] }): number {
  const { ymd, inMs, outMs, segs } = args
  if (!(outMs > inMs)) return 0
  let inside = 0
  for (const [s, e] of segs) {
    const ws = appTzWallTimeMs(ymd, Math.floor(s / 60), s % 60)
    const we = e >= MINUTES_IN_DAY ? appTzWallTimeMs(ymd, 23, 59, 59) + 1000 : appTzWallTimeMs(ymd, Math.floor(e / 60), e % 60)
    const lo = Math.max(inMs, ws)
    const hi = Math.min(outMs, we)
    if (hi > lo) inside += hi - lo
  }
  return Math.max(0, Math.round((outMs - inMs - inside) / 60_000))
}

/** The weekday (0 Sunday) of a company-calendar day. */
export function dowOfYmd(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay()
}
