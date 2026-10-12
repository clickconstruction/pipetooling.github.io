/**
 * Messages, cut 2's screens, PR C3: highlights, as the prototype's message window makes them (v1.178's `__hl`) and the
 * thread shows them in place of a line's first lines (`bodyHtml`). The words selected grow to whole words, so no half
 * word is ever marked; the same words twice are one highlight (`message_highlights`, one row per line and words).
 */
import { whenWords } from './thread'

/** The selection grown to whole words in the line's body. Words not found in it are kept as selected. */
export function wholeWords(body: string, selection: string): string {
  const text = selection.trim()
  if (!text) return ''
  const at = body.indexOf(text)
  if (at < 0) return text
  let a = at
  let b = at + text.length
  while (a > 0 && !/\s/.test(body[a - 1]!)) a--
  while (b < body.length && !/\s/.test(body[b]!)) b++
  return body.slice(a, b).trim()
}

/** The message window's first press. */
export const HIGHLIGHT_BUTTON = 'Highlight the selected words'

/** Its hover: what it marks, and what the thread does with it. */
export const HIGHLIGHT_TIP = 'Marks the words you selected. The thread shows them instead of the first lines.'

/** What the office reads after a highlight. */
export const HIGHLIGHTED_TOAST = 'Highlighted. The thread shows it instead of the first lines.'

/** The press that takes highlights off, with nothing selected. */
export function removeHighlightsLabel(count: number): string {
  return count > 1 ? 'Remove the highlights' : 'Remove the highlight'
}

/** What the office reads after removing. */
export function highlightsRemovedToast(count: number): string {
  return count > 1 ? `${count} highlights removed.` : 'Highlight removed.'
}

/** Under a highlight in the thread: "highlighted by Rosa · today at 2:30 PM". */
export function highlightedByWords(by: string, atIso: string, nowIso: string): string {
  return `highlighted by ${by} · ${whenWords(atIso, nowIso)}`
}
