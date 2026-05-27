/**
 * Pure helpers for the Banking Mercury Accounting "Approve by default"
 * toggle (per `RECENT_FEATURES.md` v2.581). Lives outside React so the gate
 * predicate and signature builder can be unit-tested without rendering the
 * Approvals section.
 *
 * Pairs with the v2.580 "Apply rules by default" pattern but operates on
 * the *next* layer: rules create pending suggestions; this helper drives
 * the auto-approval of those suggestions via the existing
 * `handleApproveAll` callback (which writes to
 * `mercury_transaction_drag_sort_assignments` and skips Internal Transfers
 * conflicts).
 *
 * `buildApproveByDefaultSignature` is intentionally cheap and stable:
 * sorted suggestion ids joined with `,`. Sort independence means upstream
 * re-orderings (e.g. a different `created_at` tiebreak) don't invalidate
 * the signature and re-fire auto-approve on the same set. Once a
 * suggestion is approved its `status` flips to `'approved'` server-side
 * and `loadPending` filters it out, so the signature naturally shrinks to
 * just the conflict rows that `handleApproveAll` couldn't take (Internal
 * Transfers + job splits) — which means the next compute returns a
 * smaller, stable signature and the effect quiets.
 */

export function buildApproveByDefaultSignature(
  pending: ReadonlyArray<{ suggestionId: string }>,
): string {
  return pending.map((p) => p.suggestionId).sort().join(',')
}

export type ShouldAutoApproveAccountingSuggestionsState = {
  enabled: boolean
  pendingLoading: boolean
  approveAllBusy: boolean
  pendingCount: number
  currentSignature: string
  lastSignature: string | null
}

export function shouldAutoApproveAccountingSuggestions(
  state: ShouldAutoApproveAccountingSuggestionsState,
): boolean {
  if (!state.enabled) return false
  if (state.pendingLoading) return false
  if (state.approveAllBusy) return false
  if (state.pendingCount === 0) return false
  if (state.currentSignature === state.lastSignature) return false
  return true
}
