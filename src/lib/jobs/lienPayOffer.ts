/**
 * The pay offer (v2.4713, the partner's idea by way of the owner, 2026-10-06): when the
 * § 53.056 notice goes out, the owner's pay page may offer a discount on each enclosed bill if
 * it is paid in full by a day. The notice form never changes and the claim stays the full
 * amount; the offer is our own sentence on our own page. The leader turns it on where the
 * notice is approved; the run puts a Stripe credit on each bill while the offer is live; the
 * ledger is written down only once a bill is actually paid, so an affidavit always swears the
 * full balance. Pure words and arithmetic here; the writes are `lienPayOfferIo.ts`, the
 * money is the `lien-pay-offer` function and the Stripe webhook.
 */
import { demandDate, demandMoney } from '../jobsDocuments/demandLetter'
import { formatYmdMonthDay } from './billedExpectedPay'
import { ymdAddDays } from '../../utils/dateUtils'

export type LienPayOffer = {
  /** Percent off each bill paid in full by the day. */
  pct: number
  /** The last day, YYYY-MM-DD. */
  by: string
}

/** The percents the leader picks from; anything 1–50 is a valid row, these are the buttons. */
export const LIEN_OFFER_PCTS: ReadonlyArray<number> = [5, 10, 15]
export const LIEN_OFFER_DEFAULT_PCT = 10
export const LIEN_OFFER_MAX_PCT = 50
/** The default day: this many days after the notice mails. */
export const LIEN_OFFER_DEFAULT_DAYS = 14
/** The offer never runs later than this many days before the affidavit must be filed, so the affidavit can still go out on time. */
export const LIEN_OFFER_AFFIDAVIT_MARGIN_DAYS = 7

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** The offer a desk item carries, or null when it carries none or the row is incomplete. */
export function lienOfferFromItem(item: { offer_pct?: number | null; offer_by?: string | null } | null | undefined): LienPayOffer | null {
  if (!item) return null
  const pct = Number(item.offer_pct ?? 0)
  const by = (item.offer_by ?? '').trim()
  if (!Number.isFinite(pct) || pct <= 0 || pct > LIEN_OFFER_MAX_PCT || !YMD.test(by)) return null
  return { pct: Math.round(pct), by }
}

/** The offer a bill carries while it is live: a credit on the Stripe bill, neither taken nor ended. */
export function lienOfferOnInvoice(row: { lien_offer_pct?: number | null; lien_offer_by?: string | null; lien_offer_credit_note_id?: string | null; lien_offer_taken_at?: string | null; lien_offer_ended_at?: string | null } | null | undefined): LienPayOffer | null {
  if (!row || !(row.lien_offer_credit_note_id ?? '').trim() || row.lien_offer_taken_at || row.lien_offer_ended_at) return null
  return lienOfferFromItem({ offer_pct: row.lien_offer_pct, offer_by: row.lien_offer_by })
}

/** What the desk writes on the item: the offer, or none. */
export function lienOfferPatch(offer: LienPayOffer | null): { offer_pct: number; offer_by: string | null } {
  return offer ? { offer_pct: offer.pct, offer_by: offer.by } : { offer_pct: 0, offer_by: null }
}

/** The latest day an offer may run: a week before the affidavit must be filed; null when no affidavit day is known. */
export function lienOfferLatestDay(affidavitDueOn: string | null | undefined): string | null {
  const d = (affidavitDueOn ?? '').trim()
  return YMD.test(d) ? ymdAddDays(d, -LIEN_OFFER_AFFIDAVIT_MARGIN_DAYS) : null
}

/** The default day: 14 days after the notice mails, pulled in to the latest day when that comes first. */
export function lienOfferDefaultDay(mailedOn: string, affidavitDueOn: string | null | undefined): string {
  const want = ymdAddDays(mailedOn, LIEN_OFFER_DEFAULT_DAYS)
  const latest = lienOfferLatestDay(affidavitDueOn)
  return latest && latest < want ? latest : want
}

