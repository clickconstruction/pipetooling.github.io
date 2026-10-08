/**
 * GC mode — design spike: what each job makes us (owner's go-ahead 2026-10-05). The price the
 * customer signed for, line by line (`ownerContractWorthOf`), against what the work costs us: each
 * trade bought out at its signed statement of work (a trade not bought out yet at what we carry),
 * signed change orders at their cost, general conditions at their budget. What is left is ours:
 * the fee, what buying out saved, and the change orders' margin. Contingency not spent is shown
 * apart, since the prototype does not track what it was spent on. Our own crew counts at its
 * price; its real cost is on its Pipeline job.
 *
 * For the owner and the controller only, like the rest of the app's money. Import from `./gcModel`.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { JobMargin, TradeBuyout } from '../gc/ownerBillingMargin'
export { allJobsMargin, jobMargin } from '../gc/ownerBillingMargin'

