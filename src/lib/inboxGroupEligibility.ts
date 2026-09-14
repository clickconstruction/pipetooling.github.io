import type { UserRole } from '../hooks/useAuth'

/**
 * Inbox group eligibility — the one reading of "is the signed-in user in the
 * dispatch / estimator group?" behind the Dispatch inbox, the Estimator inbox
 * and the Customer Waiting banner (folded from three copies; see
 * `useInboxGroupEligibility`). Pure: the hook does the fetching.
 *
 * The rules, unchanged from the copies:
 *  - no signed-in user (or the caller disabled the read, e.g. a digital twin
 *    behind the banner) → not eligible anywhere, no query;
 *  - `dev` → eligible everywhere, no query;
 *  - anyone else → a row in the group's members table means eligible.
 */
export type InboxGroup = 'dispatch' | 'estimator'

export const INBOX_GROUP_MEMBERS_TABLE = {
  dispatch: 'dispatch_group_members',
  estimator: 'estimator_group_members',
} as const satisfies Record<InboxGroup, string>

export type InboxGroupEligibility = Record<InboxGroup, boolean>

export const NO_INBOX_GROUP_ELIGIBILITY: InboxGroupEligibility = Object.freeze({ dispatch: false, estimator: false })

/** What the hook must do for this viewer: settle without a query, or look the groups up. */
export type InboxGroupEligibilityPlan =
  | { kind: 'none' }
  | { kind: 'all' }
  | { kind: 'lookup'; userId: string }

export function planInboxGroupEligibility(input: {
  userId: string | null | undefined
  role: UserRole | null | undefined
  /** Caller-side veto that wins over everything (digital twins never see the banner). */
  disabled?: boolean
}): InboxGroupEligibilityPlan {
  if (!input.userId || input.disabled) return { kind: 'none' }
  if (input.role === 'dev') return { kind: 'all' }
  return { kind: 'lookup', userId: input.userId }
}

/** Eligibility for the requested groups only; groups not asked about stay false. */
export function inboxGroupEligibilityFor(groups: readonly InboxGroup[], isEligible: (group: InboxGroup) => boolean): InboxGroupEligibility {
  const out: InboxGroupEligibility = { ...NO_INBOX_GROUP_ELIGIBILITY }
  for (const group of groups) out[group] = isEligible(group)
  return out
}

/** A members row (any non-null value from `maybeSingle`) means the user is in the group. */
export function membershipRowMeansEligible(row: unknown): boolean {
  return !!row
}

export function sameInboxGroupEligibility(a: InboxGroupEligibility, b: InboxGroupEligibility): boolean {
  return a.dispatch === b.dispatch && a.estimator === b.estimator
}
