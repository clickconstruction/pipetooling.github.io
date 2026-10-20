/**
 * Messages R3: a quick reply's Spanish in the editor (`to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md` → R3's
 * screens). Lifted from the residential prototype v0.8 on branch spike/gc-mode (`customer-messages-prototype.html`:
 * `editRow`'s Spanish box and `flags`), the words and the rules, never the DOM. Pure.
 *
 * A line for customers carries its words in English and, once someone writes it, in Spanish (`quick_replies.text_es`).
 * A customer who reads Spanish gets the Spanish when it is there, else the English (`phone.ts`'s `wordsFor`). The
 * editor marks a customer line with no Spanish **no es**, so the office sees the gap and fills it.
 *
 * The strip and *Find a reply* show a line in the language the person reads (`lineWords`), from `customerLang`, which
 * holds Spanish behind the owner's one switch, `PORTAL_SPANISH_ON`. Until it is on, every line reads English.
 */

import type { PortalLang } from '../gc/portalI18n'
import { onThePhone, type QuickReply } from './kernel'
import { wordsFor } from './phone'

/** The editor offers a Spanish box on a line for customers, the people who read the Spanish. */
export function spanishOffered(line: Pick<QuickReply, 'for'>): boolean {
  return line.for === 'customer'
}

/** A row's marks beside its words: on the phone, its Spanish (es, or no es for the gap), and mine. */
export interface LineMarks {
  phone: boolean
  es: 'es' | 'no es' | null
  mine: boolean
}

export function lineMarks(line: QuickReply): LineMarks {
  return {
    phone: onThePhone(line),
    es: spanishOffered(line) ? (line.textEs?.trim() ? 'es' : 'no es') : null,
    mine: line.scope === 'mine',
  }
}

/**
 * A line's words in a language: its Spanish when that is the language and it has Spanish, else its English. The pick is
 * `phone.ts`'s `wordsFor`, read from a line that may predate R3's columns.
 */
export function lineWords(line: Pick<QuickReply, 'text' | 'textEs'>, lang: PortalLang): string {
  return wordsFor({ text: line.text, textEs: line.textEs ?? null }, lang)
}

/** The strip's count gains this while it shows the Spanish: "3 for customers · in Spanish". */
export const IN_SPANISH = 'in Spanish'

/** The Spanish box's words. */
export const SPANISH_WORDS = {
  label: 'Spanish',
  none: 'None yet, so a Spanish speaker reads the English.',
  placeholder: 'La misma línea en español…',
  esTip: 'This line has its Spanish. A customer who reads Spanish gets it.',
  noEsTip: 'No Spanish yet. A customer who reads Spanish gets the English until someone writes it.',
  phoneTip: 'On the tech’s phone. The Phone tab sets its place.',
} as const
