/**
 * The calendar beside the orders (the procurement log redraw, PR 3; its card was PR #4527): one line of weeks, and each order's
 * place on it as plain data. An order to place is a diamond at its order-by date, an order
 * placed is a bar from the day it was ordered to the day it lands, a fixture that waits is an
 * open diamond at the day the GC must answer by; each runs on to a tick at the day the job
 * needs it. Pure: the panel draws these.
 */
import { addDays, approveBy, daysBetween, parseIsoDate, PROCUREMENT_STAGE_LABELS, shortDate, type ProcurementRow, type ProcurementStage, type StageDates } from './procurementLog'
import type { OrderGroup } from './procurementOrders'

/** The line of weeks never runs longer than this: a job needed months out would squeeze this month's orders into a sliver. */
export const CALENDAR_MAX_DAYS = 26 * 7
const LEAD_IN_DAYS = 7
const TAIL_DAYS = 5
/** Past this many Mondays the header names every second one. */
const WEEKS_BEFORE_THINNING = 14

export type CalendarAxis = {
  start: string
  end: string
  days: number
  /** Where today's line stands, 0–100. */
  today: number
  /** The Mondays the header names ("11/2"); one within three days of today gives way to today's own label. */
  weeks: Array<{ iso: string; label: string; at: number }>
  /** Each stage at the day the job needs it; `flip` writes the name to the left of its line, near the right edge. */
  stages: Array<{ stage: ProcurementStage; label: string; iso: string; at: number; flip: boolean }>
  /** The latest date ran past the cap, so the line of weeks stops short of it. */
  capped: boolean
}

const STAGE_ORDER: ReadonlyArray<ProcurementStage> = ['rough_in', 'top_out', 'trim_set']
const monthDay = (iso: string) => {
  const d = parseIsoDate(iso)
  return d ? `${d.getMonth() + 1}/${d.getDate()}` : ''
}

/** The dates a line puts on the calendar: none once it is on site. */
function placedDates(r: ProcurementRow): string[] {
  if (r.status === 'delivered') return []
  const out: Array<string | null> = []
  if (r.status === 'released') out.push(r.orderBy)
  else if (r.status === 'ordered') out.push(r.expectedOn)
  else if (r.status === 'awaiting' || r.status === 'not_submitted') out.push(approveBy(r))
  return out.filter((d): d is string => !!d)
}

/**
 * The line of weeks, or null when no part that is not on site has a date to place (an order-by
 * date, an arrival, a day the GC must answer by): a calendar with nothing on it is not drawn.
 * It starts seven days before today and ends five days after the latest date among those parts,
 * their needed dates included, capped at 26 weeks.
 */
export function calendarAxis(rows: ReadonlyArray<ProcurementRow>, stageDates: StageDates, asOf: string): CalendarAxis | null {
  const marks = rows.flatMap(placedDates)
  if (marks.length === 0) return null
  const needed = rows.filter((r) => placedDates(r).length > 0).map((r) => r.requiredOn).filter((d): d is string => !!d)
  const latest = [...marks, ...needed, asOf].sort().pop()!
  const start = addDays(asOf, -LEAD_IN_DAYS)
  const wanted = addDays(latest, TAIL_DAYS)
  const capped = (daysBetween(start, wanted) ?? 0) > CALENDAR_MAX_DAYS
  const end = capped ? addDays(start, CALENDAR_MAX_DAYS) : wanted
  const days = daysBetween(start, end) ?? 1
  const at = (iso: string) => ((daysBetween(start, iso) ?? 0) / days) * 100
  const mondays: string[] = []
  for (let i = 0; i <= days; i += 1) {
    const iso = addDays(start, i)
    if (parseIsoDate(iso)?.getDay() === 1) mondays.push(iso)
  }
  const step = mondays.length > WEEKS_BEFORE_THINNING ? 2 : 1
  const weeks = mondays.filter((_, i) => i % step === 0).filter((iso) => Math.abs(daysBetween(asOf, iso) ?? 99) > 3).map((iso) => ({ iso, label: monthDay(iso), at: at(iso) }))
  const stages = STAGE_ORDER.flatMap((stage) => {
    const iso = stageDates[stage]
    if (!iso) return []
    const p = at(iso)
    return p < 0 || p > 100 ? [] : [{ stage, label: PROCUREMENT_STAGE_LABELS[stage], iso, at: p, flip: p > 80 }]
  })
  return { start, end, days, today: at(asOf), weeks, stages, capped }
}

