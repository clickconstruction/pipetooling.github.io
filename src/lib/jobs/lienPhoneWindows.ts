/**
 * The Lien window and the run window on a phone (punch list #352, PR 7).
 *
 * Both were drawn for a computer and shrunk: a window inset from the screen's edges with a header that stays put.
 * On a phone the Lien window's header was 377 px of a 662 px card and its footer 120, so the paper showed through
 * 168 px, and through nothing at 320 wide. The run window's six steps took 175 px in two rows of three.
 *
 * Here: the Lien window's header folds to its title line once the paper is scrolled, and comes back at the top;
 * the run's six steps are one line that unfolds. Pure: when the header folds and what the one line says.
 */
import type { RunJourney } from './runJourney'

/** How far the paper is scrolled before the header folds, in px. */
export const LIEN_WINDOW_FOLD_AT_PX = 48

/**
 * Whether the Lien window's header is folded after a scroll of the paper under it.
 *
 * It folds once the paper is `LIEN_WINDOW_FOLD_AT_PX` down, and only when the paper would still scroll that far
 * with the header gone: folding gives the paper the header's height, and a paper that then fit whole would snap to
 * its top and unfold the header again, back and forth. It unfolds only at the very top.
 */
export function lienWindowHeadFolded(i: { folded: boolean; scrollTop: number; scrollHeight: number; clientHeight: number; foldable: number; /** The header was folded because the screen is too small for it (`lienWindowHeadStartsFolded`): a scroll never brings it back, only its own press. */ held?: boolean }): boolean {
  if (i.folded) return i.held ? true : i.scrollTop > 2
  if (i.scrollTop <= LIEN_WINDOW_FOLD_AT_PX) return false
  return i.scrollHeight - i.clientHeight - Math.max(0, i.foldable) >= LIEN_WINDOW_FOLD_AT_PX
}

/** The least room the paper should open with, in px: under this the header starts folded. */
export const LIEN_WINDOW_PAPER_MIN_PX = 140

/**
 * Whether the window opens with its header folded: on a phone so small that the header would leave the paper under
 * `LIEN_WINDOW_PAPER_MIN_PX` (at 320 × 520 it left 24). Heights the page could not read yet fold nothing.
 */
export function lienWindowHeadStartsFolded(px: { card: number; paper: number }): boolean {
  return px.card > 0 && px.paper < LIEN_WINDOW_PAPER_MIN_PX
}

/** The press on the title line that folds the header and brings it back. */
export function lienWindowHeadFoldWords(folded: boolean): { label: string; mark: string } {
  return folded ? { label: 'Show the next step and the job’s details', mark: '▾' } : { label: 'Hide the next step and the job’s details', mark: '▴' }
}

/** Whether a scroll the card heard is the paper's: up and down, in something that scrolls that way. A tab strip sliding sideways is not. */
export function lienWindowScrollIsPaper(i: { scrollHeight: number; clientHeight: number; insideHead: boolean }): boolean {
  return !i.insideHead && i.scrollHeight > i.clientHeight + 2
}

export type LienRunJourneyLine = {
  /** *Step 2 of 6 · Signed*. */
  head: string
  /** The step's own count, and its note when it has one: *0 of 7 · 7 wait on the leader*. */
  count: string
  /** The step blocks the run, so the line is amber. */
  warn: boolean
  /** Every step is done. */
  done: boolean
}

/**
 * The run's six steps as one line: the step the run stands on, the first that is not done. A blocked step is the
 * one that says why. With every step done the line says so.
 */
export function lienRunJourneyLine(journey: Pick<RunJourney, 'nodes'>): LienRunJourneyLine {
  const nodes = journey.nodes
  const at = nodes.findIndex((n) => !n.done)
  if (at < 0) {
    const last = nodes[nodes.length - 1]
    return { head: `All ${nodes.length} steps done`, count: last ? last.count : '', warn: false, done: true }
  }
  const n = nodes[at]!
  return { head: `Step ${at + 1} of ${nodes.length} · ${n.label}`, count: n.note ? `${n.count} · ${n.note}` : n.count, warn: Boolean(n.note) || n.state === 'blocked', done: false }
}

/** The fold's words for a screen reader, beside the line. */
export function lienRunJourneyFoldWords(open: boolean): string {
  return open ? 'Hide the six steps' : 'Show the six steps'
}
