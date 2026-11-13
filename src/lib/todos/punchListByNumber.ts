import { GROUP_LABELS, GROUP_ORDER, type BoardGroup, type BoardItem } from './todoBoard'
import { mockupHref, versionSegments } from './punchListView'

/**
 * The punch list's **By number** view: every card the page renders in one flat list, sorted by
 * its number, the highest first unless the reader flips it. On 2026-11-13 the owner asked for it
 * so he can work from the newest card down. A number is given once and never refilled, so the
 * highest number is the newest card and the gaps are the cards that closed.
 *
 * Which view the page draws and which way the list runs are read from the address first
 * (`/punch-list?view=number&order=oldest`), then from what this device remembered, then the
 * page's old default: the groups, and the newest card first.
 */

export type PunchView = 'group' | 'number'
export type NumberOrder = 'newest' | 'oldest'

export const PUNCH_VIEWS: readonly PunchView[] = ['group', 'number']
export const VIEW_LABEL: Record<PunchView, string> = { group: 'By group', number: 'By number' }

/** The address's own words for the two choices. */
export const VIEW_PARAM = 'view'
export const ORDER_PARAM = 'order'

/** What the device remembers them under. */
export const VIEW_KEY = 'pt-punch-view'
export const ORDER_KEY = 'pt-punch-number-order'

export function parseView(raw: string | null | undefined): PunchView | null {
  return raw === 'group' || raw === 'number' ? raw : null
}

export function parseOrder(raw: string | null | undefined): NumberOrder | null {
  return raw === 'newest' || raw === 'oldest' ? raw : null
}

/** The address wins, then the device, then the groups. A word neither knows reads as absent. */
export function viewFrom(fromAddress: string | null | undefined, remembered: string | null | undefined): PunchView {
  return parseView(fromAddress) ?? parseView(remembered) ?? 'group'
}

/** The address wins, then the device, then the newest card first. */
export function orderFrom(fromAddress: string | null | undefined, remembered: string | null | undefined): NumberOrder {
  return parseOrder(fromAddress) ?? parseOrder(remembered) ?? 'newest'
}

/**
 * The page's query string for a choice, every other parameter kept. The defaults write nothing:
 * the groups drop both words, and the newest first drops `order`, so a bare `/punch-list` stays
 * bare and reads the device.
 */
export function searchFor(search: string, view: PunchView, order: NumberOrder): string {
  const params = new URLSearchParams(search)
  params.delete(VIEW_PARAM)
  params.delete(ORDER_PARAM)
  if (view === 'number') {
    params.set(VIEW_PARAM, 'number')
    if (order === 'oldest') params.set(ORDER_PARAM, 'oldest')
  }
  const out = params.toString()
  return out ? `?${out}` : ''
}

/** A whole number from 1 up. `check:todos` refuses any other card, so this guards a row built by hand. */
export function hasNumber(item: Pick<BoardItem, 'number'>): boolean {
  return Number.isInteger(item.number) && item.number >= 1
}

/** `#343`, or the words for a card that has none. */
export function numberLabel(item: Pick<BoardItem, 'number'>): string {
  return hasNumber(item) ? `#${item.number}` : NO_NUMBER
}

export const NO_NUMBER = 'no number'

/** The row's anchor: `n343` as the grouped rows use, or the slug for a card with no number. */
export function rowAnchor(item: Pick<BoardItem, 'number' | 'slug'>): string {
  return hasNumber(item) ? `n${item.number}` : `card-${item.slug}`
}

/**
 * The cards by number. Newest first is the highest number on top; oldest first is the lowest.
 * A card with no number sorts last either way. Two cards on one number, which `check:todos`
 * refuses but a branch can carry for an hour, keep the board's own order in both directions,
 * so a flip never swaps them.
 */
export function byNumber<T extends Pick<BoardItem, 'number'>>(items: readonly T[], order: NumberOrder): T[] {
  const sign = order === 'newest' ? -1 : 1
  return items
    .map((item, at) => ({ item, at }))
    .sort((a, b) => {
      const an = hasNumber(a.item)
      const bn = hasNumber(b.item)
      if (an !== bn) return an ? -1 : 1
      if (an && a.item.number !== b.item.number) return sign * (a.item.number - b.item.number)
      return a.at - b.at
    })
    .map((x) => x.item)
}

export function flipOrder(order: NumberOrder): NumberOrder {
  return order === 'newest' ? 'oldest' : 'newest'
}

/** The sort press says which way the list runs now. */
export const ORDER_LABEL: Record<NumberOrder, string> = { newest: '↓ Newest first', oldest: '↑ Oldest first' }

/** Its title says what the next press does. */
export function orderTitle(order: NumberOrder): string {
  return order === 'newest'
    ? 'The highest number is on top. Press for the oldest first.'
    : 'The lowest number is on top. Press for the newest first.'
}

/** `106 cards`, or `12 of 106 cards` when the filters hide some. */
export function shownLine(shown: number, total: number): string {
  const noun = total === 1 ? 'card' : 'cards'
  return shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`
}

/** The groups that have a card, in the board's order, each with its count: the chips that narrow the list. */
export function groupCounts(items: readonly Pick<BoardItem, 'group'>[]): Array<{ group: BoardGroup; label: string; count: number }> {
  return GROUP_ORDER.map((group) => ({ group, label: GROUP_LABELS[group], count: items.filter((i) => i.group === group).length })).filter(
    (g) => g.count > 0,
  )
}

export interface MockupDoor {
  href: string
  label: string
  title: string
}

/** The compact row's one door to the drawings: the first mock-up, and how many more the open card lists. */
export function mockupDoor(item: Pick<BoardItem, 'mockups'>): MockupDoor | null {
  const first = item.mockups[0]
  if (!first) return null
  const more = item.mockups.length - 1
  return {
    href: mockupHref(first),
    label: more > 0 ? `mock-up · 1 of ${item.mockups.length}` : 'mock-up',
    title: more > 0 ? `${first} · open the card for the other ${more}` : first,
  }
}

/** Whether the card's `ver` names a shipped version. The compact row draws the chip only then. */
export function hasShippedVersion(ver: string): boolean {
  return versionSegments(ver).some((s) => s.version !== null)
}
