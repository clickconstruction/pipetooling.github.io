import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import {
  INBOX_GROUP_MEMBERS_TABLE,
  NO_INBOX_GROUP_ELIGIBILITY,
  inboxGroupEligibilityFor,
  membershipRowMeansEligible,
  planInboxGroupEligibility,
  sameInboxGroupEligibility,
  type InboxGroup,
  type InboxGroupEligibility,
} from '../lib/inboxGroupEligibility'

/** Module-level constants so callers pass a stable array (the effect keys on its contents anyway). */
export const DISPATCH_INBOX_GROUP: readonly InboxGroup[] = ['dispatch']
export const ESTIMATOR_INBOX_GROUP: readonly InboxGroup[] = ['estimator']
export const BOTH_INBOX_GROUPS: readonly InboxGroup[] = ['dispatch', 'estimator']

/**
 * Is the signed-in user in the dispatch / estimator group? One reading for
 * `useDispatchInbox`, `useEstimatorInbox` and `CustomerWaitingContext` (each
 * used to run its own copy of this query). Rules live in
 * `lib/inboxGroupEligibility.ts`: signed out or `disabled` → false with no
 * query; `dev` → true with no query; otherwise one `maybeSingle` per group on
 * `*_group_members`, all in flight together, cancelled if the viewer changes.
 *
 * Starts as all-false and settles once (no loading flag — the copies had
 * none); membership is not refreshed by realtime, as before.
 */
export function useInboxGroupEligibility(
  groups: readonly InboxGroup[],
  options?: { disabled?: boolean },
): InboxGroupEligibility {
  const { user: authUser, role } = useAuth()
  const disabled = options?.disabled ?? false
  const groupsKey = groups.join(',')
  const [eligibility, setEligibility] = useState<InboxGroupEligibility>(NO_INBOX_GROUP_ELIGIBILITY)

  useEffect(() => {
    const wanted = groupsKey.split(',').filter((g): g is InboxGroup => g === 'dispatch' || g === 'estimator')
    const settle = (next: InboxGroupEligibility) =>
      setEligibility((prev) => (sameInboxGroupEligibility(prev, next) ? prev : next))
    const plan = planInboxGroupEligibility({ userId: authUser?.id, role, disabled })
    if (plan.kind === 'none') {
      settle(NO_INBOX_GROUP_ELIGIBILITY)
      return
    }
    if (plan.kind === 'all') {
      settle(inboxGroupEligibilityFor(wanted, () => true))
      return
    }
    let cancelled = false
    void Promise.all(
      wanted.map((group) =>
        supabase.from(INBOX_GROUP_MEMBERS_TABLE[group]).select('user_id').eq('user_id', plan.userId).maybeSingle(),
      ),
    ).then((results) => {
      if (cancelled) return
      const rowByGroup = new Map(wanted.map((group, i) => [group, results[i]?.data]))
      settle(inboxGroupEligibilityFor(wanted, (group) => membershipRowMeansEligible(rowByGroup.get(group))))
    })
    return () => {
      cancelled = true
    }
  }, [authUser?.id, role, disabled, groupsKey])

  return eligibility
}
