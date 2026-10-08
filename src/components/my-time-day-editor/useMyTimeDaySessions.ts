import { useCallback, useEffect, useMemo, useState } from 'react'
import { CLOCK_SESSION_DAY_EDITOR_SELECT } from '../../lib/clockSessionSelect'
import {
  expandClustersSplitPairwiseOverlaps,
  groupTimeContiguousSessionClusters,
  normalizeDayEditorSession,
  type DayEditorSession,
} from '../../lib/myTimeDayTimeline'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'

export type UseMyTimeDaySessionsInput = {
  dateStr: string
  /** The parent's sessions. Non-empty means the parent controls the day and nothing is fetched. */
  sessionsProp: DayEditorSession[]
  subjectUserIdProp?: string | null
  subjectDisplayName?: string | null
  /** Outside the saveable range the day reads empty and nothing is fetched. */
  inSaveableRange: boolean
}

/**
 * The My Time day editor's session data engine (map step 8, `docs/MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md`
 * → region 1, the shared substrate): who is signed in, whose day it is and the title's name for them,
 * the day's `clock_sessions` read (re-run by `bumpSessionsFetchNonce`) or the parent's sessions,
 * sorted, keyed and clustered, and the 15 s clock while a session is open. Moved verbatim from
 * `DashboardMyTimeDayEditorModal`, which keeps it in the shell and destructures the bundle.
 */
export function useMyTimeDaySessions({
  dateStr,
  sessionsProp,
  subjectUserIdProp,
  subjectDisplayName,
  inSaveableRange,
}: UseMyTimeDaySessionsInput) {
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [fetchedSessions, setFetchedSessions] = useState<DayEditorSession[] | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsFetchError, setSessionsFetchError] = useState<string | null>(null)
  const [resolvedSubjectLabel, setResolvedSubjectLabel] = useState<string | null>(null)
  const [sessionsFetchNonce, setSessionsFetchNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        setAuthUserId(data.user?.id ?? null)
        setAuthReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const effectiveSubjectUserId = subjectUserIdProp ?? authUserId
  const editingSelf = !!(authUserId && effectiveSubjectUserId === authUserId)

  useEffect(() => {
    if (subjectDisplayName?.trim()) {
      setResolvedSubjectLabel(subjectDisplayName.trim())
      return
    }
    if (!authUserId) {
      setResolvedSubjectLabel(null)
      return
    }
    const isSelf = !subjectUserIdProp || subjectUserIdProp === authUserId
    const userIdToLoad = isSelf ? authUserId : subjectUserIdProp
    if (!userIdToLoad) {
      setResolvedSubjectLabel(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const row = (await withSupabaseRetry(
          async () => supabase.from('users').select('name').eq('id', userIdToLoad).maybeSingle(),
          'users name for my time editor'
        )) as { name: string | null } | null
        if (cancelled) return
        const n = row?.name?.trim()
        if (isSelf) {
          setResolvedSubjectLabel(n && n.length > 0 ? n : 'You')
        } else {
          setResolvedSubjectLabel(n && n.length > 0 ? n : 'Team member')
        }
      } catch {
        if (!cancelled) setResolvedSubjectLabel(isSelf ? 'You' : 'Team member')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [subjectUserIdProp, authUserId, subjectDisplayName])

  const modalTitlePerson = useMemo(() => {
    const t = resolvedSubjectLabel?.trim()
    if (t) return t
    const selfish = !subjectUserIdProp || (authUserId != null && subjectUserIdProp === authUserId)
    return selfish ? 'You' : 'Team member'
  }, [resolvedSubjectLabel, subjectUserIdProp, authUserId])

  useEffect(() => {
    let cancelled = false
    if (sessionsProp.length > 0) {
      setFetchedSessions(null)
      setSessionsFetchError(null)
      setSessionsLoading(false)
      return () => {
        cancelled = true
      }
    }
    if (!inSaveableRange) {
      setFetchedSessions([])
      setSessionsFetchError(null)
      setSessionsLoading(false)
      return () => {
        cancelled = true
      }
    }
    if (!effectiveSubjectUserId || !dateStr) {
      setFetchedSessions([])
      setSessionsFetchError(null)
      setSessionsLoading(false)
      return () => {
        cancelled = true
      }
    }
    setSessionsLoading(true)
    setSessionsFetchError(null)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('clock_sessions')
              .select(CLOCK_SESSION_DAY_EDITOR_SELECT)
              .eq('user_id', effectiveSubjectUserId)
              .eq('work_date', dateStr)
              .is('rejected_at', null)
              .is('revoked_at', null),
          'clock_sessions day for my time editor'
        )
        if (cancelled) return
        setFetchedSessions((data ?? []).map((row) => normalizeDayEditorSession(row as DayEditorSession)))
      } catch (e: unknown) {
        if (!cancelled) {
          setSessionsFetchError(formatErrorMessage(e, 'Could not load clock sessions'))
          setFetchedSessions([])
        }
      } finally {
        if (!cancelled) setSessionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionsProp.length, inSaveableRange, effectiveSubjectUserId, dateStr, sessionsFetchNonce])

  const fetchDaySessionsForEditor = useCallback(async (): Promise<DayEditorSession[]> => {
    if (!effectiveSubjectUserId || !dateStr) return []
    const data = await withSupabaseRetry(
      async () =>
        supabase
          .from('clock_sessions')
          .select(CLOCK_SESSION_DAY_EDITOR_SELECT)
          .eq('user_id', effectiveSubjectUserId)
          .eq('work_date', dateStr)
          .is('rejected_at', null)
          .is('revoked_at', null),
      'clock_sessions day for my time editor refetch',
    )
    return (data ?? []).map((row) => normalizeDayEditorSession(row as DayEditorSession))
  }, [effectiveSubjectUserId, dateStr])

  const resolvedSessions = useMemo(() => {
    const raw = sessionsProp.length > 0 ? sessionsProp : (fetchedSessions ?? [])
    return raw.map((s) => normalizeDayEditorSession(s))
  }, [sessionsProp, fetchedSessions])
  const pendingAuthForFetch = sessionsProp.length === 0 && !subjectUserIdProp && !authReady

  const bumpSessionsFetchNonce = useCallback(() => setSessionsFetchNonce((n) => n + 1), [])

  const sortedSessions = useMemo(
    () =>
      [...resolvedSessions].sort((a, b) => new Date(a.clocked_in_at).getTime() - new Date(b.clocked_in_at).getTime()),
    [resolvedSessions]
  )

  const sessionsKey = useMemo(
    () =>
      sortedSessions
        .map(
          (s) =>
            `${s.id}:${s.clocked_in_at}:${s.clocked_out_at ?? ''}:${s.approved_at ?? ''}:${s.work_date}`
        )
        .join('|'),
    [sortedSessions]
  )

  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const hasOpen = sortedSessions.some((s) => !s.clocked_out_at)
    if (!hasOpen) return
    const t = setInterval(() => setNowTick(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [sortedSessions])

  const sessionClusters = useMemo(
    () => expandClustersSplitPairwiseOverlaps(groupTimeContiguousSessionClusters(sortedSessions), nowTick),
    [sortedSessions, nowTick],
  )

  return {
    authUserId,
    effectiveSubjectUserId,
    editingSelf,
    modalTitlePerson,
    fetchedSessions,
    setFetchedSessions,
    sessionsLoading,
    sessionsFetchError,
    setSessionsFetchNonce,
    bumpSessionsFetchNonce,
    fetchDaySessionsForEditor,
    resolvedSessions,
    pendingAuthForFetch,
    sortedSessions,
    sessionsKey,
    nowTick,
    sessionClusters,
  }
}
