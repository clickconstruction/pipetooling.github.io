/**
 * Back to top (v2.8334, the owner's ask of 2026-11-23 for the Dashboard): a quiet press at the foot of a long
 * page. The rules, apart from the drawing in `src/components/BackToTop.tsx`.
 *
 * - It shows only when the page is long enough to need it: two screens or more. A short page does not end on
 *   a press that does nothing.
 * - It glides, and jumps at once for a person who asked their device for less motion.
 */

/** The press's words. An arrow is drawn beside them, for the eye alone. */
export const BACK_TO_TOP_LABEL = 'Back to top'

/** How many screens tall a page is before the press shows. */
export const BACK_TO_TOP_MIN_SCREENS = 2

/** True when the page is at least two screens tall. Unknown sizes (no layout yet) are a short page. */
export function backToTopShown(size: { pageHeight: number | null | undefined; viewportHeight: number | null | undefined }): boolean {
  const page = size.pageHeight
  const view = size.viewportHeight
  if (page == null || view == null || !Number.isFinite(page) || !Number.isFinite(view) || view <= 0) return false
  return page >= view * BACK_TO_TOP_MIN_SCREENS
}

/** How the page goes up: a glide, or at once when the person asked for less motion. */
export function backToTopScrollBehavior(reducedMotion: boolean): 'smooth' | 'instant' {
  return reducedMotion ? 'instant' : 'smooth'
}
