/**
 * Messages, residential R8 · 16: the language a customer reads (card 16 of `customer-messages-integrations-mockups.html`
 * v0.2 on branch spike/gc-mode, `RESIDENTIAL_BUILD_PLAN.md` → R8). It lives on the customer's row
 * (`customers.language`, migration 20261013220000) and reaches every contact of theirs as `Contact.lang` through
 * `contacts/load.ts`, as a trade partner's lives on `gc_companies.lang` and goes out through `tradeMailLang`.
 *
 * Unset is English, and nothing guesses from a name. Spanish is held behind the portal's gate (`PORTAL_SPANISH_ON`)
 * until a native speaker reads the words, so the strip, the phone and the morning run pass `customerLang(contact)` to a
 * quick reply's words. The gate is a parameter so a test can open it.
 */
import type { Contact } from '../contacts/kernel'
import { PORTAL_SPANISH_ON, type PortalLang } from '../gc/portalI18n'
import { wordsFor, type PhoneLine } from '../quickReplies/phone'

/** The language a customer's lines go out in: theirs once Spanish is on, English until then. `tradeMailLang`'s rule. */
export function customerLang(contact: Pick<Contact, 'lang'>, gate: boolean = PORTAL_SPANISH_ON): PortalLang {
  return contact.lang === 'es' && gate ? 'es' : 'en'
}

/** A quick reply's words: `wordsFor`'s input in `quickReplies/phone.ts`. */
export type QuickLineWords = Pick<PhoneLine, 'text' | 'textEs'>

/**
 * The quick reply in the customer's language: its Spanish when they read Spanish and the gate is open, else its English.
 * A line with no Spanish goes in English. The pick is `wordsFor`'s.
 */
export function lineFor(line: QuickLineWords, contact: Pick<Contact, 'lang'>, gate: boolean = PORTAL_SPANISH_ON): string {
  return wordsFor(line, customerLang(contact, gate))
}

/** The customer card's field, as the record keeps it whatever the gate: "Reads Spanish", "Reads English". */
export function languageWords(contact: Pick<Contact, 'lang'>): string {
  return contact.lang === 'es' ? 'Reads Spanish' : 'Reads English'
}
