/**
 * The baseline deck's price floor (punch list #234, the owner's second call of 2026-11-09): a $350 service job sat on
 * *Projects with no baseline*, and the owner set a floor — **a project priced under $2,500 never appears on the deck
 * or in the score.** One constant, read by the deck's kernel (`fillInBaselines.ts`), the Needs you count that rides it,
 * and the Scoreboard's fold (`superintendentScores.ts`), so the three agree. A job with no price yet is not under the
 * floor: nothing is known about it, and the deck still offers it a baseline. Pure.
 */
export const BASELINE_PRICE_FLOOR_USD = 2_500

/** True when a price is known and sits under the floor. */
export function underBaselinePriceFloor(priceUsd: number | string | null | undefined): boolean {
  const n = typeof priceUsd === 'string' ? parseFloat(priceUsd) : Number(priceUsd)
  return Number.isFinite(n) && n > 0 && n < BASELINE_PRICE_FLOOR_USD
}

/** "$2,500" — the floor as the words print it. */
export const BASELINE_PRICE_FLOOR_WORDS = `$${BASELINE_PRICE_FLOOR_USD.toLocaleString('en-US')}`
