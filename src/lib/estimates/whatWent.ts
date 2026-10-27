/**
 * What went (v2.5683, punch list #133 PR 2): a sent estimate keeps the receipt's facts where the office reads the
 * estimate — the email with its time, each estimate-link text in the customer's thread (a resend shows as its own
 * row), or why no text went. Pure words over what the io read; the card is
 * `components/estimates/EstimateWhatWent.tsx`, the reads `whatWentIo.ts`.
 */
import { clockDay, clockHm, firstWord } from '../tellCustomer/tellCustomer'

/** An estimate-link text in their thread: when it went and the number it went to. */
export interface WhatWentText {
  id: string
  atMs: number
  to: string | null
}

/** A letter sent again (v2.5997, #206 PR 4): a resend made a fresh link, a remail kept the one they have. */
export interface WhatWentEmailAgain {
  id: string
  atMs: number
  to: string | null
  kind: 'resent' | 'remailed'
}

export interface WhatWentFacts {
  /** The address the estimate emailed to (`estimates.customer_email`). */
  email: string | null
  /** `estimates.sent_at` as ms; null when the row never stamped one. */
  sentAtMs: number | null
  /** The letters sent again, oldest first; absent on a card that read none. */
  emailsAgain?: WhatWentEmailAgain[]
  /** The texts in their thread carrying this estimate's live link (`acceptLinkTie.ts`, v2.5697), oldest first. */
  texts: WhatWentText[]
  /** Their thread, when one exists. */
  contact: { contactId: string; hasPhone: boolean; stopped: boolean } | null
}

export interface WhatWentRow {
  icon: string
  words: string
  /** "Tue, Oct 20 at 1:31 PM", or null when the row has no time of its own. */
  when: string | null
  /** The row carries the door to their thread. */
  thread: boolean
  /** An amber why-not row. */
  hold: boolean
}

/** An instant for the card: "Tue, Oct 20 at 1:31 PM". */
export const atWords = (ms: number) => `${clockDay(ms)} at ${clockHm(ms)}`

/** The card's rows: the email, each text, and the why-not when no text ever carried the link. */
export function whatWentRows(facts: WhatWentFacts, customerName: string | null): WhatWentRow[] {
  const first = firstWord(customerName)
  const rows: WhatWentRow[] = []
  if (facts.email) rows.push({ icon: '📧', words: `Emailed to ${facts.email}`, when: facts.sentAtMs ? atWords(facts.sentAtMs) : null, thread: false, hold: false })
  for (const e of facts.emailsAgain ?? []) {
    rows.push({
      icon: '📧',
      words: `Emailed again to ${e.to ?? facts.email ?? 'them'}${e.kind === 'remailed' ? ', same link' : ', a fresh link'}`,
      when: atWords(e.atMs),
      thread: false,
      hold: false,
    })
  }
  for (const t of facts.texts) rows.push({ icon: '💬', words: `Texted the link to ${t.to ?? 'their number'}`, when: atWords(t.atMs), thread: true, hold: false })
  if (facts.texts.length === 0) {
    const words =
      !facts.contact || !facts.contact.hasPhone
        ? `No text went. ${first ? `${first} has` : 'They have'} no phone number on file.`
        : facts.contact.stopped
          ? 'No text went. Their number sent STOP. The email carries the link.'
          : 'No text went with the link. Send one from their thread.'
    rows.push({ icon: '💬', words, when: null, thread: Boolean(facts.contact), hold: true })
  }
  return rows
}

export const WHAT_WENT_WORDS = {
  title: 'What went',
  thread: 'Open the thread',
  reading: 'Reading what went…',
}
