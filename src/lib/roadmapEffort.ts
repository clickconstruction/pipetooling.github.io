/**
 * Roadmap effort kernels (v2.2358): a task's estimated_days is its WEIGHT,
 * never its dates. The Timeline's x-axis stays dependency sequence and its
 * calendar stays derived from observed pace — these helpers just convert
 * task counts into days-of-work. An unestimated task weighs the roadmap's
 * average estimate, so estimating only the big rocks already improves the
 * forecast; with no estimates anywhere every weight is 1 and all the math
 * reduces bit-for-bit to the old tasks/week behavior.
 */

export type EffortTask = { completed_at: string | null; estimated_days?: number | null }

/** Mean of the set estimates; 1 when nothing is estimated (weight = "one average task"). */
export function averageEstimatedDays(tasks: ReadonlyArray<EffortTask>): number {
  const set = tasks.map((t) => t.estimated_days).filter((d): d is number => d != null && Number.isFinite(d) && d > 0)
  if (set.length === 0) return 1
  return set.reduce((a, b) => a + b, 0) / set.length
}

/** A task's weight in days: its estimate, else the roadmap average. */
export function taskWeightDays(t: EffortTask, avg: number): number {
  const d = t.estimated_days
  return d != null && Number.isFinite(d) && d > 0 ? d : avg
}

/** "5d" / "2.5d" — one decimal, no trailing .0. */
export function effortDaysLabel(days: number): string {
  const rounded = Math.round(days * 10) / 10
  return `${rounded}d`
}

/** "≈ 140d" for sums — whole days, since sums of averages carry false precision. */
export function effortSumLabel(days: number): string {
  return `≈ ${Math.round(days)}d`
}

export type ObservedEffortPace = {
  daysPerWeek: number
  /** 'recent' = completions in the window; 'allTime' = none recent, so total ÷ weeks since first. */
  basis: 'recent' | 'allTime'
}

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

/**
 * Effort-weighted twin of roadmapCalendar's observedPace: estimated days
 * completed per week instead of task tallies. Same window rules — recent
 * 4 weeks, all-time fallback, null before any completion. Old completed
 * tasks are typically unestimated → they weigh the average → the pace is
 * consistent in units from the moment estimates start existing.
 */
export function observedEffortPace(
  tasks: ReadonlyArray<EffortTask>,
  now: Date,
  windowDays = 28,
): ObservedEffortPace | null {
  const avg = averageEstimatedDays(tasks)
  const done = tasks
    .map((t) => ({ at: t.completed_at == null ? NaN : new Date(t.completed_at).getTime(), w: taskWeightDays(t, avg) }))
    .filter((d) => Number.isFinite(d.at) && d.at <= now.getTime())
  if (done.length === 0) return null
  const windowWeeks = windowDays / 7
  const recent = done.filter((d) => d.at > now.getTime() - windowDays * DAY_MS)
  if (recent.length > 0) {
    return { daysPerWeek: recent.reduce((a, d) => a + d.w, 0) / windowWeeks, basis: 'recent' }
  }
  const weeks = Math.max((now.getTime() - Math.min(...done.map((d) => d.at))) / WEEK_MS, 1)
  return { daysPerWeek: done.reduce((a, d) => a + d.w, 0) / weeks, basis: 'allTime' }
}
