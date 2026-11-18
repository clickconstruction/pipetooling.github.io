/**
 * The app header on a phone is one line, always (the owner's ask of 2026-11-18, his screenshot of a 375 px phone:
 * the menu, home and search on a first line and the wrench, the three coloured presses, the people press and the
 * gear on a second). The row wrapped by a CSS rule; it no longer wraps at any width. When it would not fit, the
 * presses below leave the row one at a time, in this order, and each becomes a row of the gear menu: the wrench
 * (Tell the dev), then the people press, then the customers press. The first two are the owner's own words; the
 * third is the same rule carried one step on, for the roles whose row holds a customers press too, since on a
 * 320 px phone an assistant's row with Dispatch Mode off is still 18 px too long with the first two gone.
 *
 * The row is measured, not ruled by width: what it holds differs by role and by mode (Job Mode adds the call
 * press, a partner has the statement mark, View as adds the way back). `readNavRow` reads the parts off the DOM
 * and `navRowFit` answers from the numbers alone, as `lienDeskTitleBar.ts` does for the Lien desk's title bar.
 *
 * A row that still does not fit with all three in the menu closes its gaps (`tight`), and the way back from View
 * as, the one part with words, shortens with an ellipsis. Nothing ever falls to a second line.
 */

/** A press that can leave the row for the gear menu. */
export type NavRowPress = 'wrench' | 'people' | 'customers'

/** The order the presses leave the row in: the wrench first, the people press next, the customers press last. */
export const NAV_ROW_MENU_ORDER: readonly NavRowPress[] = ['wrench', 'people', 'customers']

/** The row's own gap and the gap between the presses at its right end, in rem. */
export const NAV_ROW_GAP_REM = 0.5
/** The same gaps on a row that does not fit with every press in the menu. */
export const NAV_ROW_TIGHT_GAP_REM = 0.125
/** The gap between the icons of the cluster the people press, the customers press and the gear share, in rem. */
export const NAV_ROW_CLUSTER_GAP_REM = 0.125
/** An icon press: a 20 px icon with 0.5rem of padding on each side. What a press takes while it is not drawn and was never measured. */
export const NAV_ROW_ICON_PX = 20
export const NAV_ROW_ICON_PAD_REM = 0.5

/**
 * The row's parts, in px. `left` is the menu, home and search. `fixed` is everything at the right end that never
 * leaves the row, with the gaps between: the coloured presses, the gear, the way back from View as. Each press
 * that can leave is its own width with the one gap it brings, or 0 when this person has no such press.
 * `gap` is the gap between the two ends.
 */
export type NavRowParts = { left: number; fixed: number; wrench: number; people: number; customers: number; gap: number }

/** Which presses are rows of the gear menu, and whether the row's gaps close up. */
export type NavRowFit = { inMenu: readonly NavRowPress[]; tight: boolean }

/** Everything on the row: the shape before the row is measured, and wherever there is room. */
export const NAV_ROW_ALL_ON_ROW: NavRowFit = { inMenu: [], tight: false }

/** Float sums of measured widths land a hair over the line they fit on. */
const FIT_SLOP_PX = 0.01

/** The width the row needs with these presses in the menu. */
export function navRowNeeds(p: NavRowParts, inMenu: readonly NavRowPress[] = []): number {
  const right = p.fixed + NAV_ROW_MENU_ORDER.reduce((sum, press) => sum + (inMenu.includes(press) ? 0 : Math.max(0, p[press])), 0)
  return p.left + right + (p.left > 0 && right > 0 ? p.gap : 0)
}

/**
 * What a row `width` px wide holds. Presses leave in `NAV_ROW_MENU_ORDER`, one at a time, only while the row does
 * not fit, and a press this person does not have is skipped. `tight` is true when the row is still too long with
 * every press it has in the menu.
 */
