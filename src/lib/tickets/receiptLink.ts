/**
 * A receipt link for a card charge (punch list #299, PR 1): the words the page at `/r/<code>` and the office's Copy
 * the receipt link say, over the rules in `supabase/functions/_shared/receiptLink.ts`, one source for the function and
 * the app. Pure. The words follow the plain-words rules: one idea a sentence, the control's exact name.
 */
import { formatCurrency } from '../format'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import type { ReceiptPageCharge } from '../../../supabase/functions/_shared/receiptLink'

export {
  RECEIPT_DAY_JOBS_MAX,
  RECEIPT_LINK_ALPHABET,
  RECEIPT_LINK_CAPS,
  RECEIPT_LINK_CODE_LENGTH,
  RECEIPT_LINK_WORDS,
  buildReceiptCharge,
  mintReceiptLinkCode,
  receiptChargeDead,
  receiptFirstName,
  receiptHexOf,
  receiptLinkCode,
  receiptLinkExpired,
  receiptLinkExpiry,
  receiptNextPageNo,
  receiptSniff,
  receiptTicketJob,
  type ReceiptChargeFacts,
  type ReceiptJob,
  type ReceiptJobPick,
  type ReceiptPageCharge,
  type ReceiptPageMime,
  type ReceiptPageTicket,
  type ReceiptTicketDoor,
} from '../../../supabase/functions/_shared/receiptLink'

export const RECEIPT_COMPANY = 'Click Plumbing'

// Where a link points lives beside the text's words since PR 2, so the sweep on the edge builds the same address.
export { RECEIPT_SHORT_ORIGIN, receiptLinkUrl } from '../../../supabase/functions/_shared/receiptText'

/** *$228.58 at Ridgeway Supply*, or *$41.17 back from Cedar Bend Hardware* for money that came back. */
export function receiptChargeWords(c: Pick<ReceiptPageCharge, 'amount' | 'store' | 'moneyBack'>): string {
  const money = `$${formatCurrency(c.amount)}`
  return c.moneyBack ? `${money} back from ${c.store}` : `${money} at ${c.store}`
}

/** *Tue, Nov 4, 10:02 AM* on the company's clock; empty when the time does not read. */
export function receiptWhenWords(iso: string | null | undefined): string {
  const ms = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(ms)) return ''
  return new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(ms))
}

/** *10:02 AM* on the company's clock. */
export function receiptTimeWords(iso: string | null | undefined): string {
  const ms = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(ms)) return ''
  return new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(ms))
}

/** *Jordan's card*, or *A company card* for a card tied to no one. */
export function receiptCardWords(cardOf: string): string {
  const who = cardOf.trim()
  return who ? `${who}${/s$/i.test(who) ? '’' : '’s'} card` : 'A company card'
}

/** The Job line of the charge's facts: where the office sorted it, else what the ticket says, else *not sorted yet*. */
export function receiptJobLine(c: Pick<ReceiptPageCharge, 'sortedJob' | 'ticket'>): { words: string; quiet: boolean } {
  if (c.sortedJob) return { words: c.sortedJob, quiet: false }
  if (c.ticket?.job) return { words: c.ticket.job, quiet: false }
  if (c.ticket?.noOneJob) return { words: 'Not for one job', quiet: false }
  return { words: 'not sorted yet', quiet: true }
}

/** The headline once a receipt is on the charge, by the door it came through. */
export function receiptOnChargeWords(c: ReceiptPageCharge): { headline: string; line: string | null } {
  const t = c.ticket
  if (!t) return { headline: '', line: null }
  if (t.door === 'link') return { headline: `Got it. The receipt is on ${receiptChargeWords(c)}.`, line: null }
  const at = receiptTimeWords(t.takenAt)
  const job = t.job ? `, for ${t.job}` : ''
  const line = t.door === 'office' ? `The office scanned it${at ? ` at ${at}` : ''}${job}.` : `It was taken in Tally${at ? ` at ${at}` : ''}${job}.`
  return { headline: 'This charge has its ticket already.', line }
}

/** *This link opens until Nov 18.* from the day the function answers (`YYYY-MM-DD`); empty when it does not read. */
export function receiptClosesWords(closesOn: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(closesOn ?? '')
  if (!m) return ''
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))))
  return `This link opens until ${day}.`
}

/** The office's toast after Copy the receipt link. */
export function receiptCopiedWords(chargeWords: string, closesOn: string | null | undefined): string {
  const until = receiptClosesWords(closesOn).replace(/^This link opens/, 'It opens')
  return `Receipt link copied for ${chargeWords}. ${until || 'It opens for 14 days.'}`
}

/** The page's words, in one place so the render test and the guide read the same ones. */
export const RECEIPT_PAGE_WORDS = {
  eyebrow: `${RECEIPT_COMPANY} · receipt`,
  camera: 'Take a photo of the receipt',
  file: 'or choose a photo or a PDF you already have',
  jobAsk: 'Which job was it for?',
  jobSkip: 'You can skip this.',
  jobNote: 'Your jobs around the day of the charge.',
  notOneJob: 'Not for one job',
  sortedNote: 'The office sorted this charge already, so the page asks no job. A photo still goes on it.',
  onCharge: 'Receipt on the charge',
  retake: 'Retake',
  addPage: '+ Add a page',
  addPageNote: 'A long receipt is two pages.',
  closeNote: 'You can close this page. Open the link again to add a page or change the job.',
  onlyThis: 'This link is for this charge alone. It shows nothing else.',
  sending: 'Sending the receipt…',
  leaveNote: 'Stay on this page until it sends. Leaving the page loses the photo.',
  noSignal: 'No signal. The photo is still on this page.',
  retry: 'Try again',
  jobNoSignal: 'No signal. The job did not change.',
  keptNote: 'The first photo is filed already, so this one was added as another page.',
  closedHeadline: 'This link has closed.',
  closedLine: 'A receipt link opens for 14 days. Open Job Parts Tally in the app and press Photo of a ticket to add the receipt.',
  notFoundLine: 'This link opens nothing. Check the link in your text, or ask the office for a new one.',
  openTally: 'Open Job Parts Tally',
  lockedHeadline: 'Too many wrong links.',
  lockedLine: 'Wait an hour, then open your link again.',
  signalHeadline: 'The page did not load.',
  signalLine: 'Check the signal, then try again.',
  deadLine: 'The bank took this charge back, so there is nothing to photograph.',
  pdf: 'PDF',
} as const
