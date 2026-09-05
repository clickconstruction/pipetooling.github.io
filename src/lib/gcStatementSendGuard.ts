/**
 * Draft Message send guard (journey-map #46 / J20-F4).
 *
 * The scheduled dispatcher has always refused to email an empty statement
 * ("skipped: nothing outstanding" on the request row) — but the Draft Message
 * dialog's Send statement was disabled only while a send was in flight, so a
 * certified $0.00 GC group opened with the GC's real address prefilled and one
 * click emailed "Total owed $0.00" under the company's name. This kernel is the
 * one rule both lanes now agree on; the dialog reads it for the button state
 * and the line under it.
 */

/** User-facing copy for the $0 case — the dispatcher's skip, in the office's words. */
export const GC_STATEMENT_NOTHING_OWED_COPY = 'Nothing owed — no statement goes out.'
export const GC_STATEMENT_NO_ADDRESS_COPY = 'Add an email address to send.'

export type GcStatementSendGuardInput = {
  /** The group's total owed, in cents (subtotal × 100, rounded). */
  totalOwedCents: number
  /** A send/schedule is already in flight. */
  emailSending: boolean
  /** The To field holds a well-formed email address. */
  hasAddress: boolean
  /**
   * Schedule… lane: the dispatcher rebuilds the statement fresh at send time
   * and skips it if still empty, so a group at $0 today may still be put on a
   * weekly chain. Only "Send now" is blocked on $0.
   */
  scheduled?: boolean
}

export type GcStatementSendBlock = 'sending' | 'nothing_owed' | 'no_address'

export type GcStatementSendGuard = {
  canSend: boolean
  blockedBy: GcStatementSendBlock | null
  /** Line to show under the button when a block is worth explaining; null otherwise. */
  message: string | null
}

export function gcStatementSendGuard(input: GcStatementSendGuardInput): GcStatementSendGuard {
  if (input.emailSending) return { canSend: false, blockedBy: 'sending', message: null }
  if (!input.scheduled && !(Number.isFinite(input.totalOwedCents) && input.totalOwedCents > 0)) {
    return { canSend: false, blockedBy: 'nothing_owed', message: GC_STATEMENT_NOTHING_OWED_COPY }
  }
  if (!input.hasAddress) return { canSend: false, blockedBy: 'no_address', message: null }
  return { canSend: true, blockedBy: null, message: null }
}

/** Dollars → cents for the guard (the rollup carries `subtotal` in dollars). */
export function dollarsToCents(dollars: number): number {
  return Math.round((Number.isFinite(dollars) ? dollars : 0) * 100)
}
