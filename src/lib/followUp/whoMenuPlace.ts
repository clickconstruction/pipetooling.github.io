/**
 * Where the who-has-it pill's menu hangs, so all of it stays on the screen (punch list #348).
 *
 * The menu hung from the pill's right edge, or from its left when the right would not fit. That was two choices and a
 * phone needs a third. In a folded thread header the pill is a face 28 px wide, two thirds of the way across. On a
 * phone 375 px wide the menu fits from neither edge: from the right it runs off the left of the screen, and from the
 * left it runs off the right. So where neither fits, the menu is slid until it sits a margin inside the screen on
 * both sides.
 *
 * Pure: the pill hands in where it sits and how wide the screen is.
 */

/** The menu's width at a desk. */
export const WHO_MENU_WIDTH = 280

/** The share of a narrow screen the menu may take, as its `max-width: 85vw` says. */
export const WHO_MENU_SCREEN_SHARE = 0.85

/** The gap kept between the menu and the screen's edge. */
export const WHO_MENU_MARGIN = 8

/** How wide the menu draws on a screen this wide. */
export function whoMenuWidth(screenWidth: number): number {
  if (!Number.isFinite(screenWidth) || screenWidth <= 0) return WHO_MENU_WIDTH
  return Math.min(WHO_MENU_WIDTH, screenWidth * WHO_MENU_SCREEN_SHARE)
}

/** The menu's place, as CSS on a box positioned against the pill: from its right edge, or so far from its left. */
export type WhoMenuPlace = { right: 0 } | { left: number }

/**
 * From the pill's right edge where that fits, as a desk's row draws the pill at the right. Else from its left edge,
 * slid as far as it takes for the menu to sit a margin inside the screen on both sides: not at all where it fits
 * from the left, as on a Follow up row on a phone.
 */
export function whoMenuPlace(pill: { left: number; right: number }, screenWidth: number): WhoMenuPlace {
  const width = whoMenuWidth(screenWidth)
  if (pill.right - width >= WHO_MENU_MARGIN) return { right: 0 }
  if (!Number.isFinite(screenWidth) || screenWidth <= 0) return { left: 0 }
  const last = Math.max(WHO_MENU_MARGIN, screenWidth - WHO_MENU_MARGIN - width)
  const at = Math.min(Math.max(pill.left, WHO_MENU_MARGIN), last)
  return { left: Math.round(at - pill.left) }
}
