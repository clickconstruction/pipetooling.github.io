/**
 * GC mode — design spike: the money coming in and going out over the next weeks, across every job
 * that is ours (Owner Billing lane, owner's go-ahead 2026-10-03). Only what is already on the books
 * counts: the bills we sent the owners, the draws the trades asked for or we approved, and the
 * retainage on both sides. A bill we have not sent yet is not counted.
 *
 * The days: an owner's bill on their newest promise, else the day we expect it (`ownerPayDue`). A
 * trade's approved draw on its pay-by day (`drawPayDays`: within PAY_WITHIN_DAYS of approval). A
 * draw asked for and not approved yet counts as if we approve it today. A trade's retainage is paid
 * 10 days after the owner pays our final (`tradeRetainageOpensOn`); until then it has no day, like
 * the retainage the owner holds on us. Owner money already late is left out of the weeks unless
 * asked, since we cannot say when it comes.
 *
 * Expected, not on the books yet (owner's go-ahead 2026-10-04), counted unless the box is unticked,
 * follows the bars (G-140, the owner's yes 2026-10-06; `gcCashForecast.ts`): each bill as the
 * schedule has it (G-97's forecast), on the day that customer usually pays; and each trade's draws
 * for the same work, through its own pay application, paid within PAY_WITHIN_DAYS of each bill day.
 * With `bars: 'reported'` every bar holds at what was reported: the draft bill and each trade's next
 * draw for the work reported and not drawn, the way the weeks counted before. A job with no
 * schedule counts that way either way.
 *
 * Its own file because it reads gcBuildingPay, which reads gcPortal. Import from `./gcModel`.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { CashAhead, CashMove, CashMoveWhy, CashWeek } from '../gc/ownerBillingAhead'
export { CASH_AHEAD_WEEKS, cashAhead, cashMoves } from '../gc/ownerBillingAhead'

