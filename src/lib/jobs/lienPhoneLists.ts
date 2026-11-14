/**
 * The Lien desk's other views on a phone: the tabs and the Notices list's pile titles (punch list #352, PR 5).
 *
 * On a computer the Notices list keeps every pile's title in sight: a title pins `i` bars from the top once its rows
 * are passed and `n - 1 - i` bars from the bottom while they are ahead, so the titles are a table of contents. On a
 * phone that table took the list: five titles are 150 px and the list's window is 140 px at 320 wide, so no row
 * showed at all. There one title pins, the pile being read, and the rest scroll with their rows, each a thumb tall.
 *
 * Pure: where a title sits and where a press on it scrolls to.
 */
import type { CSSProperties } from 'react'

export const LIEN_PILE_HEAD_H = 30
export const LIEN_PILE_HEAD_H_PHONE = 40

export function lienPileHeadHeight(phone: boolean): number {
  return phone ? LIEN_PILE_HEAD_H_PHONE : LIEN_PILE_HEAD_H
}

/** Where pile `i` of `n` pins. A computer stacks them at both ends; a phone pins one at the top. */
export function lienPileHeadPlace(i: number, n: number, phone: boolean): { top: number; bottom: number | 'auto'; height: number } {
  if (phone) return { top: 0, bottom: 'auto', height: LIEN_PILE_HEAD_H_PHONE }
  return { top: i * LIEN_PILE_HEAD_H, bottom: (n - 1 - i) * LIEN_PILE_HEAD_H, height: LIEN_PILE_HEAD_H }
}

/** How many title bars sit over pile `i`'s first row once it is scrolled to: its own and, on a computer, the ones before it. */
function barsOver(i: number, phone: boolean): number {
  return phone ? 1 : i + 1
}

/** Where the list scrolls so pile `i`'s first row sits right under its title. */
export function lienPileScrollTop(rowsOffsetTop: number, i: number, phone: boolean): number {
  return Math.max(0, rowsOffsetTop - barsOver(i, phone) * lienPileHeadHeight(phone))
}

/** Whether the list has reached pile `i`, so its title is the lit one: its rows start within a bar of where they would pin. */
export function lienPileReached(rowsOffsetTop: number, scrollTop: number, i: number, phone: boolean): boolean {
  return rowsOffsetTop <= scrollTop + (barsOver(i, phone) + 1) * lienPileHeadHeight(phone)
}

/**
 * A tab of the desk's two tab rows on a phone. Each takes its words' share of the row and gives room back when the
 * row is short, its words wrapping onto a second line in balance, so no row of tabs slides sideways: not four views
 * at 320 wide, and not the longer names of the kinds of paper.
 */
export const LIEN_PHONE_TAB: CSSProperties = { flex: '1 1 auto', minWidth: 0, minHeight: 44, padding: '2px 4px', whiteSpace: 'normal', textWrap: 'balance', lineHeight: 1.15, textAlign: 'center' }
