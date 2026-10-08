/**
 * GC mode design spike: the billing forecast follows the schedule, the Gantt's Phase 4 (G-97;
 * mock-up `to-dos/gc-mode/mockups/G-97.md`). What we expect to bill the customer each month as the
 * schedule stands today, and how a move changed it.
 *
 * One rule moves the work: each bar keeps the percent its trade reported, and the rest is spread
 * evenly over its days to its finish. By a bill day a bar is done that far; on or after its finish
 * it is done. One rule bills it: at each bill day the job is copied with every line at that
 * percent, and Owner Billing's own `ownerPayApp` (the draft's math) is run on the copy. So our
 * costs and fee following the trades, the retainage step and the floor of what was already billed
 * come out the same, and the bill counts as sent before the next month. No billing math is written
 * twice; nothing here writes the state.
 *
 * What the made-up data does not carry is a stated rule, never invented: work spreads evenly inside
 * a bar; the architect certifies a bill in full; stored materials count once they are in place;
 * the retainage comes with the final bill, on no day; a trade with no signed statement of work has
 * no customer dollars on its bars, and the part of the price no bar carries is said, not placed.
 *
 * Its own file, out of the barrel: the Bill the customer tab, the Money tab, the customer's portal
 * and the schedule's moves read it.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { BillingByMonth, BillingForecast, ForecastMonth, ForecastShift } from '../gc/billingForecast'
export { aboutMoney, billedJobs, billingByMonth, billingForecast, customerShiftWords, forecastPct, forecastShifts, moveBillingShift, planBillingShift, shiftWords, sovLinePctAt, weekBillingShift } from '../gc/billingForecast'