/** Why a day will not do, in a sentence; null when it will. */
export function lienOfferDayProblem(by: string, todayYmd: string, affidavitDueOn: string | null | undefined): string | null {
  if (!YMD.test(by)) return 'Pick a day.'
  if (by <= todayYmd) return 'The day has to be after today.'
  const latest = lienOfferLatestDay(affidavitDueOn)
  if (latest && by > latest) return latest <= todayYmd ? 'The affidavit is due within a week, so there is no room for an offer.' : `No later than ${formatYmdMonthDay(latest)}, a week before the affidavit must be filed.`
  return null
}

/** The bill's amount with the percent off, to the cent. */
export function lienOfferLowAmount(amount: number, pct: number): number {
  return Math.round(amount * (100 - pct)) / 100
}

/** The credit Stripe gets, in cents, from what the bill asks for — the shared definition the function and the webhook run. */
export { lienOfferCreditCents } from './lienPayOfferShared'

/** What the offer gives up at most: the percent of every payable bill. */
export function lienOfferCost(amounts: ReadonlyArray<number>, pct: number): number {
  return Math.round(amounts.reduce((s, a) => s + (a - lienOfferLowAmount(a, pct)), 0) * 100) / 100
}

/** The boxed sentence on the pay page. */
export function lienOfferSentence(o: LienPayOffer): string {
  return `Pay any of these bills in full by ${demandDate(o.by)} and it is ${o.pct}% less. The lower amount is on the page the code opens. Pay all of them and no lien is filed.`
}

/** "$5,616.00 if paid in full by November 15" — on a bill's row. */
export function lienOfferRowWords(amount: number, o: LienPayOffer): string {
  return `${demandMoney(String(lienOfferLowAmount(amount, o.pct)))} if paid in full by ${formatYmdMonthDay(o.by).replace(/^(\w{3}) /, (_, m: string) => `${MONTH_LONG[m] ?? m} `)}`
}

const MONTH_LONG: Record<string, string> = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' }

/** "November 15" — the day without its year. */
export function lienOfferDayWords(by: string): string {
  return formatYmdMonthDay(by).replace(/^(\w{3}) /, (_, m: string) => `${MONTH_LONG[m] ?? m} `)
}

/** The page's closing total: "$15,826.50 if all three are paid in full by November 15". */
export function lienOfferTotalWords(amounts: ReadonlyArray<number>, o: LienPayOffer): string {
  const n = amounts.length
  const total = amounts.reduce((s, a) => s + lienOfferLowAmount(a, o.pct), 0)
  const which = n === 1 ? 'it is' : n === 2 ? 'both are' : `all ${COUNT_WORDS[n] ?? n} are`
  return `${demandMoney(String(Math.round(total * 100) / 100))} if ${which} paid in full by ${lienOfferDayWords(o.by)}`
}

const COUNT_WORDS: Record<number, string> = { 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine' }

/** The pay page's rule line gains the payer: whoever pays gets the same amount off. */
export function lienOfferPayerLine(gcName: string): string {
  const gc = gcName.trim()
  return gc ? `Whoever pays, you or ${gc}, gets the same amount off.` : 'Whoever pays gets the same amount off.'
}

/** "Offer 10% by Nov 15" — the desk's chip. */
export function lienOfferChipWords(o: LienPayOffer): string {
  return `Offer ${o.pct}% by ${formatYmdMonthDay(o.by)}`
}

/** "with a 10% offer, by Nov 15" — after "Approved" on a row or a step card. */
export function lienOfferApprovedWords(o: LienPayOffer): string {
  return `with a ${o.pct}% offer, by ${formatYmdMonthDay(o.by)}`
}

/** The write-down's note on the bill, once paid in full with the offer. */
export function lienOfferWriteDownNote(o: LienPayOffer, paidOn: string): string {
  return `Lien notice offer: ${o.pct}% off, paid in full ${formatYmdMonthDay(paidOn)} (by ${formatYmdMonthDay(o.by)})`
}

/** The pay link page's line while the offer is live, after it ended, and once taken. */
export function lienOfferPayLinkWords(o: LienPayOffer, state: 'live' | 'ended' | 'taken'): string {
  if (state === 'live') return `${o.pct}% off if paid in full by ${lienOfferDayWords(o.by)}. Today it is.`
  if (state === 'ended') return `The ${o.pct}% offer ended ${lienOfferDayWords(o.by)}. This is the full amount owed.`
  return `Paid in full with the ${o.pct}% offer.`
}
