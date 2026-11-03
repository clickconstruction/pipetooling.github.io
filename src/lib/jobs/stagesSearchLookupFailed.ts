/**
 * When the Pipeline search's server lookup fails (the owner's yes, 2026-11-03). The lookup is the only part of
 * the search that reaches the jobs the board has not loaded: every Paid in Full job, and the sections not loaded
 * yet. When it failed, the board searched only its own rows and still said *No match anywhere — Paid in Full
 * included*. When the rows it found did not load, the same. The # jump flashed *No job matches that number*.
 *
 * Each now says what was not searched and why. The search's line rides on `OfflineRetryPanel`: a lost signal
 * offers Retry and runs again by itself when the signal comes back, and a refusal shows its reason with none.
 */
import type { OfflineRecoveryLastError } from '../offlineRecoveryState'

export type StagesSearchLookupFailure = {
  failure: OfflineRecoveryLastError
  /** null: the lookup itself failed. A number: the lookup found that many jobs whose rows did not load. */
  unloadedMatches: number | null
}

/** The line above the board. */
export function stagesSearchLookupFailedWords(unloadedMatches: number | null): string {
  if (unloadedMatches == null) return 'Only the jobs already on the board were searched.'
  return unloadedMatches === 1 ? '1 more match could not be loaded.' : `${unloadedMatches} more matches could not be loaded.`
}

/** The panel's words for a lost signal: a read, so nothing was lost, and it runs again by itself. */
export function stagesSearchLookupOfflineMessage(unloadedMatches: number | null): string {
  return unloadedMatches == null
    ? 'No connection, so the other jobs were not searched. The search runs again when the signal is back.'
    : 'No connection, so they did not load. They load again when the signal is back.'
}

/** The # jump's toast when its lookup fails, in place of *No job matches that number*. */
export function stagesNumberLookupFailedWords(digits: string, failure: OfflineRecoveryLastError): string {
  return failure.kind === 'network'
    ? `No connection, so #${digits} could not be looked up. Try again when the signal is back.`
    : `Could not look up #${digits}. ${failure.message}`
}
