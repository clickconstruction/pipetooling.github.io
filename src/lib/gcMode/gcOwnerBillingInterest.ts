/**
 * GC mode — design spike: interest on the owner's late bills (Owner Billing lane, owner's go-ahead
 * 2026-10-04). Like retainage that drops, it is ours to offer and to choose per job: off unless we
 * set a rate. It runs on what the architect certified and is still open, from the first day the
 * bill was due (the owner's first promise or the day we expected it, whichever came first: a later
 * promise does not move it), to the day it is paid. It goes to the owner on a bill of its own, never
 * on the pay application: the 702 has no line for it.
 *
 * Its own file to keep gcOwnerBilling.ts from growing. Import from `./gcModel`.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { OwnerInterest, OwnerInterestOnBill } from '../gc/ownerBillingInterest'
export { OWNER_INTEREST_DEFAULT_PCT, ownerInterest, ownerInterestFrom, ownerInterestOnBill } from '../gc/ownerBillingInterest'

