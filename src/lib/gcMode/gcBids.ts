/**
 * GC mode — design spike. Bids: comparing quotes all in, what we carry, our price to the owner, bid tabs, statement-of-work money.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { BidComparison, BidTabRow, CompareLine, Coverage, ProposalTotals } from '../gc/bids'
export { BIDS_WANTED, bidIsStale, bidTabResult, bidTabRows, bidTabsOpen, bidsIn, carriedUncosted, compareBids, isGuess, lowLeveled, packageCoverage, packageHasTab, proposalTotals, proposalUncosted, proposalUncostedWords, quoteRanOut, sowMoney, uncostedLines, uncostedWords } from '../gc/bids'

export { carriedAmount, leveledTotal, takenAlternatesTotal } from '../gc/bids'