export function navRowFit(width: number, p: NavRowParts): NavRowFit {
  const inMenu: NavRowPress[] = []
  const fits = () => navRowNeeds(p, inMenu) <= width + FIT_SLOP_PX
  for (const press of NAV_ROW_MENU_ORDER) {
    if (fits()) break
    if (p[press] > 0) inMenu.push(press)
  }
  if (inMenu.length === 0 && fits()) return NAV_ROW_ALL_ON_ROW
  return { inMenu, tight: !fits() }
}

/** Whether two answers draw the same row. */
export function sameNavRowFit(a: NavRowFit, b: NavRowFit): boolean {
  return a.tight === b.tight && a.inMenu.length === b.inMenu.length && a.inMenu.every((press, i) => press === b.inMenu[i])
}

/** Which presses this person has at all, in the row or in the menu. */
export type NavRowHas = Record<NavRowPress, boolean>

/** The widths the presses had when last drawn on the row, with their gaps: what a press in the menu would take if it came back. */
export type NavRowRemembered = Partial<Record<NavRowPress, number>>

/**
 * The row as drawn: its content width and its parts, read off the DOM. Null while the row has no width (not laid
 * out yet, or jsdom), so the caller keeps every press on the row.
 *
 * The answer must not depend on what the row currently shows, or the row would flap: a press in the menu is
 * counted at the width it had on the row (`remembered`, else an icon press's own size); the gaps are the row's
 * plain gaps whether or not they are closed up; and a part that shortens (`data-nav-row-squeeze`, the way back
 * from View as) is counted at its full width, up to its max-width.
 */
export function readNavRow(nav: HTMLElement, has: NavRowHas, remembered: NavRowRemembered = {}): { width: number; parts: NavRowParts; measured: NavRowRemembered } | null {
  const rect = (el: Element | null | undefined) => (el ? el.getBoundingClientRect().width : 0)
  const whole = rect(nav)
  if (!(whole > 0)) return null
  const px = (v: string, fallback: number) => (v.endsWith('px') ? parseFloat(v) : fallback)
  const cs = getComputedStyle(nav)
  const rem = px(getComputedStyle(document.documentElement).fontSize, 16)
  const gap = NAV_ROW_GAP_REM * rem
  const clusterGap = NAV_ROW_CLUSTER_GAP_REM * rem
  const right = nav.querySelector(':scope > [data-nav-row-right]')
  const natural = (el: Element) => {
    if (!el.hasAttribute('data-nav-row-squeeze')) return rect(el)
    const s = getComputedStyle(el)
    const full = el.scrollWidth + px(s.borderLeftWidth, 0) + px(s.borderRightWidth, 0)
    return Math.min(Math.max(full, rect(el)), px(s.maxWidth, Infinity))
  }
  // Every child counts, an empty one too: it is still a part of the row and takes its gap.
  const kids = right ? Array.from(right.children) : []
  const rightWidth = kids.reduce((sum, el) => sum + natural(el), 0) + gap * Math.max(0, kids.length - 1)
  const iconPress = NAV_ROW_ICON_PX + 2 * NAV_ROW_ICON_PAD_REM * rem
  const measured: NavRowRemembered = {}
  const pressWidths = { wrench: 0, people: 0, customers: 0 }
  let drawn = 0
  for (const press of NAV_ROW_MENU_ORDER) {
    if (!has[press]) continue
    // The wrench is one of the right end's own parts; the two icon links sit in the cluster with the gear.
    const itsGap = press === 'wrench' ? gap : clusterGap
    const el = right?.querySelector(`[data-nav-row-press="${press}"]`)
    const w = rect(el)
    if (w > 0) {
      measured[press] = w + itsGap
      drawn += w + itsGap
    }
    pressWidths[press] = measured[press] ?? remembered[press] ?? iconPress + itsGap
  }
  return {
    width: whole - px(cs.paddingLeft, 0) - px(cs.paddingRight, 0),
    parts: { left: rect(nav.querySelector(':scope > [data-nav-row-left]')), fixed: Math.max(0, rightWidth - drawn), ...pressWidths, gap },
    measured,
  }
}
