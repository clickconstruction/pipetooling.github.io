/**
 * What the head over *Needs you now* says it counts (the owner's pick of 2026-11-18, the last pieces of punch list
 * #383's drawing), on a computer, where the list under the Board is one group a bin (`lienNextUpByBin.ts`).
 *
 * Three numbers stand on To do and each counts by its own rule. The tab, *34 to do*, counts the rows this viewer can
 * move. The first tile counts the papers due by the next due day and says so, *by Monday*. The list's head read
 * *Needs you now · 27* and named nothing: 27 is papers, the ones due inside the week or past and the ones that wait
 * on the leader, and the rest wait under **Later**, folded. A reader set 27 beside 34 and could not make them meet.
 *
 * The head now names its unit and says where the rest are: *Needs you now · 27 papers · 12 more under Later*. The
 * count is the bins' own sum, so it still equals the heads under it added up, and the Later figure is the Later
 * head's own. The drawing's *26 of the 34 to do* is not said: the tab counts rows and leaves out what waits on the
 * leader, the head counts papers and keeps them in, and a row can stand for several papers, so no true sentence joins
 * the two without changing one of the rules.
 *
 * Pure: the groups in, the words out.
 */
import type { LienBinGroup } from './lienNextUpByBin'

export type LienNextUpNowWords = {
  /** *27 papers*, *1 paper*: what stands after the head's name. */
  count: string
  /** *12 more under Later*, or null when nothing waits there. */
  later: string | null
}

/** The head's words off the list's groups; null when no bin needs anyone now, where the list draws no such head. */
export function lienNextUpNowWords(groups: ReadonlyArray<Pick<LienBinGroup, 'part' | 'papers' | 'later'>>): LienNextUpNowWords | null {
  const parts = groups.filter((g) => g.part)
  if (parts.length === 0) return null
  const now = parts.reduce((n, g) => n + g.papers, 0)
  const later = groups.filter((g) => g.later).reduce((n, g) => n + g.papers, 0)
  return { count: `${now} ${now === 1 ? 'paper' : 'papers'}`, later: later > 0 ? `${later} more under Later` : null }
}
