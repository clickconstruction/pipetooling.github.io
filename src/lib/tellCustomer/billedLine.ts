/**
 * The Billed line's words (v2.6771, punch list #291), in their own file so the dev seat's bill verb (v2.6794, punch
 * list #293) reads the same line through the kernel copy (`scripts/edge-kernels.mjs`) as the Tell the customer sheet
 * reads it: the app's own line until the office writes one on the step, the bill's pay link last and nothing after it,
 * the opening saying who is writing, since a bill text is often the customer's first text from us. `DEFAULT_LINES.billed`
 * in `tellCustomer.ts` is this object. Pure.
 */
import { fillLine, type BlankFills } from '../quickReplies/blanks'

export const BILLED_LINE = {
  text: 'Hi {first}, this is {me} with Click Plumbing. Your bill for {job} is ready, {amount}. Text me here with any question. Pay it here: {bill}',
  textEs: 'Hola {first}, soy {me} de Click Plumbing. Su factura por {job} está lista, {amount}. Escríbame aquí con cualquier pregunta. Páguela aquí: {bill}',
} as const

/** A line in both languages: the office's on the step, or the app's own. */
export interface BilledLineWords {
  text: string
  textEs: string | null
}

/** The line's words in the customer's language: the Spanish when the customer reads it and the line has one, else the English (`quickReplies/language.ts`'s rule). */
export function billedLineWords(line: BilledLineWords, lang: 'en' | 'es'): string {
  return lang === 'es' && line.textEs?.trim() ? line.textEs : line.text
}

/** The text as it would go, and the blanks nobody filled. */
export function billedText(line: BilledLineWords, fills: BlankFills, lang: 'en' | 'es'): { text: string; left: string[] } {
  return fillLine(billedLineWords(line, lang), fills)
}
