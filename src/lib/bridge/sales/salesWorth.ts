/**
 * What is out, and what it is worth at the won rates (punch list #318, PR 3): the Sales window's
 * headline, "$X is out. At our won rates that is about $Y."
 *
 * - **Out** is every sent bid with no mark, for the part of it not yet counted as lost by age (half after 90 days,
 *   95% after 180: `bidWins.ts`), plus every estimate still out.
 * - **Worth** reads that same part of each bid at the won rate for bids its size, and each estimate still out at
 *   the won rate for estimates (`estimateWins.ts`).
 *
 * Null when neither read has landed. Pure.
 */
import type { BidWins } from '../bidWins'
import type { EstimateWins } from '../estimateWins'

export type SalesOutWorth = { outUsd: number; worthUsd: number }

export function salesOutWorth(bidWins: Pick<BidWins, 'sizes'> | null, estimateWins: Pick<EstimateWins, 'out'> | null): SalesOutWorth | null {
  if (!bidWins && !estimateWins) return null
  const sizes = bidWins?.sizes ?? []
  const bidsOut = sizes.reduce((sum, s) => sum + (s.noMark.usd - s.agedLostUsd), 0)
  const bidsWorth = sizes.reduce((sum, s) => sum + (s.noMark.usd - s.agedLostUsd) * (s.usedRate ?? 0), 0)
  const outUsd = bidsOut + (estimateWins?.out.usd ?? 0)
  const worthUsd = bidsWorth + (estimateWins?.out.expectedUsd ?? 0)
  return { outUsd, worthUsd }
}
