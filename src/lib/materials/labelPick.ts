/**
 * Which boxes Print labels prints (Taunya's ask of 2026-11-15, with a run of 455 strips stopped after five): a range
 * picked by its two ends, and the boxes a stopped run already printed taken off the pick, so the next press prints
 * the rest. The window keeps one set, the boxes left out, and every box's chip shows it; these read and write that
 * set. Pure. The window is `LabelsPrintModal.tsx`; the printer's side of a stop is `endsTheRun` in `ptouchRaster.ts`.
 */
import { clampTapeCopies } from './tapeLabel'

/** The labels beside the two ends of a range. */
export const LABEL_RANGE_FROM = 'From'
export const LABEL_RANGE_TO = 'to'
/** Under the two ends: what a pick does. */
export const LABEL_RANGE_WORDS = 'Ticks every box between the two.'

/** The first and the last ticked box, in the list's order; null when none is ticked. */
export function tickedRange(ids: ReadonlyArray<string>, left: ReadonlySet<string>): { fromId: string; toId: string } | null {
  const ticked = ids.filter((id) => !left.has(id))
  return ticked.length === 0 ? null : { fromId: ticked[0]!, toId: ticked[ticked.length - 1]! }
}

/**
 * The boxes left out once one end of the range is picked: every box between the two ends is ticked and every other
 * is not. The other end stays where it was (with nothing ticked: the list's far end), and an end picked past the
 * other pulls it along, so *From G40* over a range that ended at G12 is G40 alone.
 */
export function leftAfterRangePick(ids: ReadonlyArray<string>, left: ReadonlySet<string>, end: 'from' | 'to', id: string): Set<string> {
  const at = ids.indexOf(id)
  if (at < 0) return new Set(left)
  const now = tickedRange(ids, left)
  let from = end === 'from' ? at : now ? ids.indexOf(now.fromId) : 0
  let to = end === 'to' ? at : now ? ids.indexOf(now.toId) : ids.length - 1
  if (from > to) {
    if (end === 'from') to = from
    else from = to
  }
  return new Set(ids.filter((_, i) => i < from || i > to))
}

/**
 * The boxes whose every strip has gone, from how many strips the printer took. A box's copies go together,
 * 1 1 2 2, so a run stopped after three strips of two each has printed the first box whole and half of the second.
 */
export function boxesPrintedWhole<T>(boxes: ReadonlyArray<T>, doneStrips: number, copies: number): T[] {
  return boxes.slice(0, Math.max(0, Math.floor(doneStrips / clampTapeCopies(copies))))
}

/** The boxes left out after a run stopped part way: the ones it printed whole join them. */
export function leftAfterStop(left: ReadonlySet<string>, printedIds: ReadonlyArray<string>): Set<string> {
  return new Set([...left, ...printedIds])
}

/**
 * Said after a run stops part way, by a press or by the printer: which boxes are done and what the press does now.
 * `names` are the boxes printed whole, in the order they went; `rest` how many ticked boxes are still to print.
 */
export function printedUntickedWords(names: ReadonlyArray<string>, rest: number): string {
  if (names.length === 0) return rest > 0 ? 'No box printed whole, so every box is still ticked.' : ''
  const which = names.length === 1 ? `${names[0]} printed whole and is unticked.` : names.length === 2 ? `${names[0]} and ${names[1]} printed whole and are unticked.` : `${names[0]} to ${names[names.length - 1]} printed whole and are unticked.`
  return rest > 0 ? `${which} The press prints the rest.` : which
}
