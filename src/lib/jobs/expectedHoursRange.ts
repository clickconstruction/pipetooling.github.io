/**
 * The slider is the budget's range (punch list #242, PR 1). The expected hours are set
 * on a slider whose floor is the hours already in and whose ceiling is the labor budget's
 * edge: past the edge is over budget and there is nothing to set there; under it is the
 * point. Steps are one crew day where the job has read one. A job at or over the edge
 * (within an hour counts, since a one-hour slider sets nothing) is pinned, and the words
 * say the budget is the lever now. The board's slider, its − / + presses and its typed box
 * all clamp to this one range. Pure.
 */
export type ExpectedHoursRange = {
  /** The hours already in, floored; never past the ceiling. */
  min: number
  /** The labor budget's edge, rounded; at least 1 so the control exists. */
  max: number
  /** One crew day when the job has read one, else one hour. */
  step: number
  /** True when the hours in are at or past the budget's edge: the slider sets nothing. */
  pinned: boolean
  /** *Over the labor budget by N h.* or *At the labor budget's edge.* while pinned; null while the range is open. */
  pinnedWords: string | null
}

/** The second sentence under a pinned slider. */
export const EXPECTED_HOURS_LEVER_WORDS = 'The budget is the lever now, on the Costs tab, not the target.'

export function expectedHoursRange(i: { hoursUsed: number; budgetHours: number; crewDay: number; crewDayRead: boolean }): ExpectedHoursRange {
  const used = Math.max(0, Number.isFinite(i.hoursUsed) ? i.hoursUsed : 0)
  const budget = Math.max(0, Number.isFinite(i.budgetHours) ? i.budgetHours : 0)
  const max = Math.max(1, Math.round(budget))
  const min = Math.min(max, Math.floor(used))
  const pinned = budget > 0 && used + 1 > budget
  const overBy = Math.max(0, Math.round(used - budget))
  const pinnedWords = pinned ? (overBy > 0 ? `Over the labor budget by ${overBy} h.` : 'At the labor budget’s edge.') : null
  const step = i.crewDayRead ? Math.max(1, Math.round(i.crewDay)) : 1
  return { min, max, step, pinned, pinnedWords }
}

/** A dragged, pressed or typed number held inside the range. */
export function clampExpectedHours(hours: number, r: ExpectedHoursRange): number {
  const n = Number.isFinite(hours) ? Math.round(hours) : r.max
  return Math.max(r.min, Math.min(r.max, n))
}
