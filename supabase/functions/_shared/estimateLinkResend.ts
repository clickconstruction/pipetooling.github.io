/**
 * "Resend link" on a sent estimate — the one predicate the client button and
 * `send-estimate-to-customer` (mode `resend`) both consult, plus the body
 * rewrite that keeps the stored email snapshot honest after a re-mint.
 *
 * Journey-map J17-F2 / N3 (2026-09-05): the tokened accept URL lived only in
 * the sending tab's `sessionStorage`; the DB holds only `public_token_hash`,
 * so once the tab closed nobody — not even an admin — could recover or resend
 * the link, while the detail page told the office to "ask an admin to resend".
 * A resend mints a fresh token (the old hash is overwritten, so the old link
 * stops working), re-sends the email the customer already saw (the stored
 * `customer_experience_sent` body, with the accept URL swapped), and hands the
 * new URL back to the staff member once.
 *
 * Deno-free on purpose: `src/lib/estimateLinkResend.test.ts` imports this file
 * directly (same pattern as `paidJobBillGuard.ts`).
 */
import { todayYmdInAppTz } from './appTimeZone.ts'

export type EstimateLinkResendBlockReason =
  | 'draft'
  | 'accepted'
  | 'declined'
  | 'superseded'
  | 'never_sent'
  | 'pricing_expired'
  | 'bid_room'
  | 'unknown_status'

export type EstimateLinkResendVerdict =
  | { ok: true }
  | { ok: false; reason: EstimateLinkResendBlockReason }

export type EstimateLinkResendOptions = {
  /** `estimates.valid_until` (YYYY-MM-DD, company calendar). A past date blocks the resend: the accept page would 410. */
  validUntil?: string | null
  /** Change orders published to a bid room are signed there; the emailed link is not the door. */
  inBidRoom?: boolean
}

/**
 * Can this estimate's customer link be re-minted and re-sent?
 *
 * Only `sent` rows with a `sent_at` qualify. Token expiry is deliberately NOT a
 * blocker — an expired 14-day token is exactly what a resend fixes. A past
 * `valid_until` (pricing good-through) IS a blocker: `get-estimate-for-customer`
 * answers 410 for it, so the fresh link would land on "Estimate expired"; the
 * office should start a new estimate instead.
 */
export function canResendEstimateLink(
  status: string | null | undefined,
  sentAt: string | null | undefined,
  now: Date = new Date(),
  opts: EstimateLinkResendOptions = {},
): EstimateLinkResendVerdict {
  switch (status) {
    case 'draft':
      return { ok: false, reason: 'draft' }
    case 'customer_accepted':
      return { ok: false, reason: 'accepted' }
    case 'declined':
      return { ok: false, reason: 'declined' }
    case 'superseded':
      return { ok: false, reason: 'superseded' }
    case 'sent':
      break
    default:
      return { ok: false, reason: 'unknown_status' }
  }
  if (!sentAt || Number.isNaN(Date.parse(String(sentAt)))) return { ok: false, reason: 'never_sent' }
  if (opts.inBidRoom) return { ok: false, reason: 'bid_room' }
  const validUntil = (opts.validUntil ?? '').trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(validUntil) && validUntil < todayYmdInAppTz(now)) {
    return { ok: false, reason: 'pricing_expired' }
  }
  return { ok: true }
}

/** One sentence per block reason, worded for the office (shared by the button's tooltip and the edge function's 400). */
export function estimateLinkResendBlockMessage(reason: EstimateLinkResendBlockReason): string {
  switch (reason) {
    case 'draft':
      return 'Send the estimate first — a draft has no customer link yet.'
    case 'accepted':
      return 'This estimate has already been accepted; there is nothing left for the customer to open.'
    case 'declined':
      return 'This estimate was declined. Start a new estimate instead of resending.'
    case 'superseded':
      return 'This estimate was replaced by a newer one; resend the newer one instead.'
    case 'never_sent':
      return 'This estimate has no send on record, so there is no link to resend.'
    case 'pricing_expired':
      return 'Pricing on this estimate has passed its good-through date, so the link would show "expired". Start a new estimate instead.'
    case 'bid_room':
      return 'This change order lives in the bid room — the GC signs it there, not from an emailed link.'
    case 'unknown_status':
      return 'This estimate cannot be resent from its current state.'
  }
}

/**
 * Tooltip for the disabled Copy/Open customer-link buttons on a sent or accepted row whose
 * link this browser never saw (J17-F2): the link is kept only by the tab that sent it. Until
 * v2.2856 this copy told the office to "ask an admin to resend" — no such button existed.
 */
export function customerLinkUnavailableTitle(resendAvailable: boolean): string {
  return resendAvailable
    ? 'This browser does not have the link — only the tab that sent the estimate keeps it. Use Resend link below to email the customer a fresh one; it can be copied from here afterwards.'
    : 'This browser does not have the link — only the tab that sent the estimate keeps it, and this estimate is past resending.'
}

/** Matches any accept URL the app has ever minted: `<origin>/estimate/accept?t=<token>`. */
const ACCEPT_URL_RE = /https?:\/\/[^\s<>"'()]+\/estimate\/accept\?t=[A-Za-z0-9._~%-]+/g

/**
 * Swap every accept URL inside a stored email body for the freshly minted one.
 *
 * `customer_experience_sent.emailBody` is saved AFTER `{{accept_url}}` substitution,
 * so a resend that reused it verbatim would mail the customer a paragraph holding
 * the dead link (and the Letterhead builder would keep that paragraph, because it
 * only drops the one holding the *current* URL). Bodies with no URL — an org
 * template that omitted `{{accept_url}}` — come back unchanged; the Letterhead's
 * button and plain-URL fallback still carry the new link.
 */
export function rewriteEstimateAcceptUrl(body: string, newAcceptUrl: string): string {
  if (!body) return body
  return body.replace(ACCEPT_URL_RE, newAcceptUrl)
}
