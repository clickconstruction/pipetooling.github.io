/**
 * Pipeline search × Paid in Full (journey B6 / J3-3, cluster C64).
 *
 * The typed search already finds paid jobs server-side (v2.1825 lean search,
 * any status) and merges the full rows into the client cache; the section is
 * forced open while a search is active. What lied was the header — it kept
 * saying "Expand to load" — and nothing above the fold said where the match
 * landed, so an office user searching a paid job's number saw five sections
 * at (0) and concluded the app lost the job.
 *
 * One pure model feeds both the hint row under the search bar and the Paid
 * header's count. Order of truth: matches in the open sections need no hint;
 * paid matches are named and counted; the lean lookup still running says so;
 * only when it has finished with nothing anywhere does the board say
 * "nowhere, Paid in Full included".
 */
export type StagesPaidSearchHint =
  | { kind: 'paid_matches'; count: number; label: string }
  | { kind: 'checking'; label: string }
  | { kind: 'none_anywhere'; label: string }

export function stagesPaidSearchHint(input: {
  searchActive: boolean
  /** rows the search matched in Waiting / Working / Ready to Bill / Billed / Collections */
  openMatchCount: number
  /** paid rows the search matched (already merged client-side) */
  paidMatchCount: number
  /** the debounced lean all-jobs lookup is still in flight */
  serverSearchBusy: boolean
}): StagesPaidSearchHint | null {
  if (!input.searchActive) return null
  const paid = Math.max(0, Math.floor(input.paidMatchCount))
  if (paid > 0) {
    return {
      kind: 'paid_matches',
      count: paid,
      label: `${paid} match${paid === 1 ? '' : 'es'} in Paid in Full — show ${paid === 1 ? 'it' : 'them'}`,
    }
  }
  if (input.openMatchCount > 0) return null
  if (input.serverSearchBusy) return { kind: 'checking', label: 'Checking Paid in Full…' }
  return { kind: 'none_anywhere', label: 'No match anywhere — Paid in Full included' }
}

/** The Paid in Full header count while a search is active: matches, never "Expand to load". */
export function stagesPaidHeaderSearchCount(paidMatchCount: number, serverSearchBusy: boolean): string {
  const n = Math.max(0, Math.floor(paidMatchCount))
  if (n === 0 && serverSearchBusy) return 'checking…'
  return `${n} match${n === 1 ? '' : 'es'}`
}
