/**
 * Messages R3: the language a quick reply's words go in, the one home of the rule (`phone.ts`, the strip, the morning
 * run and `quo-send` read it). Its one import is a type from a file `quo-send`'s copy of the kernels already holds, so
 * the edge reads the same rule.
 */
import type { PortalLang } from '../gc/portalI18n'

/** A quick reply's words in both languages: `quick_replies.text` and `text_es`. */
export interface LineWords {
  text: string
  textEs: string | null
}

/**
 * The words a person reads: the Spanish when they read Spanish and the line has it, else the English. The caller
 * passes the language shown (`portalShownLang`, `customerLang`), so Spanish waits behind the owner's switch.
 */
export function wordsFor(line: LineWords, lang: PortalLang): string {
  return lang === 'es' && line.textEs?.trim() ? line.textEs : line.text
}
