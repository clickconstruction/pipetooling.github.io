/**
 * GC mode — design spike: reminding a customer to pay a pay application past its due day (the
 * owner's ask 2026-10-04, through the Board lane's send-a-paper; the wording and rules are Owner
 * Billing's). Shaped like the Board's change-order reminder (`gcCustomerSend.ts`), so its send view
 * takes it as is. A reminder is our ask, not their word: it is kept on the bill (`reminders`) and
 * never becomes a promise or moves the day it was due. Email only (question 29).
 *
 * Import from `./gcModel`.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { LatePayApp, PayReminderStep } from '../gc/ownerBillingRemind'
export { PAY_REMINDER_DAYS, customerGreeting, latePayApps, payReminderEmail, payReminderSentWords, payReminderStep } from '../gc/ownerBillingRemind'

