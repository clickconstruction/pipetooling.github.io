/**
 * Materials on site: the words beside the week's missing money (punch list #344, PR 6, v2.7246).
 *
 * The desk's *Missing this week* was money alone. A short count of a part with no price adds nothing to it, so a job
 * that lost two hundred fittings read $0.00, was not amber and sorted last, and most typed names have no price. The
 * money stays what it is, the sum of what is priced. These words say how many lines came up short and how many of them
 * the money leaves out. Pure.
 */

/** `3 lines`, `3 lines · 2 with no price`, `3 lines, none with a price`. Empty when nothing came up short. */
export function missingWeekNote(lines: number, unpriced: number): string {
  if (lines <= 0) return ''
  const count = `${lines.toLocaleString('en-US')} ${lines === 1 ? 'line' : 'lines'}`
  if (unpriced <= 0) return count
  if (unpriced >= lines) return lines === 1 ? '1 line, with no price' : `${count}, none with a price`
  return `${count} · ${unpriced.toLocaleString('en-US')} with no price`
}

/** True when the money leaves something out: the figure is then a floor, never the whole of what walked away. */
export function missingWeekIsPartial(lines: number, unpriced: number): boolean {
  return lines > 0 && unpriced > 0
}

/** The Materials page's Track badge when lines came up short and none of them has a price: there is no money to name. */
export function shortLinesBadgeWords(lines: number): string {
  return lines === 1 ? '1 line came up short' : `${lines.toLocaleString('en-US')} lines came up short`
}
