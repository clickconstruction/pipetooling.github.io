/**
 * Where a draft footer's small menu stands beside its press (v2.7421; Taunya's find of 2026-11-15: *He already
 * okayed it ▾* opened with its left side cut off).
 *
 * The menu was pinned to its press's right edge and grew to the left. The press is the first thing in the footer,
 * so the menu, wider than its press, ran out of the paper's pane, and the pane cuts what leaves it. The menu now
 * starts flush with its press's left edge and is pulled back inside whatever can show it: every box around it that
 * cuts its contents, and the screen. It still opens over the press, and under it only when there is no room over.
 *
 * Pure: boxes in, a place out. The component measures; nothing here reads the page.
 */

export type LienFootMenuBox = { left: number; top: number; right: number; bottom: number }

/** The gap between the press and its menu, in px. */
export const LIEN_FOOT_MENU_GAP_PX = 4
/** How far the menu keeps from the edge of what shows it, in px. */
export const LIEN_FOOT_MENU_EDGE_PX = 8

export type LienFootMenuPlace = {
  /** The menu's left edge, in px from its press's left edge. */
  left: number
  /** Over the press; false is under it. */
  up: boolean
}

/** What can show the menu: the screen, cut down by every box around it that cuts its contents. */
export function lienFootMenuBounds(screen: LienFootMenuBox, cuts: ReadonlyArray<LienFootMenuBox>): LienFootMenuBox {
  return cuts.reduce<LienFootMenuBox>((b, c) => ({ left: Math.max(b.left, c.left), top: Math.max(b.top, c.top), right: Math.min(b.right, c.right), bottom: Math.min(b.bottom, c.bottom) }), screen)
}

/**
 * The menu's place: flush with the press's left edge, pulled inside `bounds` on either side. A box narrower than the
 * menu keeps the menu's left edge in view, where its words start. Over the press when it fits there, or when there
 * is more room over than under.
 */
export function lienFootMenuPlace(at: { press: LienFootMenuBox; menu: { width: number; height: number }; bounds: LienFootMenuBox }): LienFootMenuPlace {
  const min = at.bounds.left + LIEN_FOOT_MENU_EDGE_PX
  const max = at.bounds.right - LIEN_FOOT_MENU_EDGE_PX - at.menu.width
  const x = max < min ? min : Math.min(Math.max(at.press.left, min), max)
  const over = at.press.top - at.bounds.top
  const under = at.bounds.bottom - at.press.bottom
  const need = at.menu.height + LIEN_FOOT_MENU_GAP_PX + LIEN_FOOT_MENU_EDGE_PX
  return { left: Math.round(x - at.press.left), up: over >= need || over >= under }
}
