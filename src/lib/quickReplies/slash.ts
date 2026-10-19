/**
 * Quick replies by keyboard (punch list #126, the owner's pick A): a `/` typed at the start of the reply box, or after a
 * space or a line break, opens a short list of the person's quick replies under the box, narrowed by the words typed
 * after it. ↑ ↓ move through it, Enter or Tab puts the line in the box in place of the `/` word, Escape closes it.
 * Pure: the box hands the text and the caret in, and takes the list and the new text back.
 *
 * A `/` inside a word is just a `/`: *1/2 inch*, *and/or*, *10/19* and a link open nothing, and neither does a `/`
 * with a space straight after it. The list is the strip's lines in the strip's order (`qrGroups`), so the step they
 * are on and the job's stage come first, and a pick counts as a press, as the strip's does.
 */
import { qrGroups, type QrGroupsInput, type QuickReply } from './kernel'

/** The box's placeholder gains this while a text or an email is written. */
export const SLASH_HINT = 'Type / for a quick reply.'

/** The keys, said once under the list. */
export const SLASH_KEYS = ['↑ ↓ pick', 'Enter or Tab fills', 'Esc closes'] as const

/** No line holds the words typed after the `/`. */
export const SLASH_NONE = 'No quick reply has those words. Esc closes, or keep writing.'

/** The lines are being read, the first time the list opens. */
export const SLASH_READING = 'Reading the quick replies…'

/** The list's head: whose lines, and how many of them fit the words. */
export function slashHead(first: string | null, shown: number, total: number): { title: string; count: string } {
  const who = first?.trim()
  return { title: who ? `Quick replies for ${who}` : 'Quick replies', count: `${shown} of ${total}` }
}

/** Words after a `/` longer than this are a sentence, not a line's name, so the list stays closed. */
export const SLASH_WORDS_MAX = 40

/** The `/` word the caret is in: where the `/` is, where the word ends, and the words after the `/`. */
export interface SlashWord {
  start: number
  end: number
  words: string
}

const isSpace = (ch: string | undefined) => ch !== undefined && /\s/.test(ch)

/**
 * The `/` word the caret sits in, or null. The word runs from the last space before the caret to the first space after
 * it; it is a `/` word when it starts with the `/`, so the `/` opens the box or follows a space or a line break. A
 * second `/` in it makes it a path or a date, not a reply.
 */
export function slashWordAt(text: string, caret: number): SlashWord | null {
  if (caret < 1 || caret > text.length) return null
  let start = caret
  while (start > 0 && !isSpace(text[start - 1])) start--
  if (text[start] !== '/') return null
  let end = caret
  while (end < text.length && !isSpace(text[end])) end++
  const words = text.slice(start + 1, end)
  if (words.includes('/') || words.length > SLASH_WORDS_MAX) return null
  return { start, end, words }
}

/** The groups' input the strip already builds, less the narrow box's words and its place. */
export type SlashInput = Omit<QrGroupsInput, 'filter' | 'place'>

/** The lines the list offers for the words, in the strip's order: the job's stage, the step they are on, their kind, anyone. */
export function slashLines(lines: readonly QuickReply[], input: SlashInput, words: string): QuickReply[] {
  return qrGroups(lines, { ...input, filter: words, place: 'strip' }).flatMap((g) => g.rows)
}

/** Every line the strip would show them, for the head's count. */
export function slashTotal(lines: readonly QuickReply[], input: SlashInput): number {
  return slashLines(lines, input, '').length
}

/** The box once a line is picked: the `/` word gives way to the filled line, the rest stays, the caret after the line. */
export function slashPick(text: string, word: SlashWord, filled: string): { text: string; caret: number } {
  const before = text.slice(0, word.start)
  return { text: before + filled + text.slice(word.end), caret: before.length + filled.length }
}

/** The next row with ↓ or ↑, round the ends. */
export function slashMove(active: number, count: number, step: 1 | -1): number {
  if (count <= 0) return 0
  return (((active + step) % count) + count) % count
}
