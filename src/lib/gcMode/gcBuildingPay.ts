/**
 * GC mode — design spike: when we pay a trade's draw (Building lane, 2026-10-03). The owner's
 * terms: an approved pay application is paid within PAY_WITHIN_DAYS (the Portal lane's constant,
 * the same rule the trade reads on its Your pay page); a retainage release is paid on the day it
 * opens, 10 days after the owner pays us ours (tradeCloseout). The days come from the draw:
 * approvedOn and paidOn, stamped by the reducer.
 *
 * Its own file because it reads both gcBuilding and gcPortal, and gcPortal already reads gcBuilding.
 * Import from `./gcModel`.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { DrawPayDays, DrawToPay } from '../gc/buildingPay'
export { drawPayDays, drawsToPay } from '../gc/buildingPay'

