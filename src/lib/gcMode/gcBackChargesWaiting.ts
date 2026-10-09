/**
 * GC mode — design spike: back-charges waiting on the office (the owner, 2026-10-05, on the Portal
 * lane's back-charges: "a Needs you line of its own"). A charge a trade disputed, one it never
 * answered, or one ready to come off an approved draw is our move, not someone we wait on, so it
 * stays out of Who to call: the dashboard has its own line, like change requests. One that is
 * agreed with no approved draw to take it from waits for the draw and is not on the list yet.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { GcBackChargesNeedsYou, WaitingBackCharge } from '../gc/backChargesWaiting'
export { BACK_CHARGE_LATE_DAYS, backChargeShort, backChargesWaiting, gcBackChargesNeedsYou } from '../gc/backChargesWaiting'

