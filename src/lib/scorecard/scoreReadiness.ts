/**
 * Whether a priced bid can be scored (team scorecard, punch list #360, PR 2). The Scores tab holds a
 * priced bid whose estimate cannot be judged; this is the same rule said where the estimator can act
 * on it: on the Pricing workbench before the bid goes out, in the workbench's send window, and as a
 * chip on the Bid Board's row.
 *
 * The rule is `estimateHoldWords`'s, so the three screens and the Scores tab cannot disagree: labor
 * is estimated when at least nine rows in ten carry hours (the breakdown's own bar, counted here the
 * way `bid_estimate_breakdown` counts it), and no priced revenue sits on a row with no cost. A bid
 * with no priced margin on it yet has nothing to judge and says nothing.
 *
 * Pure. The workbench passes the rows on its screen; the Bid Board reads them through
 * `scoreReadinessIo.ts`.
 */
import { laborHoursEstimated, laborRowsWords, type EstimatorBidInput } from './estimatorScore'

export type ReadinessLaborRow = {
  kind?: string | null
  rough_in_hrs_per_unit?: number | string | null
  top_out_hrs_per_unit?: number | string | null
  trim_set_hrs_per_unit?: number | string | null
}

export type LaborCompleteness = NonNullable<EstimatorBidInput['labor']>

const pos = (v: unknown): boolean => Number(v) > 0

/** The breakdown's count, in the browser: every row that is not a sub's, and those with hours on any stage. */
export function laborCompleteness(rows: readonly ReadinessLaborRow[], laborRate: number | string | null | undefined): LaborCompleteness {
  const own = rows.filter((r) => (r.kind ?? 'fixture') !== 'sub')
  const withHours = own.filter((r) => pos(r.rough_in_hrs_per_unit) || pos(r.top_out_hrs_per_unit) || pos(r.trim_set_hrs_per_unit)).length
  const rateSet = pos(laborRate)
  const rowsTotal = own.length
  return { rowsTotal, rowsWithHours: withHours, rateSet, usable: rowsTotal > 0 && withHours / rowsTotal >= 0.9 && rateSet }
}

export type ScoreHoldReason = 'labor' | 'uncosted'

export type ScoreReadiness =
  /** No priced margin on the bid yet: nothing to judge. */
  | { kind: 'unpriced' }
  | { kind: 'ready' }
  | { kind: 'hold'; reason: ScoreHoldReason; chip: string; words: string; fix: string }

export const SCORE_HOLD_CHIP = 'Can’t be scored'

const usd0 = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`

/**
 * The bid as the score will read it. `sent` picks the tense: a bid still on the desk can be finished,
 * a bid that went out keeps the margin it went out at.
 */
export function bidScoreReadiness(args: {
  pricedRevenueUsd: number | null | undefined
  pricedCostUsd: number | null | undefined
  pricedUncostedUsd: number | null | undefined
  labor: LaborCompleteness | null
  sent: boolean
}): ScoreReadiness {
  if (args.pricedRevenueUsd == null || args.pricedCostUsd == null || !(Number(args.pricedRevenueUsd) > 0)) return { kind: 'unpriced' }
  if (args.labor && !laborHoursEstimated(args.labor)) {
    const rows = laborRowsWords(args.labor)
    return {
      kind: 'hold',
      reason: 'labor',
      chip: SCORE_HOLD_CHIP,
      words: args.sent
        ? `Labor not estimated: ${rows}. This bid went out with little or no labor in its cost, so it cannot be scored.`
        : `Labor not estimated: ${rows}. The cost has little or no labor in it, so this bid cannot be scored.`,
      fix: args.sent ? 'Its margin was kept when it was sent. Fill the Labor tab before the next bid goes out.' : 'Fill the hours on the Labor tab before it goes out.',
    }
  }
  const uncosted = Number(args.pricedUncostedUsd ?? 0)
  if (uncosted >= 0.5) {
    return {
      kind: 'hold',
      reason: 'uncosted',
      chip: SCORE_HOLD_CHIP,
      words: args.sent
        ? `${usd0(uncosted)} of the price went out on rows with no cost, so the margin is partial and this bid cannot be scored.`
        : `${usd0(uncosted)} of the price is on rows with no cost, so the margin is partial and this bid cannot be scored.`,
      fix: args.sent ? 'Its margin was kept when it was sent. Cost every row before the next bid goes out.' : 'Give every priced row a cost before it goes out.',
    }
  }
  return { kind: 'ready' }
}

/** The chip's hover: the reason and what to do about it, one line. */
export function scoreHoldTitle(r: Extract<ScoreReadiness, { kind: 'hold' }>): string {
  return `${r.words} ${r.fix}`
}

/**
 * Which rows of a board carry the chip's read: a priced margin on the bid, and not lost. A lost bid
 * never scores, so its estimate is nobody's work any more.
 */
export function bidsToJudge<T extends { id: string; outcome?: string | null; priced_revenue_usd?: number | null; priced_cost_usd?: number | null }>(bids: readonly T[]): T[] {
  return bids.filter((b) => b.outcome !== 'lost' && b.priced_revenue_usd != null && b.priced_cost_usd != null && Number(b.priced_revenue_usd) > 0)
}
