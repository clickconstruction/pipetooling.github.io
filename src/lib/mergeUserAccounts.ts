/** Active Accounts → Merge users: client-side eligibility rules for picking the two
 * accounts. Mirrors the server checks in `merge_user_accounts` (the RPC re-validates
 * everything); pure — no React/supabase. */

export type MergeCandidateAccount = {
  id: string
  role: string | null
  archived_at?: string | null
  last_sign_in_at?: string | null
}

/** "Signed into" = live and has an auth last_sign_in_at (trigger-synced onto users). */
export function accountIsInUse(a: MergeCandidateAccount): boolean {
  return a.archived_at == null && a.last_sign_in_at != null
}

/**
 * Can `absorbed` be merged into `survivor`?
 * - different accounts, same role
 * - absorbed must be archived or never signed in
 * - when either account is live, the survivor must be the live one
 * Returns null when eligible, else a human-readable reason.
 */
export function mergeIneligibilityReason(
  survivor: MergeCandidateAccount,
  absorbed: MergeCandidateAccount,
): string | null {
  if (survivor.id === absorbed.id) return 'Pick two different accounts.'
  if ((survivor.role ?? '') !== (absorbed.role ?? '')) {
    return `Both accounts must have the same role (${survivor.role ?? '—'} vs ${absorbed.role ?? '—'}).`
  }
  if (accountIsInUse(absorbed)) {
    return 'The account being merged away must be archived, or never signed into. Archive it first.'
  }
  if (survivor.archived_at != null && absorbed.archived_at == null) {
    return 'Keep the live account: when one of the two is live, it must be the survivor.'
  }
  return null
}

/** Accounts offered in the "Merge from" dropdown once a survivor is chosen. */
export function eligibleAbsorbCandidates<T extends MergeCandidateAccount>(
  survivor: T | null,
  accounts: T[],
): T[] {
  if (!survivor) return []
  return accounts.filter((a) => mergeIneligibilityReason(survivor, a) === null)
}
