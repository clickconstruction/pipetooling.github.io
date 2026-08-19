/**
 * "Search Paid in Full too" chip (v2.1819, plan PR 0): the Stages search used
 * to silently prefetch EVERY paid job (fully embedded, ~667 rows) the moment
 * one character was typed — the app's most expensive accidental action. The
 * prefetch is gone; this chip makes the paid fetch opt-in, prominent exactly
 * when the user is most likely to need it (zero matches in the loaded
 * sections). Retires when the scoped-load train's server search ships
 * (docs/JOBS_BOARD_SCOPED_LOAD_PLAN.md PR 4).
 */

export type PaidSearchChipState = 'hidden' | 'quiet' | 'prominent' | 'loading' | 'included'

export function paidSearchChipState(args: {
  /** Search box has non-blank text. */
  searchActive: boolean
  /** paidJobsMergedForKey === jobsListDataKey && jobsListDataKey != null. */
  paidMerged: boolean
  /** The lazy paid fetch is in flight. */
  paidLoading: boolean
  /** The current query matched nothing across every loaded section. */
  zeroLoadedMatches: boolean
}): PaidSearchChipState {
  if (!args.searchActive) return 'hidden'
  if (args.paidMerged) return 'included'
  if (args.paidLoading) return 'loading'
  if (args.zeroLoadedMatches) return 'prominent'
  return 'quiet'
}
