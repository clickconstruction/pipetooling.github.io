/**
 * The pay offer's money side (v2.4704): what a bill carries while the leader's discount is live,
 * and the three decisions every reader makes from it — what the scanned code shows, what the
 * webhook writes down once the bill is paid in full, and which credits the nightly sweep takes
 * back. Pure and dependency-free, shared with the client through
 * `src/lib/jobs/lienPayOfferShared.ts` and tested from `src/lib/jobs/lienPayOfferShared.test.ts`.
 *
 * The rule in one breath: the run puts a Stripe credit note on each enclosed bill for the
 * percent of what it then asks for; Stripe shows and collects the lower amount; the ledger's
 * own amount changes only when the bill is paid in full (the agreed write-down, with the
 * note); a bill still open after the day gets its credit voided and goes back to full. An
 * affidavit therefore always swears the full balance.
 */

export type LienOfferRow = {
  lien_offer_pct: number | null
  /** YYYY-MM-DD, the last day. */
  lien_offer_by: string | null
  lien_offer_credit_note_id: string | null
  lien_offer_credit_cents: number | null
  lien_offer_taken_at: string | null
  lien_offer_ended_at: string | null
}

export type LienOfferState = 'none' | 'live' | 'ended' | 'taken'

/** The credit Stripe gets, in cents, from what the bill asks for at the moment the run is recorded. */
export function lienOfferCreditCents(remainingCents: number, pct: number): number {
  return Math.max(0, Math.round((remainingCents * pct) / 100))
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Where the bill's offer stands today: none, live, ended (the day passed, swept or not), or taken (paid in full with it). */
export function lienOfferState(row: LienOfferRow | null | undefined, todayYmd: string): LienOfferState {
  if (!row) return 'none'
  const pct = Number(row.lien_offer_pct ?? 0)
  const by = (row.lien_offer_by ?? '').trim()
  if (!(row.lien_offer_credit_note_id ?? '').trim() || !(pct > 0) || !YMD.test(by)) return 'none'
  if (row.lien_offer_taken_at) return 'taken'
  if (row.lien_offer_ended_at) return 'ended'
  if (by < todayYmd) return 'ended'
  return 'live'
}

/** What the `/pay` page reads beside the amount. `fullCents` is the amount before the discount, only while live. */
export type PayLinkOffer = {
  pct: number
  by: string
  state: Exclude<LienOfferState, 'none'>
  fullCents: number | null
}

export function lienOfferForPayLink(row: LienOfferRow | null | undefined, amountRemainingCents: number | null, todayYmd: string): PayLinkOffer | null {
  const state = lienOfferState(row, todayYmd)
  if (state === 'none' || !row) return null
  const credit = Math.max(0, Math.round(Number(row.lien_offer_credit_cents ?? 0)))
  return {
    pct: Math.round(Number(row.lien_offer_pct)),
    by: (row.lien_offer_by ?? '').trim(),
    state,
    fullCents: state === 'live' && amountRemainingCents != null ? Math.max(0, Math.round(amountRemainingCents)) + credit : null,
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Nov 3" from YYYY-MM-DD; the input itself when it is not one. */
export function lienOfferDayShort(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}`
}

/**
 * The agreed write-down the webhook records once the bill is paid in full with the offer: the
 * ledger's amount less the credit, with the note. Null when the bill carries no live credit
 * (never taken twice, never after the sweep took it back) or the arithmetic would not stand.
 */
export function lienOfferWriteDown(row: LienOfferRow | null | undefined, ledgerAmount: number, paidOnYmd: string): { newAmount: number; note: string } | null {
  if (!row) return null
  const credit = Math.round(Number(row.lien_offer_credit_cents ?? 0))
  if (!(row.lien_offer_credit_note_id ?? '').trim() || credit < 1 || row.lien_offer_taken_at || row.lien_offer_ended_at) return null
  const newAmount = Math.round(ledgerAmount * 100 - credit) / 100
  if (!(newAmount > 0)) return null
  const pct = Math.round(Number(row.lien_offer_pct ?? 0))
  return { newAmount, note: `Lien notice offer: ${pct}% off, paid in full ${lienOfferDayShort(paidOnYmd)} (by ${lienOfferDayShort((row.lien_offer_by ?? '').trim())})` }
}

/** A bill the nightly sweep takes the credit back from: a live credit whose day has passed. */
export function lienOfferExpired(row: LienOfferRow | null | undefined, todayYmd: string): boolean {
  if (!row) return false
  const by = (row.lien_offer_by ?? '').trim()
  return Boolean((row.lien_offer_credit_note_id ?? '').trim()) && !row.lien_offer_taken_at && !row.lien_offer_ended_at && YMD.test(by) && by < todayYmd
}

/** The credit note's memo, as Stripe shows it on the bill. */
export function lienOfferCreditMemo(pct: number, by: string): string {
  return `${pct}% off if paid in full by ${lienOfferDayShort(by)} — lien notice offer`
}
