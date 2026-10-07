/**
 * GC mode — design spike: why a company is out of an ask (the owner, 2026-10-04: "if I click one
 * of these buttons I would like to record a reason that stays with the job and the sub"). The
 * office picks a reason and may add their words; it shows on the job's Trades tab and on the
 * company's line on Trade partners.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { PartnerDecline } from '../gc/decline'
export { DECLINE_REASONS, declineLogWords, declineReasonLabel, declineReasonWords, declinedTitle, declinedWords, partnerDeclines } from '../gc/decline'

