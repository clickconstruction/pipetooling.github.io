/**
 * GC mode — design spike: finishing late against the owner contract (Owner Billing lane, owner's
 * go-ahead 2026-10-04). The contract's date is substantial completion with the signed change
 * orders' days (`substantialCompletionOn`, the Building lane's). A late fee a day (liquidated
 * damages) is ours to enter from the owner contract, per job.
 *
 * The schedule's finish is the Building lane's (`projectedFinish`), with the sentence that says why.
 * Import from `./gcModel`.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { OwnerFinishRisk } from '../gc/ownerBillingFinish'
export { ownerFinishRisk } from '../gc/ownerBillingFinish'

