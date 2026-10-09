/**
 * GC mode, the real build, Owner Billing's O5c: money in on Bill the customer, in words. Payments go through the
 * Pipeline's own `mark_invoice_paid` and promises through `add_job_payment_promise`, both on the project's billing
 * job; this file holds what the window says about them. Pure.
 */
import type { OwnerPayDue } from './ownerBilling'
import { shortDate } from './words'

/** How they told us when they will pay: `add_job_payment_promise`'s channels, as a person picks one. */
export const GC_PROMISE_CHANNELS: readonly { value: 'phone' | 'text' | 'email' | 'in_person'; label: string }[] = [
  { value: 'phone', label: 'On the phone' },
  { value: 'text', label: 'By text' },
  { value: 'email', label: 'By email' },
  { value: 'in_person', label: 'In person' },
]

/** `mark_invoice_paid` answers `{ error }` rather than refusing: each one in the window's words. */
const PAYMENT_REFUSALS: Record<string, string> = {
  'Not authenticated': 'Sign in to record a payment.',
  'Invoice not found': 'That bill is not there any more.',
  'Invoice must be in Billed status to mark as paid': 'That bill is not open for payment.',
  'Not authorized': 'Recording a payment is for the office.',
  'Not authorized to update this job': 'Recording a payment on this job is for the office.',
  'Invoice already fully paid': 'That bill is paid in full already.',
  'Amount must be positive': 'Type what they paid.',
  'Amount exceeds remaining balance on invoice': 'That is more than is open on the bill.',
}

/** A payment refusal in words; one we have not seen reads as it came. */
export function paymentRefusalWords(error: string): string {
  return PAYMENT_REFUSALS[error] ?? error
}

/** When a certified bill is due: "promised Oct 26", "expected Oct 26", or "late · promised Oct 26, 3 days ago". */
export function payDueWords(due: OwnerPayDue): string {
  if (due.on === null) return 'no day to expect it yet'
  const when = `${due.promised ? 'promised' : 'expected'} ${shortDate(due.on)}`
  if (due.daysLate <= 0) return when
  return `late · ${when}, ${due.daysLate === 1 ? '1 day' : `${due.daysLate} days`} ago`
}
