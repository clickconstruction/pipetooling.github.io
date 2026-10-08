/**
 * GC mode design spike: a trade not ready to start, the Gantt's Phase 4 (G-77; the mock-up and the
 * plan are `to-dos/gc-mode/mockups/G-77.md`). A bar that has not started, on a trade whose papers
 * are not in, is held the way a bar waiting on a submittal is: the chart stripes it and says what it
 * waits on, and the opened activity lists each paper with its next step, so the office can act
 * from the bar.
 *
 * Ready is Get started's five steps (awarded, master agreement, insurance, W-9, statement of work),
 * read the way Get started reads them, with one difference: insurance is read on the day the work
 * starts, not on today. A certificate that runs out before then is a gap once the renewal ask is
 * due (`INSURANCE_ASK_DAYS`); further out, the usual renewal takes care of it.
 *
 * Its own file, out of the barrel: it reads Get started, the papers' next steps and the Gantt's
 * hold shape, and the Schedule tab adds its holds to the chart's.
 */
import type { GcProject, TradePackage } from './gcTypes'
import { shortDate } from './gcWords'
import { planLabel } from './gcLookups'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { StartGap } from '../gc/schedule/notReady'
export type { NotReadyBar, NotReadyBlock, NotReadyLine, UninsuredBar } from '../gc/schedule/notReady'
export { notReadyBars, notReadyBlock, notReadyWords, startGaps, uninsuredBars, uninsuredBlock, uninsuredNotes, withNotReady } from '../gc/schedule/notReady'

export type { StartGap, StartGapKind } from '../gc/schedule/notReady'
export { NOT_READY_LATE_DAYS, holdWordsInList, lapsedInsuranceWords } from '../gc/schedule/notReady'

function sowGap(project: GcProject, pkg: TradePackage): StartGap {
  const sow = pkg.sow
  const base = { kind: 'sow' as const, label: 'Statement of work', noun: 'a signed statement of work', doc: sow ? `sow-${pkg.id}` : null }
  if (!sow) return { ...base, line: 'Statement of work not written.', barWords: 'a signed statement of work, not written yet' }
  if (sow.status === 'draft') return { ...base, line: 'Statement of work drafted, not sent.', barWords: 'a signed statement of work, not sent yet' }
  if (sow.status === 'sent') {
    return sow.sentOn
      ? { ...base, line: `Statement of work sent ${shortDate(sow.sentOn)}, not signed.`, barWords: `a signed statement of work, sent ${shortDate(sow.sentOn)}` }
      : { ...base, line: 'Statement of work sent, not signed.', barWords: 'a signed statement of work, not signed yet' }
  }
  // Signed on plans older than the newest set, which Get started does not count as done.
  return { ...base, noun: 'a new statement of work', line: `Statement of work signed on ${planLabel(project, sow.basedOnRev)}, older than the plans.`, barWords: 'a new statement of work, the plans changed' }
}
