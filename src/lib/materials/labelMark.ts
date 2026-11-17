/**
 * The printed mark on a box (punch list #304; the owner's word of 2026-11-16, v2.7519): the app remembers when a
 * box's label last went out (`job_containers.label_printed_at`), so Print labels can say which boxes still wait for
 * one where it could only say which were added this week.
 *
 * A box is marked when the last copy of its strip leaves the P-touch, when the print window closes on its label, or
 * when a person says it already wears one. A box made before the mark began reads unmarked whether or not it wears a
 * label, and nothing can tell the two apart, so only a box made since then counts as *not printed yet*. Pure: the
 * boxes and the run in, the ids and the words out.
 */
import { countedLabel } from '../batchWords'
import type { Container } from './onSite'

/** When the app began keeping the mark: midnight of 2026-11-17 in the app's time zone. A box made before it is not counted. */
export const LABEL_MARK_SINCE = '2026-11-17T06:00:00Z'
const SINCE_MS = Date.parse(LABEL_MARK_SINCE)

type Marked = Pick<Container, 'id' | 'createdAt' | 'labelPrintedAt'>

/** The app saw this box's label go out, or a person said it wears one. */
export function labelPrinted(box: Pick<Container, 'labelPrintedAt'>): boolean {
  return typeof box.labelPrintedAt === 'string' && box.labelPrintedAt !== ''
}

/** Made since the mark began, with no label seen. A box with no readable day is not counted. */
export function labelWaits(box: Pick<Container, 'createdAt' | 'labelPrintedAt'>): boolean {
  if (labelPrinted(box)) return false
  const made = Date.parse(box.createdAt)
  return Number.isFinite(made) && made >= SINCE_MS
}

/**
 * The boxes that still wait for a label, by their ids: made since the mark began, no label seen, and no sticker on
 * them, since a sticker is a label. `stickeredIds` is the boxes that wear a sticker.
 */
export function notPrintedIds(boxes: ReadonlyArray<Marked>, stickeredIds: ReadonlySet<string>): string[] {
  return boxes.filter((b) => labelWaits(b) && !stickeredIds.has(b.id)).map((b) => b.id)
}

/** Every box is known to carry a code: its label was seen to print, or it wears a sticker. False for no boxes. */
export function everyBoxLabelled(boxes: ReadonlyArray<Marked>, stickeredIds: ReadonlySet<string>): boolean {
  return boxes.length > 0 && boxes.every((b) => labelPrinted(b) || stickeredIds.has(b.id))
}

/**
 * The boxes whose label went, of a run sent strip by strip: a box counts once the last of its strips is among the
 * first `done`. A box part way through its copies does not count.
 */
export function boxesWhoseLabelWent(strips: ReadonlyArray<{ id: string }>, done: number): string[] {
  const last = new Map<string, number>()
  strips.forEach((s, i) => last.set(s.id, i))
  return [...last.entries()].filter(([, i]) => i < done).map(([id]) => id)
}

/** Of the boxes just marked, the ones that had no mark before: what the line counts and what its press takes back. */
export function newlyMarkedIds(ids: ReadonlyArray<string>, boxes: ReadonlyArray<Pick<Container, 'id' | 'labelPrintedAt'>>): string[] {
  const had = new Set(boxes.filter(labelPrinted).map((b) => b.id))
  return ids.filter((id) => !had.has(id))
}

/** *12 boxes are now marked as labelled.* */
export function markedWords(n: number): string {
  return n === 1 ? '1 box is now marked as labelled.' : `${n} boxes are now marked as labelled.`
}

/** *The mark is off 12 boxes.* */
export function unmarkedWords(n: number): string {
  return n === 1 ? 'The mark is off 1 box.' : `The mark is off ${n} boxes.`
}

/** The question before the press that takes a mark back. */
export const MARK_UNDO_ASK = 'Did they not print?'

/** *Take the mark off 12 boxes*: the press under a run that did not print after all. */
export function takeMarkOffLabel(n: number): string {
  return countedLabel('Take the mark off', n, ['box', 'boxes'])
}

/** *Mark 12 boxes as labelled*: the press for boxes that wear a label the app did not print. */
export function markAsLabelledLabel(n: number): string {
  return n <= 0 ? 'Mark as labelled' : `Mark ${n} ${n === 1 ? 'box' : 'boxes'} as labelled`
}

/** What the press above is for, as its title. */
export const MARK_AS_LABELLED_WHY = 'For boxes that already wear a label, from a CSV or by hand. Nothing prints.'

/** *The 5 not printed yet*: the door of a card onto those boxes alone. */
export function notPrintedDoorLabel(n: number): string {
  return n === 1 ? 'The 1 not printed yet' : `The ${n} not printed yet`
}

/** *5 not printed yet*: the chip of a card. */
export function notPrintedChipWords(n: number): string {
  return `${n} not printed yet`
}

/** The chip of a card whose every box is known to carry a code. */
export const ALL_LABELLED_WORDS = 'Every box is labelled'
