/**
 * The stage calendar (v2.2963): a window seen on the months it touches, with
 * the sub's pick, the GC's ask, today, the sub's days off and the job's other
 * stages as flags on each day cell. Pure day math on YYYY-MM-DD strings;
 * Monday-first weeks.
 */
import type { StageWindowSpan } from './stageWindow'

export type CalendarDay = {
  ymd: string
  day: number
  /** Belongs to the month being drawn (else a leading/trailing day, dimmed). */
  inMonth: boolean
  weekend: boolean
  today: boolean
  /** Inside our window. */
  window: boolean
  /** Our window is entirely behind today. */
  passed: boolean
  /** Inside the sub's pick. */
  pick: boolean
  /** Inside the GC's open ask. */
  ask: boolean
  /** The sub marked this day off. */
  off: boolean
  /** Inside another stage's window on the same job. */
  sibling: boolean
  /** Inside another stage's pick on the same job. */
  siblingPick: boolean
}

export type CalendarInput = {
  todayYmd: string
  window: StageWindowSpan | null
  pick?: StageWindowSpan | null
  ask?: StageWindowSpan | null
  offDays?: readonly string[]
  siblings?: readonly StageWindowSpan[]
  siblingPicks?: readonly StageWindowSpan[]
}

const dayOf = (ymd: string): Date => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!))
}
const ymdOf = (d: Date): string => d.toISOString().slice(0, 10)
const inSpan = (ymd: string, s: StageWindowSpan | null | undefined): boolean => !!s && ymd >= s.start && ymd <= s.end
const inAny = (ymd: string, spans: readonly StageWindowSpan[] | undefined): boolean => !!spans && spans.some((s) => inSpan(ymd, s))

/** `YYYY-MM` for a day. */
export const monthOfDay = (ymd: string): string => ymd.slice(0, 7)

/** The months to draw: every month the window, pick and ask touch (in order), else today's month. Capped at three. */
export function calendarMonthsFor(input: Pick<CalendarInput, 'window' | 'pick' | 'ask' | 'todayYmd'>): string[] {
  const spans = [input.window, input.pick, input.ask].filter((s): s is StageWindowSpan => !!s)
  if (spans.length === 0) return [monthOfDay(input.todayYmd)]
  let lo = spans[0]!.start
  let hi = spans[0]!.end
  for (const s of spans) {
    if (s.start < lo) lo = s.start
    if (s.end > hi) hi = s.end
  }
  const out: string[] = []
  const d = dayOf(`${monthOfDay(lo)}-01`)
  const last = monthOfDay(hi)
  while (out.length < 3) {
    const m = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    out.push(m)
    if (m === last) break
    d.setUTCMonth(d.getUTCMonth() + 1)
  }
  return out
}

/** The 35 or 42 cells of a Monday-first month grid, flagged. */
export function calendarDays(month: string, input: CalendarInput): CalendarDay[] {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(Date.UTC(y!, m! - 1, 1))
  const startDow = (first.getUTCDay() + 6) % 7 // Monday = 0
  const start = new Date(first)
  start.setUTCDate(1 - startDow)
  const passed = !!input.window && input.window.end < input.todayYmd
  const daysInMonth = new Date(Date.UTC(y!, m!, 0)).getUTCDate()
  const cells = startDow + daysInMonth > 35 ? 42 : 35
  const out: CalendarDay[] = []
  for (let i = 0; i < cells; i += 1) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    const inMonth = d.getUTCMonth() === m! - 1
    const ymd = ymdOf(d)
    const dow = d.getUTCDay()
    // Leading / trailing days of the neighbouring month are dimmed context: no flags, so a day is never marked twice across two grids.
    out.push({
      ymd,
      day: d.getUTCDate(),
      inMonth,
      weekend: dow === 0 || dow === 6,
      today: inMonth && ymd === input.todayYmd,
      window: inMonth && inSpan(ymd, input.window),
      passed,
      pick: inMonth && inSpan(ymd, input.pick),
      ask: inMonth && inSpan(ymd, input.ask),
      off: inMonth && !!input.offDays && input.offDays.includes(ymd),
      sibling: inMonth && inAny(ymd, input.siblings),
      siblingPick: inMonth && inAny(ymd, input.siblingPicks),
    })
  }
  return out
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** "September 2026" */
export function calendarMonthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${MONTHS[(m ?? 1) - 1]} ${y}`
}

/** Weekdays inside a span (Mon–Fri) — "9 working days". */
export function workingDaysIn(span: StageWindowSpan): number {
  let n = 0
  for (let d = dayOf(span.start); ymdOf(d) <= span.end; d.setUTCDate(d.getUTCDate() + 1)) {
    const w = d.getUTCDay()
    if (w !== 0 && w !== 6) n += 1
  }
  return n
}
