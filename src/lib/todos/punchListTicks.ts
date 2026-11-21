import { versionNumber, type BoardItem } from './todoBoard'

/**
 * The punch list's ticks: the checkbox beside each card on `/punch-list` that means "I am working on
 * this" (Taunya's ask of 2026-11-21). A tick is one person's own row in `punch_list_ticks`, by the
 * card's number, and nobody else sees it.
 *
 * The cards live in the repo, so the database never hears that a card moved. Each tick remembers the
 * section (the card's `group`) it was made in, and this file compares that with the card's section
 * today:
 *
 * - the same section: the tick **shows**;
 * - another section, or the card is gone from the list: the tick is not shown. It is **cleared** (the
 *   row deleted) when this page's build is newer than the build that made the tick, and only
 *   **hidden** otherwise.
 *
 * The second half is for an old copy of the page left open on a phone. To that copy a card filed
 * since looks like a card that left the list, and a card moved since looks moved back. It must not
 * delete a tick made on a newer board, so it hides and leaves the row for a newer build to judge.
 *
 * Flagging a card is not a move: a flagged card keeps its group, so it keeps its tick.
 */

/** One row of `punch_list_ticks`, as the page holds it. */
export interface PunchTick {
  cardNumber: number
  /** The card's group when the person ticked it. */
  section: string
  /** The newest shipped version in the build of the page that made the tick; '' when it had none. */
  boardVersion: string
}

/** What the page needs of a card to judge a tick. */
export type TickCard = Pick<BoardItem, 'number' | 'group'>

export type TickVerdict = 'show' | 'hide' | 'clear'

/** A card with no number yet (a to-do being written on a dev server) takes no tick: the number is the row's key. */
export function canTick(card: Pick<BoardItem, 'number'>): boolean {
  return Number.isInteger(card.number) && card.number >= 1
}

/** True when this page's build has seen a newer `main` than the build that made the tick. A version neither can name is never newer. */
export function boardIsNewer(boardVersion: string, tickVersion: string): boolean {
  const board = versionNumber(boardVersion)
  const tick = versionNumber(tickVersion)
  return board > 0 && tick > 0 && board > tick
}

/** One tick against the card of its number today (`undefined` when the card has left the list). */
export function tickVerdict(tick: PunchTick, card: TickCard | undefined, boardVersion: string): TickVerdict {
  if (card && card.group === tick.section) return 'show'
  return boardIsNewer(boardVersion, tick.boardVersion) ? 'clear' : 'hide'
}

export interface TicksRead {
  /** The numbers of the cards that show a tick. */
  ticked: ReadonlySet<number>
  /** The numbers whose rows this page should delete: the card moved to another section or left the list. */
  stale: number[]
}

/** Every row the person has, sorted into what shows and what is cleared. A hidden row is in neither. */
export function readTicks(ticks: readonly PunchTick[], cards: readonly TickCard[], boardVersion: string): TicksRead {
  const byNumber = new Map<number, TickCard>()
  for (const card of cards) if (canTick(card)) byNumber.set(card.number, card)
  const ticked = new Set<number>()
  const stale: number[] = []
  for (const tick of ticks) {
    const verdict = tickVerdict(tick, byNumber.get(tick.cardNumber), boardVersion)
    if (verdict === 'show') ticked.add(tick.cardNumber)
    else if (verdict === 'clear') stale.push(tick.cardNumber)
  }
  return { ticked, stale: stale.sort((a, b) => a - b) }
}

/** The row a tick writes: the card's section today and this build's version. */
export function tickFor(card: TickCard, boardVersion: string): PunchTick {
  return { cardNumber: card.number, section: card.group, boardVersion }
}

/** The rows after a tick: the card's row replaced, so a row a move had hidden takes today's section. */
export function withTick(ticks: readonly PunchTick[], card: TickCard, boardVersion: string): PunchTick[] {
  return [...withoutTick(ticks, card.number), tickFor(card, boardVersion)]
}

/** The rows after an untick, or after the page cleared stale rows: those numbers' rows are gone. */
export function withoutTick(ticks: readonly PunchTick[], ...cardNumbers: number[]): PunchTick[] {
  const gone = new Set(cardNumbers)
  return ticks.filter((t) => !gone.has(t.cardNumber))
}

/** The checkbox's name for a screen reader, with the card's number in it. */
export function tickLabel(card: Pick<BoardItem, 'number' | 'name'>): string {
  return `I am working on #${card.number}, ${card.name}`
}

/** The words under the board's note line: what the checkbox means, and what wipes it. */
export const TICK_BLURB =
  'Tick the box beside a card you are working on. Only you see your ticks. A card that moves to another section loses its tick.'

/** The lead of the line shown when the ticks could not be read; the reason follows it. */
export const TICKS_READ_FAILED = 'Your ticks could not be read'

/** What follows that line, so nobody takes the failure for a missing list. */
export const TICKS_READ_FAILED_REST = 'The cards are all here, with no ticks shown.'

/** The lead of the line shown when a tick or an untick did not save; the reason follows it. */
export function tickSaveFailed(card: Pick<BoardItem, 'number'>, ticking: boolean): string {
  return ticking ? `The tick on #${card.number} was not saved` : `The tick on #${card.number} was not taken off`
}

/** The filter pill's label; its count rides beside it. */
export const TICKED_FILTER_LABEL = 'Working on'
