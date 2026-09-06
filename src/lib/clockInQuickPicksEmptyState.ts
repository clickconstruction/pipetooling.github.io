/**
 * Clock In with nothing to pick from (J2-F8).
 *
 * Before the B11 papercut batch the only guidance for a tech whose day has no Dispatch blocks, no
 * job assignments and no working-board bids was a one-shot info toast that
 * expired before anyone stuck on the sheet could act on it. These helpers decide
 * when the standing in-modal guidance shows instead; the component owns the
 * fetch and the JSX.
 */

export type ClockInQuickPickCounts = {
  assignedJobs: number
  dispatchJobs: number
  workingBoardBids: number
}

/** True when every quick-pick source came back empty. */
export function clockInQuickPicksEmpty(counts: ClockInQuickPickCounts): boolean {
  return counts.assignedJobs === 0 && counts.dispatchJobs === 0 && counts.workingBoardBids === 0
}

export type ClockInNoPicksGuidanceInput = {
  /** Quick picks are still loading — say nothing until they settle. */
  loading: boolean
  /** Result of `clockInQuickPicksEmpty` for the last completed load. */
  quickPicksEmpty: boolean
  /** Current unified search text; typing hides the guidance (the results list takes over). */
  searchText: string
  /** A job/bid is already chosen — nothing to guide. */
  hasSelection: boolean
}

export function showClockInNoPicksGuidance(input: ClockInNoPicksGuidanceInput): boolean {
  if (input.loading) return false
  if (!input.quickPicksEmpty) return false
  if (input.searchText.trim() !== '') return false
  return !input.hasSelection
}

export const CLOCK_IN_NO_PICKS_HEADLINE = 'Nothing on your schedule today, and no jobs assigned to you.'

/** Sentence that follows the headline; the phone renders as a tel: link when present. */
export function clockInNoPicksGuidanceParts(dispatchPhoneDisplay: string | null): {
  before: string
  phone: string | null
  after: string
} {
  if (dispatchPhoneDisplay) {
    return {
      before: 'Search by job name or number below, or call dispatch at ',
      phone: dispatchPhoneDisplay,
      after: ' and they will get you on a job.',
    }
  }
  return {
    before: 'Search by job name or number below, or call dispatch and they will get you on a job.',
    phone: null,
    after: '',
  }
}
