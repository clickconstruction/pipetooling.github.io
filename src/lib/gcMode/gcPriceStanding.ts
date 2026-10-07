/**
 * GC mode — design spike: where a bidding job's price stands, trade by trade (the owner's pick B,
 * 2026-10-04, built by the Building lane on the Board's row). The board's "so far, with holes" line
 * and its red coverage chip open one card from this: each trade by what happens next, and what the
 * price comes to once every trade is in. It only reads: the Board lane's `proposalTotals` stays
 * the price, and its counts follow the chip's rule (a guess, a carried quote missing a cost, or one
 * that ran out is not a real number).
 *
 * Import from `./gcModel`.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { PriceStanding, TradeStanding, TradeStandingRow } from '../gc/priceStanding'
export { STANDING_ORDER, aboutMoney, isHole, priceStanding } from '../gc/priceStanding'
