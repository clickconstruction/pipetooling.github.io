import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { fetchUserNamesForIds } from '../lib/scheduleDispatchHub'
import { denverCalendarDayKey, ymdAddDays } from '../utils/dateUtils'
import { useAuth } from './useAuth'
import type { SwitchableUser } from '../lib/userReviewSwitchOptions'

export type UseUserReviewRosterArgs = {
  /**
   * Lazy gate. The hook does nothing (and returns the empty initial state)
   * until `enabled` flips to `true`. Used so the switcher modal only pays
   * for the roster query when it actually opens.
   */
  enabled: boolean
  /** Currently-viewed subject. Always appended so the picker is never empty. */
  currentUserId: string
  /** Currently-viewed subject's display name (used for the fallback row). */
  currentDisplayName: string
}

export type UseUserReviewRosterResult = {
  roster: ReadonlyArray<SwitchableUser>
  loading: boolean
  error: string | null
}

const LOOKBACK_DAYS = 30

type CacheEntry = {
  key: string
  roster: ReadonlyArray<SwitchableUser>
}

/**
 * Lazy hook that loads the roster for the User Review switch-user modal.
 *
 * - No-op while `enabled === false`.
 * - On first `enabled = true` for a given `(authUserId, currentUserId)`:
 *   - In parallel: (a) distinct `clock_sessions.user_id` over the last
 *     {@link LOOKBACK_DAYS} days (Chicago calendar via
 *     `denverCalendarDayKey`); (b) `users.archived_at` lookup so we can
 *     drop archived people.
 *   - Resolves display names via `fetchUserNamesForIds`.
 *   - Always appends the current subject (with the supplied display
 *     name) if not present, so the modal is never empty.
 *   - Caches the result in a ref keyed on `(authUserId, currentUserId)`
 *     so re-opening the switcher within the same User Review modal
 *     session is instant (no network).
 *
 * Errors are surfaced via the `error` field; the hook leaves the
 * previous roster intact so a transient failure doesn't blank the
 * picker.
 */
export function useUserReviewRoster({
  enabled,
  currentUserId,
  currentDisplayName,
}: UseUserReviewRosterArgs): UseUserReviewRosterResult {
  const { user } = useAuth()
  const authUserId = user?.id ?? ''

  const [roster, setRoster] = useState<ReadonlyArray<SwitchableUser>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cacheRef = useRef<CacheEntry | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (!authUserId) return

    const cacheKey = `${authUserId}|${currentUserId}`
    const cached = cacheRef.current
    if (cached && cached.key === cacheKey) {
      setRoster(cached.roster)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const today = denverCalendarDayKey(Date.now())
        const startYmd = ymdAddDays(today, -LOOKBACK_DAYS)

        const sessionsPromise = withSupabaseRetry(
          async () =>
            await supabase
              .from('clock_sessions')
              .select('user_id')
              .gte('work_date', startYmd)
              .not('user_id', 'is', null),
          'useUserReviewRoster.clockSessions',
        )

        const sessionRows = (await sessionsPromise) as ReadonlyArray<{ user_id: string | null }>
        const distinctIds = new Set<string>()
        for (const row of sessionRows ?? []) {
          if (row.user_id) distinctIds.add(row.user_id)
        }
        if (currentUserId) distinctIds.add(currentUserId)

        const idList = [...distinctIds]
        if (idList.length === 0) {
          const fallback: ReadonlyArray<SwitchableUser> =
            currentUserId && currentDisplayName.trim()
              ? [{ id: currentUserId, name: currentDisplayName.trim() }]
              : []
          if (!cancelled) {
            cacheRef.current = { key: cacheKey, roster: fallback }
            setRoster(fallback)
            setLoading(false)
          }
          return
        }

        const [archivedRows, nameLookup] = await Promise.all([
          withSupabaseRetry(
            async () =>
              await supabase
                .from('users')
                .select('id, archived_at')
                .in('id', idList),
            'useUserReviewRoster.usersArchived',
          ) as Promise<ReadonlyArray<{ id: string; archived_at: string | null }>>,
          fetchUserNamesForIds(idList),
        ])

        if (nameLookup.error) throw new Error(nameLookup.error)

        const archivedIds = new Set<string>()
        for (const row of archivedRows ?? []) {
          if (row.archived_at) archivedIds.add(row.id)
        }

        const next: SwitchableUser[] = []
        const seen = new Set<string>()
        for (const id of idList) {
          if (id === currentUserId) continue
          if (archivedIds.has(id)) continue
          const name = nameLookup.data.get(id) ?? ''
          if (!name || name === 'Unknown' || name === 'Unnamed') continue
          if (seen.has(id)) continue
          seen.add(id)
          next.push({ id, name })
        }

        if (currentUserId && !seen.has(currentUserId)) {
          const currentName =
            currentDisplayName.trim() ||
            (nameLookup.data.get(currentUserId) ?? '').trim()
          if (currentName) {
            next.push({ id: currentUserId, name: currentName })
          }
        }

        if (!cancelled) {
          cacheRef.current = { key: cacheKey, roster: next }
          setRoster(next)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(formatErrorMessage(e))
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, authUserId, currentUserId, currentDisplayName])

  return { roster, loading, error }
}
