/**
 * The Lien desk's card on the Dashboard (punch list #423): how the desk stands against its next day, as three
 * values and one line, beside the Needs you list and never inside it. Needs you is a place for action: every
 * line in it can be pressed and goes once it is done. The desk's standing has one door and never clears, so
 * it is a card of its own.
 *
 * The values are the Board's own tiles (`buildLienBoard`), so the card and the page its door opens never
 * disagree: what is due by the next day, what waits on the leader, and what waits to print and mail. Since
 * v2.8372 the office reads the leader by the name the Board gives him (`lienDeskLeaderNameOf`). The
 * line is the day tile's own, *3 are past their day.* or *2 will not make Monday as they stand.*, and shows
 * only while a paper is late or at risk. The Board's fourth tile, the unpaid amount, stays on the Board: it
 * opens nothing, and a phone on a job site is read by more people than its owner.
 *
 * Pure. It reads a Board that is already built and counts nothing of its own.
 */
import type { LienBoard, LienBoardTileKey } from '../jobs/lienBoard'
import { isActiveRosterPerson, type ActiveRosterRow } from '../people/activeRoster'

/** The three tiles the card draws, in the Board's order. */
export type LienDeskCardValueKey = Exclude<LienBoardTileKey, 'unpaid'>

export type LienDeskCardValue = {
  key: LienDeskCardValueKey
  /** The count, as the Board's tile prints it. */
  figure: string
  /** The words under the count: *by Dec 15*, *wait on you*, *to print and mail*. */
  words: string
  /** Red on the day's count alone, while its tile is red: a paper is at risk, late or due within a day. */
  tone: 'red' | null
}

export type LienDeskCard = {
  values: LienDeskCardValue[]
  /** The day tile's red line, in the Board's own words; null when nothing is late or at risk. */
  line: string | null
}

const KEYS: readonly LienDeskCardValueKey[] = ['by_day', 'waiting', 'in_mail']

/**
 * The card for one reader. `viewerIsLeader` is the person the leader's count waits on (a leader, or a dev):
 * for him it reads *wait on you*, the word his own lien rows use, so the count reads as the total of those
 * rows and not as more work. Everyone else reads the tile's own words, *waiting on the leader*.
 */
export function lienDeskCard(board: Pick<LienBoard, 'tiles' | 'dayWords'>, opts: { viewerIsLeader: boolean }): LienDeskCard {
  const tile = (key: LienBoardTileKey) => board.tiles.find((t) => t.key === key)
  const values: LienDeskCardValue[] = []
  for (const key of KEYS) {
    const t = tile(key)
    if (!t) continue
    if (key === 'by_day') {
      values.push({ key, figure: t.figure, words: board.dayWords ? `by ${board.dayWords}` : 'nothing dated', tone: t.tone === 'red' ? 'red' : null })
    } else if (key === 'waiting') {
      values.push({ key, figure: t.figure, words: opts.viewerIsLeader ? (t.figure === '1' ? 'waits on you' : 'wait on you') : t.label, tone: null })
    } else {
      values.push({ key, figure: t.figure, words: t.label, tone: null })
    }
  }
  const day = tile('by_day')
  return { values, line: day && day.tone === 'red' ? day.line : null }
}

/**
 * The name the Lien desk gives the leader, from his row: a person on the desk's list, so an active account that is
 * not a dev, a sample, a digital twin or the walk tester (`LienDeskPage`'s `fetchActiveUsers` over its roles, every
 * role but dev), named as the row holds it (its `leaderNameFor`). Null for anyone else, and for a row with no name:
 * the card then says *waiting on the leader*, as the Board does for a leader it cannot name.
 */
export function lienDeskLeaderNameOf(row: (ActiveRosterRow & { name?: string | null }) | null | undefined): string | null {
  if (!row || !isActiveRosterPerson(row)) return null
  return row.name?.trim() || null
}

/**
 * Whether a page draws the card, and where. It stands beside Needs you wherever the page draws that list's
 * card or the door that keeps its cards: under the door, or right above the card. The office person's older
 * door (v2.3883) takes the list and everything around it to the Inbox tab, where the card stands above the
 * list, and Job Mode's own Dashboard draws no banners, so neither draws it.
 */
export function lienDeskCardShown(input: { door: boolean; cardsStay: boolean; bannersHidden: boolean }): boolean {
  if (input.bannersHidden) return false
  return !input.door || input.cardsStay
}
