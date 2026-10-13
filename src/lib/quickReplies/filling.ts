/**
 * Messages R3: filling a quick reply's blanks on screen (`to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md` → R3's
 * screens). Lifted from the residential prototype v0.8 on branch spike/gc-mode (`customer-messages-prototype.html`:
 * `chipsHtml`, `wireChips`, `previewHtml`, and the box that waits while a blank is left), the words and the rules,
 * never the DOM. Pure, over `blanks.ts`.
 *
 * The editor's chips put a blank in a line's words, and its preview shows the line as it would go. The reply box fills
 * what it knows on the press: their first name, yours and the job's name. A blank it cannot fill stays in the box, and
 * the box will not send until the person fills it.
 */

import { BLANKS, THEIRS, blanksIn, blankNames, fillFirst, fillLine, type BlankFills } from './blanks'

/** One chip under a line's words: the blank, its words, and whether the app leaves it to the person. */
export interface BlankChip {
  key: string
  label: string
  words: string
  theirs: boolean
}

/** The chips in the editor's order: the app's blanks, then the two the person fills. */
export const BLANK_CHIPS: readonly BlankChip[] = [
  ...BLANKS.map((b) => ({ key: b.key, label: `{${b.key}}`, words: b.words, theirs: false })),
  ...THEIRS.map((b) => ({ key: b.key, label: `{${b.key}}`, words: `${b.words}, yours to fill`, theirs: true })),
]

/** A chip's blank put in the words at the cursor, in place of any selection, with the caret after it. */
export function insertBlank(text: string, start: number, end: number, key: string): { text: string; caret: number } {
  const from = Math.max(0, Math.min(start, text.length))
  const to = Math.max(from, Math.min(end, text.length))
  const blank = `{${key}}`
  return { text: text.slice(0, from) + blank + text.slice(to), caret: from + blank.length }
}

/** The editor's preview: the line as it would go, and what the box leaves to the person. */
export function preview(text: string, fills: BlankFills, to: string | null): { text: string; note: string } {
  const filled = fillLine(text, fills)
  const head = to?.trim() ? `As it would go to ${to.trim()}.` : 'As it would go.'
  const left = filled.left.length ? ` Fill ${blankNames(filled.left)} in the box before it sends.` : ''
  return { text: filled.text, note: head + left }
}

/** What the reply box fills on a press: their first name, the signed-in person's first name and the job's name. */
export function replyFills(input: { first: string | null; myName: string | null; jobName: string | null }): BlankFills {
  const firstWord = (name: string | null) => name?.trim().split(/\s+/)[0] || null
  return { first: input.first?.trim() || null, me: firstWord(input.myName), job: input.jobName?.trim() || null }
}

/** Why the box will not send while a blank is left in it, or null when none is. Braces with a word in them are a blank. */
export function sendWaits(body: string): string | null {
  return fillFirst(blanksIn(body))
}
