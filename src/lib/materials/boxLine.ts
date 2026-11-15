/**
 * Materials on site: what is in a box, on the client (punch list #351, PR 2). The line itself is the kernel shared
 * with the scanned page's function (`supabase/functions/_shared/boxLine.ts`): the app writes it from the box's parts
 * until a person says it better, and clearing a person's words hands it back to the app.
 *
 * This file adds what only the screens need: the line of one box out of a job's lines, the words and the verdict of
 * **Say it better**, and where words typed into a name go, which is this line since PR 2 (PR 1 parked them on the
 * where line). Pure rules and words only; the write is `sayBoxLine` and `editContainer` in `onSiteStore.ts`.
 */
import { BOX_LINE_MAX, boxLine, boxLineShort, boxNameWithLine, cleanBoxLine, type BoxLine } from '../../../supabase/functions/_shared/boxLine'
import { linesOf, type Container, type ContainerLine } from './onSite'

export { BOX_LINE_MAX, boxLine, boxLineFromParts, boxLineShort, boxNameWithLine, cleanBoxLine, type BoxLine, type BoxLineBy, type BoxLinePart } from '../../../supabase/functions/_shared/boxLine'

/** The press on a box's screen that takes a person's own words. */
export const SAY_IT_BETTER_LABEL = 'Say it better'
/** The field's own name wherever the line is typed. */
export const BOX_LINE_FIELD_LABEL = 'What is in it'
/** Beside a line the app wrote. */
export const BOX_LINE_FROM_PARTS = 'from its parts'
/** Under a line a person wrote, so nobody takes the words for the count. */
export const BOX_LINE_SAID_NOTE = 'In a person’s words. The parts under it still count.'
/** Under the empty field on an Add sheet: the line is never asked for. */
export const BOX_LINE_LATER_NOTE = 'You can say later. Add a part and this line fills in by itself.'

type SaidBox = Pick<Container, 'id' | 'said'>

/** The line of one box out of its job's lines: the parts a crew sees in it with something on hand. */
export function boxLineOf(box: SaidBox, lines: ReadonlyArray<ContainerLine>): BoxLine {
  return boxLine(box.said, linesOf(lines, box.id))
}

/** The same box's line for a chip: *R76 · Kohler toilets*. */
export function boxChipWords(box: SaidBox & Pick<Container, 'label'>, lines: ReadonlyArray<ContainerLine>): string {
  return boxNameWithLine(box.label, boxLineShort(box.said, linesOf(lines, box.id)))
}

/** The press as the box's screen draws it: *Say it better* over a line, *Say what is in it* when there is none yet. */
export function sayItBetterPress(line: BoxLine): string {
  return line.by === 'none' ? 'Say what is in it' : SAY_IT_BETTER_LABEL
}

/** The sheet's title: *What is in R83*. */
export function sayItBetterTitle(box: Pick<Container, 'label'>): string {
  return `What is in ${box.label}`
}

/** Under the title: what the line reads now and who wrote it, so the person knows what their words replace. */
export function sayItBetterSub(line: BoxLine): string {
  if (line.by === 'person') return 'These are a person’s words. Change them, or clear them and the app writes the line from the parts again.'
  if (line.by === 'app') return `The app wrote “${line.text}” from the parts. Your own words show in its place.`
  return 'Nothing is in it yet, so there is no line. Your own words show until parts say more.'
}

export type BoxLineVerdict =
  /** `said` is what the column takes: the words, or null when they were cleared and the app writes the line again. */
  | { ok: true; said: string | null }
  | { ok: false; reason: 'same' | 'long'; words: string }

const longWords = (n: number) => `The line holds ${BOX_LINE_MAX} characters. This one is ${n}.`

/** Whether what was typed can be saved. Nothing changed is a quiet no, as in Edit. */
export function boxLineVerdict(box: Pick<Container, 'said'>, typed: string): BoxLineVerdict {
  const now = cleanBoxLine(typed)
  if (now.length > BOX_LINE_MAX) return { ok: false, reason: 'long', words: longWords(now.length) }
  if (now === cleanBoxLine(box.said)) return { ok: false, reason: 'same', words: '' }
  return { ok: true, said: now || null }
}

/** The press: *Save the line*, or *Use the app’s line* when a person's words were cleared. */
export function boxLinePressLabel(box: Pick<Container, 'said'>, typed: string): string {
  return cleanBoxLine(typed) === '' && cleanBoxLine(box.said) !== '' ? 'Use the app’s line' : 'Save the line'
}

/** The toast after the press. */
export function boxLineSavedWords(box: Pick<Container, 'label'>, said: string | null): string {
  return said ? `${box.label} reads “${said}” now.` : `${box.label}’s line is from its parts again.`
}

// ── Words typed into a name ─────────────────────────────────────────────────────────────────────────────────────

/**
 * What an Add sheet's line field shows and saves. `typed` is null while nobody has touched the field: the words split
 * off the name stand in it then, so `R90 TOILETS` shows *Toilets* in **What is in it** and nothing typed is thrown away.
 * Once the field is touched it is the person's own and the name's words no longer write over it.
 */
export function lineFieldValue(typed: string | null, nameWords: string): string {
  return typed ?? nameWords
}

/** The words about the name's words, under the name: where they went. Null when the name carried none. */
export function nameWordsNote(nameWords: string, lineTyped: string | null): string | null {
  if (!nameWords) return null
  if (lineTyped === null || cleanBoxLine(lineTyped).toLowerCase() === nameWords.toLowerCase()) return `“${nameWords}” moved to ${BOX_LINE_FIELD_LABEL}.`
  return `“${nameWords}” is not part of the name. ${BOX_LINE_FIELD_LABEL} holds what you typed there.`
}

/** The line an Add sheet saves: the field as it stands, or null when it is empty. Past 80 characters the press is dead. */
export function addedLineVerdict(typed: string | null, nameWords: string): { ok: true; said: string | null } | { ok: false; words: string } {
  const line = cleanBoxLine(lineFieldValue(typed, nameWords))
  if (line.length > BOX_LINE_MAX) return { ok: false, words: longWords(line.length) }
  return { ok: true, said: line || null }
}
