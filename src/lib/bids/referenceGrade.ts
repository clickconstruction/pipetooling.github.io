/**
 * Reference grading (v2.2545): how much can a historical bid teach a backtest?
 * The sparse era (pre-2026-03) was recorded while the company was still
 * learning what to track — grade the reference instead of trusting or
 * discarding it, and only let strong ones into gate math.
 *
 *   A — plans + value + counts + pricing: full scorecard (counts + dollars + market)
 *   B — plans + value: dollar-level scorecard only
 *   C — plans + counts: quantity scorecard only
 *   D — plans only: census reps, no scorecard
 *   X — no plans: not backtestable (repair or exclude, with the reason recorded)
 *
 * BLINDNESS SPLIT (twin-mcp mirrors this): the GRADE uses field *presence* only
 * and is safe to reveal when a backtest opens. The FLAGS read the sealed
 * value/outcome and must only be computed at unseal (STG-6) for the scorecard.
 * Doctrine (BT-9/10, BT-11): weak-loss and round-value references never count
 * in Gate A/B denominators.
 */

export type ReferenceGradeLetter = 'A' | 'B' | 'C' | 'D' | 'X'

export interface ReferencePresence {
  hasPlans: boolean
  hasValue: boolean
  hasCounts: boolean
  hasPricing: boolean
}

export function referenceGrade(p: ReferencePresence): ReferenceGradeLetter {
  if (!p.hasPlans) return 'X'
  if (p.hasValue && p.hasCounts && p.hasPricing) return 'A'
  if (p.hasValue) return 'B'
  if (p.hasCounts) return 'C'
  return 'D'
}

/** Loss categories that make a reference number a weak calibration target. */
export const WEAK_LOSS_CATEGORIES = ['no_bid', 'project_died'] as const

export interface ReferenceUnsealFields {
  bid_value: number | string | null
  outcome: string | null
  loss_category: string | null
  /** bid_date_sent ?? created_at, YMD or ISO. */
  when: string | null
}

export interface ReferenceQualityFlags {
  /** Value is round to $100 — hand-entered from memory, not a computed total (BT-11). */
  roundValue: boolean
  /** Lost with a category that says the number never really competed (BT-9/10). */
  weakLoss: boolean
  /** Lost with NO category — the weak-loss exclusion can't be applied; treat with care. */
  lossUncategorized: boolean
  /** Older than ~6 months — books and practices have drifted under it. */
  stale: boolean
  /** roundValue || weakLoss || lossUncategorized || stale — excluded from gate denominators. */
  gateEligible: boolean
}

const STALE_DAYS = 183

export function referenceQualityFlags(f: ReferenceUnsealFields, todayYmd: string): ReferenceQualityFlags {
  const value = f.bid_value == null ? null : Number(f.bid_value)
  const roundValue = value != null && value > 0 && value % 100 === 0
  const lost = f.outcome === 'lost'
  const weakLoss = lost && (WEAK_LOSS_CATEGORIES as readonly string[]).includes(f.loss_category ?? '')
  const lossUncategorized = lost && !f.loss_category
  const when = (f.when ?? '').slice(0, 10)
  const stale = !!when && daysBetweenYmd(when, todayYmd) > STALE_DAYS
  return { roundValue, weakLoss, lossUncategorized, stale, gateEligible: !(roundValue || weakLoss || lossUncategorized || stale) }
}

function daysBetweenYmd(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`)
  const tb = Date.parse(`${b}T00:00:00Z`)
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0
  return Math.abs(tb - ta) / 86400000
}
