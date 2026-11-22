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

/**
 * One title bar on a computer (v2.7323, the owner's ask of 2026-11-15: the bars sit closer, the words as they are).
 * The tallest line in any bar is the pane head's 0.78rem fact: at the bar's line-height of 1.2 its box is 15 px, and
 * 24 keeps 4 px of air over and under it (23 is the floor; the pixel over it keeps the air at 4 when the box rounds).
 * The pane's section heads and its page labels read this same number (`LIEN_PANE_HEAD_H`), so the bars that sit
 * beside each other at the top of the desk match; `.lienPileHead` in index.css carries it as the base height.
 */
export const LIEN_PILE_HEAD_H = 24
/** A phone's title is a thumb tall: a tap rule, well over the text floor above, so it does not follow it. */
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
export const LIEN_PHONE_TAB: CSSProperties = { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, minHeight: 44, padding: '2px 4px', whiteSpace: 'normal', textWrap: 'balance', lineHeight: 1.15, textAlign: 'center' }
