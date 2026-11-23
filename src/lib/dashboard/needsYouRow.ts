import type { NeedsYouItem } from '../dashboardNeedsYou'

/**
 * A Needs you row on a phone (v2.8329, the owner's ask of 2026-11-23). Every source draws one row: the words
 * across the row's full width, and a small press at the bottom right, so the eye reads what to do and ends on
 * what to press. Before it the row wrapped: the press fell under the words on the left unless its label was
 * short enough to fit beside the count.
 *
 * A first cut put the press in a right-hand column of one width. The owner saw it drawn and did not want the
 * words narrowed, since some lines run to several sentences: *keep it like a smaller button in the bottom
 * right*. So the press is as wide as its own words and as small as it was, and its touch area is a thumb tall.
 */

/** The press's touch area on a phone: a thumb tall, though the pill drawn inside it is smaller. */
export const NEEDS_YOU_PRESS_MIN_HEIGHT = 44

/** What the touch area adds above and under the pill, taken back by the button's margins so the row is no taller. */
export const NEEDS_YOU_PRESS_TOUCH_PAD_PX = 6

const escapeForRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * True when the title already says the row's figure as a number of its own: *9* in
 * *9 purchases need a job*, never the 9 inside *19*, *$9,400* or *9%*.
 */
export function needsYouFigureInTitle(title: string, figure: string): boolean {
  const f = figure.trim()
  if (!f) return false
  return new RegExp(`(?<![\\d$.,])${escapeForRegExp(f)}(?![\\d%]|[.,]\\d)`).test(title)
}

/**
 * The figure a phone row draws beside its press, or null when the title already says it, so one
 * row never shows the same number twice.
 */
export function needsYouPhoneFigure(item: Pick<NeedsYouItem, 'title' | 'figure'>): string | null {
  const f = item.figure.trim()
  if (!f || needsYouFigureInTitle(item.title, f)) return null
  return f
}
