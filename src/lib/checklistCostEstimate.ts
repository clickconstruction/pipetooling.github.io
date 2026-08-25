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
  /**
   * How long it really took (hours), recorded at sign-off or after the fact.
   * null/undefined = no actual yet; untouched sign-offs record nothing.
   */
  actualHours?: number | null
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

/** Whole-dollar actual cost, or null when no actual is recorded. */
export function actualDollars(
  e: Pick<ChecklistCostEstimate, 'actualHours' | 'rate'>,
): number | null {
  if (e.actualHours == null || !Number.isFinite(e.actualHours) || e.actualHours <= 0) return null
  return Math.round(e.actualHours * e.rate)
}

/**
 * "Took about" quick-pick bands derived from the estimate — roughly half,
 * as-estimated, ×1.5, ×2 — snapped to half-hours, deduped, ascending, so a
 * 16h estimate offers 8/16/24/32 while a 1h one offers 0.5/1/1.5/2.
 */
export function estimateRelativeBands(estimateHours: number): number[] {
  if (!Number.isFinite(estimateHours) || estimateHours <= 0) return [0.5, 1, 2, 4]
  const snap = (x: number) => Math.max(0.5, Math.round(x * 2) / 2)
  const out: number[] = []
  for (const m of [0.5, 1, 1.5, 2]) {
    const v = snap(estimateHours * m)
    if (!out.includes(v)) out.push(v)
  }
  return out
}

export type EstimateAccuracy = {
  /** sum(actual hours) / sum(estimated hours) over rows with both. */
  multiplier: number
  /** How many estimates have an actual. */
  count: number
}

/** Overall calibration across every estimate that has an actual (hours-weighted). */
export function estimateAccuracy(
  estimates: ReadonlyArray<Pick<ChecklistCostEstimate, 'hours' | 'actualHours'>>,
): EstimateAccuracy | null {
  let est = 0
  let act = 0
  let count = 0
  for (const e of estimates) {
    if (e.actualHours == null || !(e.actualHours > 0) || !(e.hours > 0)) continue
    est += e.hours
    act += e.actualHours
    count += 1
  }
  if (count === 0 || est === 0) return null
  return { multiplier: act / est, count }
}

/** Per-person calibration (keyed by the estimate's personName), most-estimated first. */
export function estimateAccuracyByPerson(
  estimates: ReadonlyArray<Pick<ChecklistCostEstimate, 'hours' | 'actualHours' | 'personName'>>,
): Array<{ personName: string; multiplier: number; count: number }> {
  const byPerson = new Map<string, { est: number; act: number; count: number }>()
  for (const e of estimates) {
    if (e.actualHours == null || !(e.actualHours > 0) || !(e.hours > 0) || !e.personName) continue
    const cur = byPerson.get(e.personName) ?? { est: 0, act: 0, count: 0 }
    cur.est += e.hours
    cur.act += e.actualHours
    cur.count += 1
    byPerson.set(e.personName, cur)
  }
  return [...byPerson.entries()]
    .filter(([, v]) => v.est > 0)
    .map(([personName, v]) => ({ personName, multiplier: v.act / v.est, count: v.count }))
    .sort((a, b) => b.count - a.count)
}

/** "×1.6" — one decimal, the calibration voice everywhere. */
export function formatMultiplier(m: number): string {
  return `×${(Math.round(m * 10) / 10).toFixed(1)}`
}

/** Accuracy hints and the Review strip only speak once they mean something. */
export const ACCURACY_MIN_COUNT = 5
