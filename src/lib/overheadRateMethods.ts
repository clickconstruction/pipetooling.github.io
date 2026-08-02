/**
 * The "three lenses" overhead-rate kernel — ONE 90-day overhead pool
 * (office labor + bid labor + office parts) divided by three different
 * denominators:
 *
 * - **Method A** — pool ÷ billable field hours ($/hr, the headline rate)
 * - **Method B** — pool ÷ invoiced revenue $ (fraction of revenue; render × 100 as %)
 * - **Method C** — pool ÷ direct field labor $ (multiplier per $1 of field wages)
 *
 * Shared by the Review tab's 90-day rate decomposition and the Overhead
 * tab's three-lenses strip so the two surfaces can never drift apart —
 * the same class of silent duplication that caused the paging/timezone
 * divergence PR #983 fixed. Pure math only: callers fetch and aggregate
 * the inputs (paged, Chicago-bucketed, approval-gated) themselves.
 */

export type OverheadRateMethodInputs = {
  /** 90-day overhead pool $: office labor + bid labor + office parts. */
  overheadPoolUsd: number
  /** Billable field hours in the same window (Method A denominator). */
  fieldHours: number
  /** Invoiced revenue $ in the same window (Method B denominator). */
  invoicedRevenueUsd: number
  /** Direct field labor $ in the same window (Method C denominator). */
  fieldLaborUsd: number
}

export type OverheadRateMethods = {
  /** $ of overhead per billable field hour; null when field hours ≤ 0 / invalid. */
  methodA: number | null
  /** Overhead as a fraction of invoiced revenue (0.118 = 11.8%); null when revenue ≤ 0 / invalid. */
  methodB: number | null
  /** $ of overhead per $1 of direct field labor; null when field labor $ ≤ 0 / invalid. */
  methodC: number | null
}

/**
 * Same null rule the Review tab's inline math always used: a method is null
 * whenever its denominator is not a positive finite number (and all three
 * are null when the pool itself is not finite).
 */
export function computeOverheadRateMethods(inputs: OverheadRateMethodInputs): OverheadRateMethods {
  const pool = Number.isFinite(inputs.overheadPoolUsd) ? inputs.overheadPoolUsd : null
  const over = (denominator: number): number | null => {
    if (pool == null) return null
    if (!Number.isFinite(denominator) || denominator <= 0) return null
    return pool / denominator
  }
  return {
    methodA: over(inputs.fieldHours),
    methodB: over(inputs.invoicedRevenueUsd),
    methodC: over(inputs.fieldLaborUsd),
  }
}
