/**
 * Job Summary HCP-floor footer sentence (v2.2914, journey map J6-7 / J6-N1).
 *
 * The tab's default floor (HCP # > 500) hides the legacy imported jobs, and
 * the fetch applies it server-side before enrichment — so the old footer
 * compared two already-floored lists and read "Showing 417 of 417 jobs after
 * filter" while 398 rows were hidden. This kernel turns the real counts into
 * one plain sentence and says when a "show all" affordance belongs beside it.
 */
import { DEFAULT_MIN_HCP_EXCLUSIVE } from './jobSummaryHcpFilter'

export type JobSummaryFloorFooterInput = {
  /** Rows on the table right now (after the floor). */
  shown: number
  /** Rows the floor dropped — server-side plus any client-side raise of the floor. */
  hidden: number
  /** The floor itself; −1 means "no floor" (every HCP # shows). */
  floor: number
}

export type JobSummaryFloorFooter = {
  sentence: string
  /** True when a "show all" (floor → −1) affordance belongs beside the sentence. */
  offerShowAll: boolean
}

const jobs = (n: number) => (n === 1 ? 'job' : 'jobs')

export function jobSummaryFloorFooter({ shown, hidden, floor }: JobSummaryFloorFooterInput): JobSummaryFloorFooter {
  const shownN = Math.max(0, Math.floor(shown))
  const hiddenN = Math.max(0, Math.floor(hidden))
  if (floor < 0) {
    return { sentence: `All ${shownN} ${jobs(shownN)} shown · no HCP # floor`, offerShowAll: false }
  }
  const floorName = floor === DEFAULT_MIN_HCP_EXCLUSIVE ? `the default HCP # ${floor} floor` : `the HCP # ${floor} floor`
  if (hiddenN === 0) {
    return { sentence: `${shownN} ${jobs(shownN)} shown · nothing hidden by ${floorName}`, offerShowAll: false }
  }
  return {
    sentence: `${shownN} shown · ${hiddenN} older imported ${jobs(hiddenN)} (HCP # ${floor} and below) hidden by ${floorName}`,
    offerShowAll: true,
  }
}
