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

export type ExternalPersonCandidate = {
  id: string
  name: string
  kind: string
  account_user_id: string | null
  archived_at?: string | null
}

/** Option-value prefix distinguishing external roster people from account ids in the
 * "Merge this account away" select. */
export const EXTERNAL_MERGE_OPTION_PREFIX = 'external-person:'

/** Roles whose survivors may also absorb external roster people, mapped to the
 * people.kind they match. Only subcontractors for now — extend deliberately. */
const EXTERNAL_ABSORB_KIND_BY_ROLE: Record<string, string> = { subcontractor: 'sub' }

/**
 * External roster people (no login account) offered in the "Merge this account away"
 * dropdown for the picked survivor. These route through the combine-people engine
 * (roster identity fold), not the merge_user_accounts RPC:
 * - survivor must be a live account whose role admits external absorbs (subcontractor → kind 'sub')
 * - the person must be active and not linked to any account (linked rows already render
 *   as their account, and account-vs-account is the RPC's job)
 */
export function eligibleExternalAbsorbCandidates<T extends ExternalPersonCandidate>(
  survivor: MergeCandidateAccount | null,
  people: T[],
): T[] {
  if (!survivor) return []
  if (survivor.archived_at != null) return []
  const kind = EXTERNAL_ABSORB_KIND_BY_ROLE[survivor.role ?? '']
  if (!kind) return []
  return people.filter((p) => p.kind === kind && p.archived_at == null && !p.account_user_id)
}
