/**
 * Roadmap calendar-header kernels (v2.2089): the Timeline's top band. The
 * pace is OBSERVED, not chosen — tasks completed in the last 4 weeks (all-time
 * fallback) — and the band lays real months across the top with a today tick
 * and a 🎯 flag where the remaining work lands at that pace. Replaces the
 * tasks/week slider, which asked the user to invent a number.
 */

import { approxDateLabel } from './roadmapTimeline'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

export type ObservedPace = {
  tasksPerWeek: number
  /** 'recent' = completions in the window; 'allTime' = none recent, so total ÷ weeks since first. */
  basis: 'recent' | 'allTime'
}

/**
 * Real completion pace from `completed_at` stamps: completions inside the
 * window ÷ window weeks; with none recent, all-time average since the first
 * completion; null when nothing was ever completed (no honest pace exists).
 */
export function observedPace(
  tasks: ReadonlyArray<{ completed_at: string | null }>,
  now: Date,
  windowDays = 28,
): ObservedPace | null {
  const doneAt = tasks
    .map((t) => (t.completed_at == null ? NaN : new Date(t.completed_at).getTime()))
    .filter((t) => Number.isFinite(t) && t <= now.getTime())
  if (doneAt.length === 0) return null
  const windowWeeks = windowDays / 7
  const recent = doneAt.filter((t) => t > now.getTime() - windowDays * DAY_MS).length
  if (recent > 0) return { tasksPerWeek: recent / windowWeeks, basis: 'recent' }
  const weeks = Math.max((now.getTime() - Math.min(...doneAt)) / WEEK_MS, 1)
  return { tasksPerWeek: doneAt.length / weeks, basis: 'allTime' }
}

/** "7" / "2.5" / "0.3" — one decimal, no trailing .0. */
export function paceLabel(tasksPerWeek: number): string {
  const rounded = Math.round(tasksPerWeek * 10) / 10
  return String(rounded)
}

export type CalendarMonth = { label: string; left: number; width: number }
export type CalendarMarker = { index: number; left: number }
export type CalendarBand = {
  months: CalendarMonth[]
  /** Fraction of band width; always renderable. */
  todayLeft: number
  /** today → goal span; null without a goal. */
  runway: { left: number; width: number } | null
  /** Intermediate wave finishes (projection indices 1..len-2) that are far enough apart to label. */
  markers: CalendarMarker[]
  goal: { left: number; label: string; clamped: boolean } | null
  /** End of the visible range — lets the view say what pace would finish inside it. */
  horizonEnd: Date
}

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)

/**
 * Month geometry for the band, all values fractions of its width. Range:
 * start of the current month through the goal month (≥3 months so the band
 * never collapses, ≤maxMonths so a far goal pins to the right edge with its
 * true label instead of squeezing a year of months into the strip).
 */
export function calendarBand(
  projection: ReadonlyArray<{ finish: Date; remainingTasks: number }>,
  now: Date,
  maxMonths = 12,
): CalendarBand {
  const goalDate = projection.length > 0 ? projection[projection.length - 1]!.finish : null
  const start = startOfMonth(now)
  const monthsToGoal = goalDate == null ? 0 : (goalDate.getFullYear() - start.getFullYear()) * 12 + goalDate.getMonth() - start.getMonth() + 1
  const monthCount = Math.min(Math.max(monthsToGoal, 3), maxMonths)
  const end = addMonths(start, monthCount)
  const span = end.getTime() - start.getTime()
  const frac = (t: number) => Math.min(Math.max((t - start.getTime()) / span, 0), 1)

  const months: CalendarMonth[] = []
  for (let i = 0; i < monthCount; i++) {
    const m = addMonths(start, i)
    const label =
      m.toLocaleString('en-US', { month: 'short' }) +
      (m.getFullYear() === now.getFullYear() ? '' : ` '${String(m.getFullYear()).slice(2)}`)
    months.push({ label, left: frac(m.getTime()), width: frac(addMonths(start, i + 1).getTime()) - frac(m.getTime()) })
  }

  const todayLeft = frac(now.getTime())
  const clamped = goalDate != null && goalDate.getTime() > end.getTime()
  const goalLeft = goalDate == null ? null : clamped ? 0.98 : frac(goalDate.getTime())
  const goal =
    goalDate == null || goalLeft == null ? null : { left: goalLeft, label: approxDateLabel(goalDate, now), clamped }

  const markers: CalendarMarker[] = []
  const minGap = 0.035
  let lastLeft = todayLeft
  for (let i = 1; i <= projection.length - 2; i++) {
    const left = frac(projection[i]!.finish.getTime())
    if (left - lastLeft < minGap) continue
    if (goalLeft != null && goalLeft - left < minGap) continue
    markers.push({ index: i, left })
    lastLeft = left
  }

  return {
    months,
    todayLeft,
    runway: goalLeft == null ? null : { left: todayLeft, width: Math.max(goalLeft - todayLeft, 0) },
    markers,
    goal,
    horizonEnd: end,
  }
}
