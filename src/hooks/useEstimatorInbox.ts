import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from './useAuth'
import { useRealtimeChannel } from './useRealtimeChannel'
import type { EstimatorInboxRow, EstimatorThreadNoteRow } from '../components/EstimatorInboxSection'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

const ESTIMATOR_REQUEST_SELECT =
  'id, title, links, created_at, from_user_id, reference_summary, location_lat, location_lng, status, closed_at, closed_by_user_id, closed_note, sender:users!estimator_requests_from_user_id_fkey(name, email), closed_by:users!estimator_requests_closed_by_user_id_fkey(name)'

export function useEstimatorInbox() {
  const { user: authUser, role } = useAuth()
  const { showToast } = useToastContext()

  const [estimatorInboxEligible, setEstimatorInboxEligible] = useState(false)
  const [estimatorRequests, setEstimatorRequests] = useState<EstimatorInboxRow[]>([])
  const [estimatorRequestsLoading, setEstimatorRequestsLoading] = useState(false)
  const [estimatorRequestDismissingId, setEstimatorRequestDismissingId] = useState<string | null>(null)
  const [expandedEstimatorRequestId, setExpandedEstimatorRequestId] = useState<string | null>(null)
  const [estimatorThreadNotesByRequestId, setEstimatorThreadNotesByRequestId] = useState<
    Record<string, EstimatorThreadNoteRow[]>
  >({})
  const [estimatorNotesLoadingRequestId, setEstimatorNotesLoadingRequestId] = useState<string | null>(null)
  const [estimatorNoteSubmitRequestId, setEstimatorNoteSubmitRequestId] = useState<string | null>(null)
  const [estimatorNoteDraft, setEstimatorNoteDraft] = useState('')
  const expandedEstimatorRequestIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!authUser?.id) {
      setEstimatorInboxEligible(false)
      return
    }
    if (role === 'dev') {
      setEstimatorInboxEligible(true)
      return
    }
    let cancelled = false
    supabase
      .from('estimator_group_members')
      .select('user_id')
      .eq('user_id', authUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setEstimatorInboxEligible(!!data)
      })
    return () => {
      cancelled = true
    }
  }, [authUser?.id, role])

  const loadEstimatorRequests = useCallback(() => {
    if (!authUser?.id || !estimatorInboxEligible) {
      setEstimatorRequests([])
      return
    }
    setEstimatorRequestsLoading(true)
    void Promise.all([
      supabase
        .from('estimator_requests')
        .select(ESTIMATOR_REQUEST_SELECT)
        .order('created_at', { ascending: false }),
      supabase.from('estimator_request_dismissals').select('request_id').eq('user_id', authUser.id),
    ]).then(async ([requestsRes, dismissalsRes]) => {
      if (requestsRes.error) {
        setEstimatorRequestsLoading(false)
        console.error('Estimator inbox load:', requestsRes.error)
        return
      }
      const dismissedIds = new Set(
        (dismissalsRes.data ?? []).map((r: { request_id: string }) => r.request_id),
      )
      const rows = ((requestsRes.data ?? []) as EstimatorInboxRow[]).filter(
        (r) => !dismissedIds.has(r.id),
      )
      rows.sort((a, b) => {
        const aOpen = a.status === 'open' ? 1 : 0
        const bOpen = b.status === 'open' ? 1 : 0
        if (aOpen !== bOpen) return bOpen - aOpen
        const aDate = a.status === 'closed' ? (a.closed_at ?? a.created_at ?? '') : (a.created_at ?? '')
        const bDate = b.status === 'closed' ? (b.closed_at ?? b.created_at ?? '') : (b.created_at ?? '')
        return bDate.localeCompare(aDate)
      })

      let merged: EstimatorInboxRow[] = rows.map((r) => ({
        ...r,
        note_count: 0,
        last_note_at: null,
      }))

      if (rows.length > 0) {
        try {
          const statsRows = await withSupabaseRetry(
            async () =>
              supabase.rpc('estimator_inbox_note_stats', { p_request_ids: rows.map((r) => r.id) }),
            'estimator inbox note stats',
          )
          type StatRow = { request_id: string; note_count: number; last_note_at: string | null }
          const list = (statsRows ?? []) as StatRow[]
          const byId = new Map(
            list.map((s) => [
              s.request_id,
              { note_count: Number(s.note_count), last_note_at: s.last_note_at ?? null },
            ]),
          )
          merged = rows.map((r) => {
            const s = byId.get(r.id)
            return {
              ...r,
              note_count: s?.note_count ?? 0,
              last_note_at: s?.last_note_at ?? null,
            }
          })
        } catch (e) {
          console.error('Estimator inbox note stats:', e)
        }
      }

      setEstimatorRequests(merged)
      setEstimatorRequestsLoading(false)
    })
  }, [authUser?.id, estimatorInboxEligible])

  const loadEstimatorNotesForRequest = useCallback(
    async (requestId: string) => {
      setEstimatorNotesLoadingRequestId(requestId)
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('estimator_request_notes')
              .select('id, body, created_at, author:users!estimator_request_notes_author_user_id_fkey(name)')
              .eq('request_id', requestId)
              .order('created_at', { ascending: true }),
          'load estimator_request notes',
        )
        const rows = (data as EstimatorThreadNoteRow[] | null) ?? []
        setEstimatorThreadNotesByRequestId((prev) => ({ ...prev, [requestId]: rows }))
      } catch (e) {
        showToast(formatErrorMessage(e, 'Failed to load estimator notes'), 'error')
      } finally {
        setEstimatorNotesLoadingRequestId(null)
      }
    },
    [showToast],
  )

  useEffect(() => {
    expandedEstimatorRequestIdRef.current = expandedEstimatorRequestId
  }, [expandedEstimatorRequestId])

  useEffect(() => {
    if (!expandedEstimatorRequestId) return
    setEstimatorNoteDraft('')
    void loadEstimatorNotesForRequest(expandedEstimatorRequestId)
  }, [expandedEstimatorRequestId, loadEstimatorNotesForRequest])

  useEffect(() => {
    if (!authUser?.id || !estimatorInboxEligible) {
      setEstimatorRequests([])
      return
    }
    loadEstimatorRequests()
  }, [authUser?.id, estimatorInboxEligible, loadEstimatorRequests])

  const estimatorInboxEnabled = !!authUser?.id && estimatorInboxEligible
  const estimatorRequestsFilters = useMemo(
    () => [{ event: '*' as const, schema: 'public', table: 'estimator_requests' }],
    [],
  )
  useRealtimeChannel(
    estimatorInboxEnabled,
    'checklist-estimator-requests',
    estimatorRequestsFilters,
    () => {
      loadEstimatorRequests()
    },
    { debounceMs: 400 },
  )

  // We can't filter at the server because the relevant request_id changes as
  // the user expands/collapses items. Volume on `estimator_request_notes` is
  // low, so on any insert we reload the requests list and (if a request is
  // expanded) its notes. The previous per-payload optimization is gone; a
  // small extra fetch when the insert is unrelated to the expanded request is
  // an acceptable trade for the visibility/debounce/epoch protections.
  const estimatorNotesFilters = useMemo(
    () => [{ event: 'INSERT' as const, schema: 'public', table: 'estimator_request_notes' }],
    [],
  )
  useRealtimeChannel(
    estimatorInboxEnabled,
    'checklist-estimator-request-notes',
    estimatorNotesFilters,
    () => {
      const expandedId = expandedEstimatorRequestIdRef.current
      if (expandedId) void loadEstimatorNotesForRequest(expandedId)
      loadEstimatorRequests()
    },
    { debounceMs: 400 },
  )

  function toggleExpandEstimatorRequest(requestId: string) {
    setExpandedEstimatorRequestId((prev) => (prev === requestId ? null : requestId))
  }

  async function submitEstimatorNote(requestId: string) {
    if (!authUser?.id) return
    const body = estimatorNoteDraft.trim()
    if (!body) {
      showToast('Enter a note.', 'error')
      return
    }
    if (body.length > 2000) {
      showToast('Note must be 2000 characters or less.', 'error')
      return
    }

    let wasClosed = false
    const row = estimatorRequests.find((r) => r.id === requestId)
    if (row) {
      wasClosed = row.status === 'closed'
    } else {
      const { data: statusRow, error: statusErr } = await supabase
        .from('estimator_requests')
        .select('status')
        .eq('id', requestId)
        .maybeSingle()
      if (statusErr) {
        showToast(statusErr.message, 'error')
        return
      }
      wasClosed = statusRow?.status === 'closed'
    }

    setEstimatorNoteSubmitRequestId(requestId)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('estimator_request_notes').insert({
            request_id: requestId,
            author_user_id: authUser.id,
            body,
          }),
        'insert estimator_request note',
      )

      if (wasClosed) {
        try {
          await withSupabaseRetry(
            async () =>
              supabase
                .from('estimator_requests')
                .update({
                  status: 'open',
                  closed_at: null,
                  closed_by_user_id: null,
                  closed_note: null,
                })
                .eq('id', requestId),
            'reopen estimator request',
          )
        } catch (reopenErr) {
          setEstimatorNoteDraft('')
          await loadEstimatorNotesForRequest(requestId)
          loadEstimatorRequests()
          showToast(formatErrorMessage(reopenErr, 'Note saved, but reopen failed.'), 'error')
          return
        }
      }

      setEstimatorNoteDraft('')
      await loadEstimatorNotesForRequest(requestId)
      loadEstimatorRequests()
      showToast(wasClosed ? 'Note added and task reopened.' : 'Note added.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to add note'), 'error')
    } finally {
      setEstimatorNoteSubmitRequestId(null)
    }
  }

  async function submitEstimatorNoteAndClose(requestId: string) {
    if (!authUser?.id) return
    const body = estimatorNoteDraft.trim()
    if (!body) {
      showToast('Enter a note.', 'error')
      return
    }
    if (body.length > 2000) {
      showToast('Note must be 2000 characters or less.', 'error')
      return
    }

    const row = estimatorRequests.find((r) => r.id === requestId)
    if (row?.status === 'closed') {
      showToast('This request is already closed.', 'error')
      return
    }

    setEstimatorNoteSubmitRequestId(requestId)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('estimator_request_notes').insert({
            request_id: requestId,
            author_user_id: authUser.id,
            body,
          }),
        'insert estimator_request note',
      )

      try {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('estimator_requests')
              .update({
                status: 'closed',
                closed_at: new Date().toISOString(),
                closed_by_user_id: authUser.id,
                closed_note: body,
              })
              .eq('id', requestId),
          'close estimator request',
        )
      } catch (closeErr) {
        setEstimatorNoteDraft('')
        await loadEstimatorNotesForRequest(requestId)
        loadEstimatorRequests()
        showToast(formatErrorMessage(closeErr, 'Note saved, but mark closed failed.'), 'error')
        return
      }

      setEstimatorNoteDraft('')
      await loadEstimatorNotesForRequest(requestId)
      loadEstimatorRequests()
      showToast('Note added and request marked closed.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to add note'), 'error')
    } finally {
      setEstimatorNoteSubmitRequestId(null)
    }
  }

  async function dismissEstimatorRequest(requestId: string) {
    if (!authUser?.id) return
    setEstimatorRequestDismissingId(requestId)
    const { error } = await supabase.from('estimator_request_dismissals').insert({
      user_id: authUser.id,
      request_id: requestId,
    })
    setEstimatorRequestDismissingId(null)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    setEstimatorRequests((prev) => prev.filter((r) => r.id !== requestId))
    setExpandedEstimatorRequestId((ex) => (ex === requestId ? null : ex))
  }

  return {
    estimatorInboxEligible,
    estimatorRequests,
    estimatorRequestsLoading,
    estimatorRequestDismissingId,
    expandedEstimatorRequestId,
    estimatorThreadNotesByRequestId,
    estimatorNotesLoadingRequestId,
    estimatorNoteSubmitRequestId,
    estimatorNoteDraft,
    setEstimatorNoteDraft,
    toggleExpandEstimatorRequest,
    submitEstimatorNote,
    submitEstimatorNoteAndClose,
    dismissEstimatorRequest,
    loadEstimatorRequests,
  }
}
