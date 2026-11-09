/**
 * The offer after the bill goes (v2.6772, punch list #291 PR 2). The owner, 2026-11-09: "after a bill is sent, it is
 * clear a user can elect to send the bill via SMS from our phone number." The green strip that follows Send Email
 * invoice, Bill Customer making a Stripe bill and Make Stripe bill converting one gains the one question and its press,
 * which opens the Tell the customer sheet on the bill (PR 1, v2.6771). A customer who asked for email only reads that
 * in place of the question. After the text goes the share row reads *Texted 3:32 PM* beside *Emailed 3:30 PM*, read
 * from the job's thread: an outbound text tied to the job whose body carries the bill's pay page. Pure; the reads are
 * `billTextOfferIo.ts`, the strip is `components/jobs/BillTextOfferStrip.tsx`.
 */
import { clockHm } from '../tellCustomer/tellCustomer'
import type { TellPrefers } from '../tellCustomer/tellCustomer'

/** What the strip offers: the question and its press, or the customer's say in their place. */
export type BillTextOffer = { kind: 'ask'; ask: string; press: string } | { kind: 'email-only'; words: string }

export function billTextOffer(first: string | null, prefers: TellPrefers): BillTextOffer {
  if (prefers === 'email') return { kind: 'email-only', words: BILL_TEXT_OFFER_WORDS.emailOnly(first) }
  return { kind: 'ask', ask: BILL_TEXT_OFFER_WORDS.ask(first), press: BILL_TEXT_OFFER_WORDS.press(first) }
}

/** A text on the job's thread, as the read hands it: when it went and its words. */
export interface BillText {
  at: string
  body: string
}

/**
 * Whether a text's words carry this bill's pay page: `/pay/<bill id>` on any host (the app's own page, the short host of
 * #290), or one of the bill's other links (Stripe's hosted link, the ten-letter code's page once a caller knows it).
 */
export function carriesBillLink(body: string, invoiceId: string, otherLinks: readonly string[] = []): boolean {
  const words = body.toLowerCase()
  const id = invoiceId.trim().toLowerCase()
  if (id && words.includes(`/pay/${id}`)) return true
  return otherLinks.some((l) => l.trim() && words.includes(l.trim().toLowerCase()))
}

/** When the newest text carrying this bill's link went, in milliseconds; null when none did. */
export function billTextedAt(texts: readonly BillText[], invoiceId: string, otherLinks: readonly string[] = []): number | null {
  let newest: number | null = null
  for (const t of texts) {
    if (!carriesBillLink(t.body, invoiceId, otherLinks)) continue
    const ms = Date.parse(t.at)
    if (!Number.isNaN(ms) && (newest === null || ms > newest)) newest = ms
  }
  return newest
}

/** The marks beside the share row: *Emailed 3:30 PM · Texted 3:32 PM*, *Emailed 3:30 PM · Not texted*, or *Texted 3:32 PM* alone. */
export function billSentMarks(emailedAtMs: number | null, textedAtMs: number | null): string | null {
  const parts: string[] = []
  if (emailedAtMs != null) parts.push(BILL_TEXT_OFFER_WORDS.emailed(emailedAtMs))
  if (textedAtMs != null) parts.push(BILL_TEXT_OFFER_WORDS.texted(textedAtMs))
  else if (emailedAtMs != null) parts.push(BILL_TEXT_OFFER_WORDS.notTexted)
  return parts.length ? parts.join(' · ') : null
}

export const BILL_TEXT_OFFER_WORDS = {
  /** The question on the strip. */
  ask: (first: string | null) => `Text ${first ?? 'the customer'} the pay link too? A text is read in minutes. Email waits for the evening.`,
  /** The press that opens the sheet on the bill. */
  press: (first: string | null) => `Text ${first ?? 'the customer'} the bill…`,
  notNow: 'Not now',
  /** In place of the question when the customer asked to hear from us by email (`contacts.prefers`). */
  emailOnly: (first: string | null) => `${first ?? 'The customer'} asked for email only.`,
  /** The strip's first line after Bill Customer made the Stripe bill: nothing has gone yet. */
  leadMade: 'The Stripe bill is made. Nothing has gone to the customer yet.',
  /** After Make Stripe bill converted one. */
  leadConverted: 'Now a Stripe bill. The pay link is live. Nothing was emailed.',
  /** The marks beside the row. */
  emailed: (ms: number) => `Emailed ${clockHm(ms)}`,
  texted: (ms: number) => `Texted ${clockHm(ms)}`,
  notTexted: 'Not texted',
} as const
