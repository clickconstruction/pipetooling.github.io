/**
 * The Prospects page's own padding. A desk has room for a margin beside its tabs and tables. A
 * phone does not: the app's frame already keeps a thin edge, so the page adds almost nothing and
 * gives the width and the first screen to its cards (the owner, 2026-11-10, on the Permits skim:
 * *I want to reduce the dead space here*).
 */
export function prospectsPagePadding(isMobile: boolean): string {
  return isMobile ? '0.25rem 0.25rem 1rem' : '1rem 1.5rem'
}

/** The skim card's inner side padding, in pixels: a little tighter on a phone, where every pixel is card. */
export function skimCardSidePadding(isMobile: boolean): number {
  return isMobile ? 12 : 16
}
