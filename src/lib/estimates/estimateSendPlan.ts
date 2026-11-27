/**
 * What a press on Send does (punch list #46 row 3, the Estimates map's Stage-A rows 2 and 5).
 *
 * Two rules the estimate page held inline, with no test:
 * - **the recipient**: the customer's own email wins, and the address typed under Send to stands in
 *   only when the customer has none. The page spelled this at the rail, the save, the preview and the send;
 * - **the plan**: no address or a bad one stops the send with its reason; a normal estimate above $0
 *   sent by an office role opens Tell the customer (the email, the text with the link, the receipt);
 *   every other send — a change order, a $0 total, a role outside the office — gets one confirm that
 *   names the recipient, and says so when the total is $0.
 */
import type { UserRole } from '../../types/userRole'
import { GC_OFFICE_TEAM } from '../gc/access'

/** A plausible address: something, an at sign, something, a dot, something, no spaces. */
export const SEND_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The address an estimate goes to: the customer's own, else the one typed under Send to, else ''. */
export function estimateRecipientEmail(customerEmail: string | null | undefined, override: string | null | undefined): string {
  return (customerEmail ?? '').trim() || (override ?? '').trim()
}

export interface EstimateSendPlanInput {
  /** The email on the customer's record ('' when there is none). */
  customerEmail: string
  /** What is typed under Send to. */
  override: string
  isChangeOrder: boolean
  totalCents: number
  role: UserRole | null | undefined
}

export type EstimateSendPlan =
  | { kind: 'refuse'; why: string }
  | { kind: 'sheet'; email: string }
  | { kind: 'confirm'; email: string; title: string; message: string; confirmLabel: string }

export function estimateSendPlan(input: EstimateSendPlanInput): EstimateSendPlan {
  const email = estimateRecipientEmail(input.customerEmail, input.override)
  if (!email) return { kind: 'refuse', why: 'This customer has no email on file. Enter a send-to email below.' }
  if (!SEND_EMAIL_RE.test(email)) return { kind: 'refuse', why: 'Enter a valid email address.' }
  // Tell the customer (v2.5594): a normal estimate's send goes through the sheet.
  if (!input.isChangeOrder && input.totalCents > 0 && input.role && GC_OFFICE_TEAM.includes(input.role)) return { kind: 'sheet', email }
  // One confirm that names the recipient (J17-F4). A $0 send is allowed — a schedule-only change order
  // is legitimate — but never silent: the ask says the total and the button says Send anyway.
  const zeroNote = input.totalCents === 0 ? (input.isChangeOrder ? ' The net change to contract is $0.00.' : ' The total is $0.00.') : ''
  return {
    kind: 'confirm',
    email,
    title: input.isChangeOrder ? 'Send for signature?' : 'Send to customer?',
    message: `Send to ${email}?${zeroNote}`,
    confirmLabel: input.totalCents === 0 ? 'Send anyway' : 'Send',
  }
}