export type CalendarDiamond = { at: number; tone: 'go' | 'soon' | 'past' | 'ask'; title: string }
export type CalendarSpan = { from: number; to: number }
export type CalendarMark = {
  /** Order by (filled) or the GC must answer by (open); absent when it falls off the line of weeks. */
  diamond: CalendarDiamond | null
  /** On order: from the day it was ordered to the day it lands, or to the needed day when it lands late. */
  bar: (CalendarSpan & { /** it began before the line of weeks: cut square at the left edge */ clipped: boolean }) | null
  /** The part of the wait that runs past the needed day. */
  lateBar: CalendarSpan | null
  /** The quiet run on to the needed day. */
  dotted: CalendarSpan | null
  /** Needed on the job. */
  tick: { at: number; title: string } | null
  /** The mark in words, for a reader who cannot see it. */
  words: string
}

/**
 * One order's mark. An order to place: a diamond at its order-by date (amber inside three days,
 * red once past), a dotted line to the tick at the needed date. An order placed: a bar from the
 * ordered date to the expected one and a dotted line on to the tick; late, the bar is blue up to
 * the tick and red past it. A fixture that waits: an open diamond at the day the GC must answer
 * by. A part sent back and an order on site carry none.
 */
export function groupMark(group: Pick<OrderGroup, 'kind' | 'rows' | 'tone'>, axis: CalendarAxis, asOf: string): CalendarMark | null {
  const raw = (iso: string) => ((daysBetween(axis.start, iso) ?? 0) / axis.days) * 100
  const clamp = (p: number) => Math.min(100, Math.max(0, p))
  const inside = (p: number) => p >= 0 && p <= 100
  const span = (a: string, b: string): CalendarSpan | null => {
    const from = clamp(raw(a))
    const to = clamp(raw(b))
    return to > from ? { from, to } : null
  }
  const earliest = (dates: Array<string | null>) => dates.filter((d): d is string => !!d).sort()[0] ?? null
  const tickAt = (needed: string | null) => (needed && inside(raw(needed)) ? { at: raw(needed), title: `needed on the job ${shortDate(needed)}` } : null)
  const none: CalendarMark = { diamond: null, bar: null, lateBar: null, dotted: null, tick: null, words: '' }

  if (group.kind === 'to_place') {
    const orderBy = earliest(group.rows.map((r) => r.orderBy))
    if (!orderBy) return null
    const needed = earliest(group.rows.map((r) => r.requiredOn))
    const n = daysBetween(asOf, orderBy) ?? 99
    const tone = n < 0 ? 'past' : n <= 3 ? 'soon' : 'go'
    return { ...none, diamond: inside(raw(orderBy)) ? { at: raw(orderBy), tone, title: `order by ${shortDate(orderBy)}` } : null, dotted: needed ? span(orderBy, needed) : null, tick: tickAt(needed), words: `order by ${shortDate(orderBy)}${needed ? `, needed ${shortDate(needed)}` : ''}` }
  }
  if (group.kind === 'placed') {
    const ordered = earliest(group.rows.map((r) => r.orderedOn))
    // The part that decides the order: the latest to land, the late one when any is late.
    const worst = [...group.rows].filter((r) => r.expectedOn).sort((a, b) => Number(b.late) - Number(a.late) || (b.expectedOn ?? '').localeCompare(a.expectedOn ?? ''))[0]
    if (!ordered || !worst?.expectedOn) return null
    const expected = worst.expectedOn
    const needed = worst.requiredOn
    const late = !!needed && expected > needed
    const blue = span(ordered, late ? needed! : expected)
    return {
      ...none,
      bar: blue ? { ...blue, clipped: raw(ordered) < 0 } : null,
      lateBar: late ? span(needed!, expected) : null,
      dotted: !late && needed ? span(expected, needed) : null,
      tick: tickAt(needed),
      words: `ordered ${shortDate(ordered)}, arrives ${shortDate(expected)}${needed ? `, needed ${shortDate(needed)}${late ? `, ${daysBetween(needed, expected)} days late` : ''}` : ''}`,
    }
  }
  if (group.kind === 'fixture') {
    // The part whose answer is due first sets the fixture's mark.
    const first = [...group.rows].filter((r) => approveBy(r)).sort((a, b) => approveBy(a)!.localeCompare(approveBy(b)!))[0]
    if (!first) return null
    const ask = approveBy(first)!
    return { ...none, diamond: inside(raw(ask)) ? { at: raw(ask), tone: 'ask', title: `the GC must answer by ${shortDate(ask)}` } : null, dotted: first.requiredOn ? span(ask, first.requiredOn) : null, tick: tickAt(first.requiredOn), words: `the GC must answer by ${shortDate(ask)}, needed ${shortDate(first.requiredOn)}` }
  }
  return null
}
