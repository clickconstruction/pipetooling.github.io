/**
 * Checklist "cost" system (dev-only): pure math for a task's estimated labor
 * cost — one person, their hourly rate (from People Pay config), and an
 * estimated hour count. Rates are snapshotted onto the estimate at entry time
 * so later pay changes don't silently rewrite history.
 */

export type ChecklistCostEstimate = {
  /** users.id of the person the estimate is costed against (null = manual). */
  userId: string | null
  /** Display name at entry time (rate lookups are name-keyed in pay config). */
  personName: string
  /** Estimated hours to do the task. */
  hours: number
  /** $/hr snapshot used for the math. */
  rate: number
  updatedAt: string
}

/** Whole-dollar cost of one estimate. */
export function estimateDollars(e: Pick<ChecklistCostEstimate, 'hours' | 'rate'>): number {
  if (!Number.isFinite(e.hours) || !Number.isFinite(e.rate)) return 0
  return Math.round(e.hours * e.rate)
}

/** `$1,234` — whole dollars, no cents (chip real estate is tiny). */
export function formatWholeDollars(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** Sum of whole-dollar costs across estimates (undefined entries skipped). */
export function sumEstimateDollars(
  estimates: ReadonlyArray<Pick<ChecklistCostEstimate, 'hours' | 'rate'> | undefined>,
): number {
  let total = 0
  for (const e of estimates) {
    if (e) total += estimateDollars(e)
  }
  return total
}

export type OpenCostSummary = {
  /** Whole-dollar sum of the estimates that exist. */
  dollars: number
  /** How many of the open tasks have an estimate. */
  costed: number
  /** Total open tasks considered. */
  total: number
}

/**
 * Roll up open (not-done) tasks' estimates for a stage or roadmap total.
 * `costed < total` means the sum is a floor, not the full cost — render it
 * with a trailing `+` so a half-costed stage never reads as fully priced.
 */
export function summarizeOpenTaskCosts(
  openCostKeys: readonly string[],
  estimates: Record<string, Pick<ChecklistCostEstimate, 'hours' | 'rate'>>,
): OpenCostSummary {
  let dollars = 0
  let costed = 0
  for (const key of openCostKeys) {
    const e = estimates[key]
    if (e) {
      dollars += estimateDollars(e)
      costed += 1
    }
  }
  return { dollars, costed, total: openCostKeys.length }
}

/** `$210` when every open task is costed, `$210+` when the sum is a floor. */
export function formatOpenCostSummary(s: OpenCostSummary): string {
  return `${formatWholeDollars(s.dollars)}${s.costed < s.total ? '+' : ''}`
}

/**
 * Who sees the cost lens (chips, totals, the estimator). Estimates derive
 * from payroll wages, so this mirrors the `checklist_item_costs` RLS:
 * dev or controller — deliberately not `has_payroll_access()`, which would
 * also include pay-approved masters.
 */
export function canSeeTaskCosts(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'controller'
}
