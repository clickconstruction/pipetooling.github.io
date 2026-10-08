/**
 * GC mode design spike: the cash weeks follow the bars (the Gantt, G-140; mock-up
 * `to-dos/gc-mode/mockups/G-140.md`; the owner's yes, 2026-10-06). What The next 6 weeks expects,
 * beside what is on the books, read from the schedule on both sides by one rule each:
 *
 * - **Our bills (in):** G-97's forecast, each month's bill (Owner Billing's own `ownerPayApp` on the
 *   job at that day's percents) on the bill day plus that customer's usual days to pay.
 * - **The trades' draws (out):** each package's draw at each of our bill days, from the percents its
 *   bars reach by then, through the trade's own pay application (`payApplication`, `drawMoney`),
 *   each counted as made before the next month, paid `PAY_WITHIN_DAYS` after the bill day.
 *
 * With every bar held at its reported percent (`'reported'`) both rules give what the cash weeks
 * counted before: the draft bill, and each trade's next draw for the work reported and not drawn.
 * A job with no schedule keeps that rule.
 *
 * Its own file: `gcOwnerBillingAhead.ts` calls it, and it reads the forecast and the pay application.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { CashBars } from '../gc/cashForecast'
export { barsChangeWords, billDayWords, expectedBills, expectedDraws, expectedThrough, lowestWeekWords, seenPct } from '../gc/cashForecast'

