import type { NeedsYouItem } from '../dashboardNeedsYou'

/**
 * A Needs you row on a phone (v2.8329, the owner's ask of 2026-11-23): two columns, the words on
 * the left and the press on the right, so the eye reads what to do and then lands on what to
 * press. Every source draws this one row. Before it the row wrapped: the press fell under the
 * words on the left unless its label was short enough to fit beside the count.
 *
 * The press column is one width down the list, so the presses line up. It narrows a little on a
 * small phone and never widens for a long label: a label that does not fit wraps inside its press,
 * which grows taller.
 */
export const NEEDS_YOU_PRESS_COLUMN = 'clamp(5.25rem, 27vw, 6.5rem)'

/** A phone press is at least a thumb tall. */
export const NEEDS_YOU_PRESS_MIN_HEIGHT = 44

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
 * The figure a phone row draws above its press, or null when the title already says it, so one
 * row never shows the same number twice.
 */
export function needsYouPhoneFigure(item: Pick<NeedsYouItem, 'title' | 'figure'>): string | null {
  const f = item.figure.trim()
  if (!f || needsYouFigureInTitle(item.title, f)) return null
  return f
}
