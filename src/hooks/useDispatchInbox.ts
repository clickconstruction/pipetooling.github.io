import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from './useAuth'
import { useRealtimeChannel } from './useRealtimeChannel'
import type {
  DispatchInboxDismissedRow,
  DispatchInboxRow,
  DispatchThreadNoteRow,
} from '../components/DispatchInboxSection'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { DISPATCH_REQUESTS_CHANGED_EVENT } from '../lib/dispatchRequestHelpers'
import {
  dispatchBadgeCounts as computeDispatchBadgeCounts,
  EMPTY_DISPATCH_BADGE_COUNTS,
  type DispatchBadgeCounts,
} from '../lib/dispatchInboxBadge'
import { notifyDispatchRequestClosure } from '../lib/dispatchRequestClosure'
import { sortDispatchInboxRows } from '../lib/dispatchInboxAging'
import {
  jobIdsForPicturesRequestSweep,
  pickOrphanedPicturesRequestIds,
  PICTURES_REQUEST_SELF_HEAL_NOTE,
} from '../lib/picturesDispatchRequests'
import { bidIdsForOpenJobSweep, pickOpenJobRequestsToClose } from '../lib/bids/wonDispatchHandoff'
import { closeOpenJobFromBidRequests } from '../lib/bids/openJobFromBidDispatchRequest'
import type { RequestPriority } from '../lib/requestPriority'

const DISPATCH_REQUEST_SELECT =
  'id, title, links, created_at, from_user_id, reference_summary, location_lat, location_lng, status, closed_at, closed_by_user_id, closed_note, pending_action, job_ledger_id, bid_id, priority, priority_changed_at, last_called_at, pending_payload, sender:users!dispatch_requests_from_user_id_fkey(name, email), closed_by:users!dispatch_requests_closed_by_user_id_fkey(name), last_called_by:users!dispatch_requests_last_called_by_user_id_fkey(name)'

const DISMISSED_DISPATCH_ID_CHUNK = 120

export function useDispatchInbox() {
  const { user: authUser, role } = useAuth()
  const { showToast } = useToastContext()

  const [dispatchInboxEligible, setDispatchInboxEligible] = useState(false)
  const [dispatchRequests, setDispatchRequests] = useState<DispatchInboxRow[]>([])
  const [dispatchRequestsLoading, setDispatchRequestsLoading] = useState(false)
  /** True once the first load has settled — the footer badge waits for it before recording. */
  const [dispatchRequestsLoaded, setDispatchRequestsLoaded] = useState(false)
  /**
   * Footer-badge counts (v2.2880, journey-map #24): `open` over EVERY row —
   * dismissal is per viewer and open rows can't be dismissed, so the badge no
   * longer depends on who tidied what; `closed` = closed rows this viewer
   * hasn't dismissed (telemetry only — what the old badge over-counted).
   */
  const [dispatchBadgeCounts, setDispatchBadgeCounts] = useState<DispatchBadgeCounts>(EMPTY_DISPATCH_BADGE_COUNTS)
  const [dispatchRequestDismissingId, setDispatchRequestDismissingId] = useState<string | null>(null)
  /** Row whose priority change is in flight (Customer Waiting, v2.3247). */
  const [dispatchPrioritySavingId, setDispatchPrioritySavingId] = useState<string | null>(null)
  const [expandedDispatchRequestId, setExpandedDispatchRequestId] = useState<string | null>(null)
  const [dispatchThreadNotesByRequestId, setDispatchThreadNotesByRequestId] = useState<
    Record<string, DispatchThreadNoteRow[]>
  >({})
  const [dispatchNotesLoadingRequestId, setDispatchNotesLoadingRequestId] = useState<string | null>(null)
  const [dispatchNoteSubmitRequestId, setDispatchNoteSubmitRequestId] = useState<string | null>(null)
  const [dispatchNoteDraft, setDispatchNoteDraft] = useState('')
  const expandedDispatchRequestIdRef = useRef<string | null>(null)
  /**
   * Request ids this session has already tried to self-heal. Without it, an
   * update that silently no-ops (RLS, or a row another tab reopened) would be
   * retried on every reload the close itself triggers — an endless loop.
   */
  const sweptPicturesRequestIdsRef = useRef<Set<string>>(new Set())
  const picturesSweepRunningRef = useRef(false)
  /** Breaks the sweep ↔ loader cycle (the loader triggers the sweep). */
  const loadDispatchRequestsRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!authUser?.id) {
      setDispatchInboxEligible(false)
      return
    }
    if (role === 'dev') {
      setDispatchInboxEligible(true)
      return
    }
    let cancelled = false
    supabase
      .from('dispatch_group_members')
      .select('user_id')
      .eq('user_id', authUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setDispatchInboxEligible(!!data)
      })
    return () => {
      cancelled = true
    }
  }, [authUser?.id, role])

  /**
   * Won → Dispatch (v2.3143): retire open "open the job" to-dos whose bid
   * already carries a job — someone opened it from the bid's own Job block or
   * an import, where RLS kept the creator from closing the row. Same shape as
   * the pictures sweep below: eligible viewers only, silent, never retried.
   */
  const openJobSweepRunningRef = useRef(false)
  const sweptOpenJobBidIdsRef = useRef<Set<string>>(new Set())
  const selfHealOpenJobRequests = useCallback(
    async (rows: DispatchInboxRow[]) => {
      if (!authUser?.id) return
      if (openJobSweepRunningRef.current) return
      const bidIds = bidIdsForOpenJobSweep(rows).filter((id) => !sweptOpenJobBidIdsRef.current.has(id))
      if (bidIds.length === 0) return
      openJobSweepRunningRef.current = true
      try {
        const jobRows = await withSupabaseRetry(
          async () => supabase.from('jobs_ledger').select('bid_id, hcp_number, created_at').in('bid_id', bidIds).order('created_at', { ascending: false }),
          'dispatch inbox open-job sweep',
        )
        const jobsByBidId = new Map<string, { hcpNumber: string | null }>()
        for (const r of (jobRows ?? []) as Array<{ bid_id: string | null; hcp_number: string | null }>) {
          if (r.bid_id && !jobsByBidId.has(r.bid_id)) jobsByBidId.set(r.bid_id, { hcpNumber: r.hcp_number })
        }
        const toClose = pickOpenJobRequestsToClose(rows.filter((r) => bidIds.includes(r.bid_id ?? '')), jobsByBidId)
        if (toClose.length === 0) return
        for (const c of toClose) sweptOpenJobBidIdsRef.current.add(c.bidId)
        for (const c of toClose) {
          await closeOpenJobFromBidRequests({ bidId: c.bidId, hcpNumber: c.hcpNumber, userId: authUser.id, role, elsewhere: true })
        }
        loadDispatchRequestsRef.current?.()
      } catch (e) {
        console.warn('dispatch inbox open-job sweep failed', e)
      } finally {
        openJobSweepRunningRef.current = false
      }
    },
    [authUser?.id, role],
  )

  /**
   * Retire open `link_job_pictures` requests whose job already has a pictures
   * link. Those can never auto-close on their own — the auto-close in
   * `JobFormModal` fires on a blank→set transition of `job_pictures_link`, so a
   * request filed after the link was set stays open until someone closes it by
   * hand. Runs only for dispatch-inbox-eligible viewers, i.e. exactly the
   * people who can close a request anyway.
   *
   * Best-effort and silent: no toast, no error surfacing. A blocked update just
   * leaves the row for a human, and the id is remembered so we never retry it
   * into a reload loop.
   */
  const selfHealOrphanedPicturesRequests = useCallback(
    async (rows: DispatchInboxRow[]) => {
      if (!authUser?.id) return
      if (picturesSweepRunningRef.current) return
      const candidateRows = rows.filter((r) => !sweptPicturesRequestIdsRef.current.has(r.id))
      const jobIds = jobIdsForPicturesRequestSweep(candidateRows)
      if (jobIds.length === 0) return
      picturesSweepRunningRef.current = true
      try {
        const jobRows = await withSupabaseRetry(
          async () =>
            supabase.from('jobs_ledger').select('id, job_pictures_link').in('id', jobIds),
          'dispatch inbox pictures-link sweep',
        )
        const links = new Map<string, string | null>(
          ((jobRows ?? []) as Array<{ id: string; job_pictures_link: string | null }>).map((r) => [
            r.id,
            r.job_pictures_link,
          ]),
        )
        const orphanIds = pickOrphanedPicturesRequestIds(candidateRows, links)
        if (orphanIds.length === 0) return
        for (const id of orphanIds) sweptPicturesRequestIdsRef.current.add(id)
        await withSupabaseRetry(
          async () =>
            supabase
              .from('dispatch_requests')
              .update({
                status: 'closed',
                closed_at: new Date().toISOString(),
                closed_by_user_id: authUser.id,
                closed_note: PICTURES_REQUEST_SELF_HEAL_NOTE,
              })
              .in('id', orphanIds)
              .eq('status', 'open'),
          'close orphaned link_job_pictures requests',
        )
        loadDispatchRequestsRef.current?.()
      } catch (e) {
        console.warn('dispatch inbox pictures-link sweep failed', e)
      } finally {
        picturesSweepRunningRef.current = false
      }
    },
    [authUser?.id],
  )

  const loadDispatchRequests = useCallback(() => {
    if (!authUser?.id || !dispatchInboxEligible) {
      setDispatchRequests([])
      setDispatchBadgeCounts(EMPTY_DISPATCH_BADGE_COUNTS)
      return
    }
    setDispatchRequestsLoading(true)
    void Promise.all([
      supabase.from('dispatch_requests').select(DISPATCH_REQUEST_SELECT).order('created_at', { ascending: false }),
      supabase.from('dispatch_request_dismissals').select('request_id').eq('user_id', authUser.id),
    ]).then(async ([requestsRes, dismissalsRes]) => {
      if (requestsRes.error) {
        setDispatchRequestsLoading(false)
        console.error('Dispatch inbox load:', requestsRes.error)
        return
      }
      const dismissedIds = new Set(
        (dismissalsRes.data ?? []).map((r: { request_id: string }) => r.request_id),
      )
      const allRows = (requestsRes.data ?? []) as DispatchInboxRow[]
      setDispatchBadgeCounts(computeDispatchBadgeCounts(allRows, dismissedIds))
      // Open rows OLDEST first (journey-map #40): the request a tech filed 46
      // days ago no longer sinks under this morning's. Closed rows stay
      // newest-closed-first — that half reads like a log.
      const rows = sortDispatchInboxRows(allRows.filter((r) => !dismissedIds.has(r.id)))

      let merged: DispatchInboxRow[] = rows.map((r) => ({
        ...r,
        note_count: 0,
        last_note_at: null,
      }))

      if (rows.length > 0) {
        try {
          const statsRows = await withSupabaseRetry(
            async () =>
              supabase.rpc('dispatch_inbox_note_stats', { p_request_ids: rows.map((r) => r.id) }),
            'dispatch inbox note stats',
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
          console.error('Dispatch inbox note stats:', e)
        }
      }

      setDispatchRequests(merged)
      setDispatchRequestsLoading(false)
      setDispatchRequestsLoaded(true)
      void selfHealOrphanedPicturesRequests(merged)
      void selfHealOpenJobRequests(merged)
    })
  }, [authUser?.id, dispatchInboxEligible, selfHealOrphanedPicturesRequests, selfHealOpenJobRequests])

  loadDispatchRequestsRef.current = loadDispatchRequests

  const fetchDismissedDispatchInboxRows = useCallback(async (): Promise<DispatchInboxDismissedRow[]> => {
    if (!authUser?.id || !dispatchInboxEligible) return []
    const dismissalList = await withSupabaseRetry(
      async () =>
        supabase
          .from('dispatch_request_dismissals')
          .select('request_id, dismissed_at')
          .eq('user_id', authUser.id)
          .order('dismissed_at', { ascending: false }),
      'load dispatch_request_dismissals for archive',
    )
    const list = (dismissalList ?? []) as { request_id: string; dismissed_at: string }[]
    if (list.length === 0) return []

    const dismissedAtById = new Map<string, string>()
    const orderedIds: string[] = []
    for (const row of list) {
      if (dismissedAtById.has(row.request_id)) continue
      dismissedAtById.set(row.request_id, row.dismissed_at)
      orderedIds.push(row.request_id)
    }
    const idOrder = new Map(orderedIds.map((id, i) => [id, i]))

    const collected: DispatchInboxRow[] = []
    for (let i = 0; i < orderedIds.length; i += DISMISSED_DISPATCH_ID_CHUNK) {
      const chunk = orderedIds.slice(i, i + DISMISSED_DISPATCH_ID_CHUNK)
      const chunkRows = await withSupabaseRetry(
        async () => supabase.from('dispatch_requests').select(DISPATCH_REQUEST_SELECT).in('id', chunk),
        'load dismissed dispatch_requests chunk',
      )
      collected.push(...((chunkRows ?? []) as DispatchInboxRow[]))
    }

    let merged: DispatchInboxDismissedRow[] = collected.map((r) => ({
      ...r,
      note_count: 0,
      last_note_at: null,
      dismissed_at: dismissedAtById.get(r.id) ?? '',
    }))

    if (orderedIds.length > 0) {
      try {
        const statsRows = await withSupabaseRetry(
          async () =>
            supabase.rpc('dispatch_inbox_note_stats', { p_request_ids: orderedIds }),
          'dispatch inbox note stats dismissed',
        )
        type StatRow = { request_id: string; note_count: number; last_note_at: string | null }
        const statsList = (statsRows ?? []) as StatRow[]
        const byId = new Map(
          statsList.map((s) => [
            s.request_id,
            { note_count: Number(s.note_count), last_note_at: s.last_note_at ?? null },
          ]),
        )
        merged = merged.map((r) => {
          const s = byId.get(r.id)
          return {
            ...r,
            note_count: s?.note_count ?? 0,
            last_note_at: s?.last_note_at ?? null,
          }
        })
      } catch (e) {
        console.error('Dispatch dismissed inbox note stats:', e)
      }
    }

    merged.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0))
    return merged
  }, [authUser?.id, dispatchInboxEligible])

  const loadDispatchNotesForRequest = useCallback(
    async (requestId: string) => {
      setDispatchNotesLoadingRequestId(requestId)
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('dispatch_request_notes')
              .select(
                'id, body, created_at, author:users!dispatch_request_notes_author_user_id_fkey(name)',
              )
              .eq('request_id', requestId)
              .order('created_at', { ascending: true }),
          'load dispatch_request notes',
        )
        const rows = (data as DispatchThreadNoteRow[] | null) ?? []
        setDispatchThreadNotesByRequestId((prev) => ({ ...prev, [requestId]: rows }))
      } catch (e) {
        showToast(formatErrorMessage(e, 'Failed to load dispatch notes'), 'error')
      } finally {
        setDispatchNotesLoadingRequestId(null)
      }
    },
    [showToast],
  )

  useEffect(() => {
    expandedDispatchRequestIdRef.current = expandedDispatchRequestId
  }, [expandedDispatchRequestId])

  useEffect(() => {
    if (!expandedDispatchRequestId) return
    setDispatchNoteDraft('')
    void loadDispatchNotesForRequest(expandedDispatchRequestId)
  }, [expandedDispatchRequestId, loadDispatchNotesForRequest])

  useEffect(() => {
    if (!authUser?.id || !dispatchInboxEligible) {
      setDispatchRequests([])
      return
    }
    loadDispatchRequests()
  }, [authUser?.id, dispatchInboxEligible, loadDispatchRequests])

  const dispatchInboxEnabled = !!authUser?.id && dispatchInboxEligible

  // Same-tab nudge: senders on a page that also hosts the inbox see their request immediately.
  useEffect(() => {
    if (!dispatchInboxEnabled) return
    const handler = () => loadDispatchRequests()
    window.addEventListener(DISPATCH_REQUESTS_CHANGED_EVENT, handler)
    return () => window.removeEventListener(DISPATCH_REQUESTS_CHANGED_EVENT, handler)
  }, [dispatchInboxEnabled, loadDispatchRequests])

  const dispatchRequestsFilters = useMemo(
    () => [{ event: '*' as const, schema: 'public', table: 'dispatch_requests' }],
    [],
  )
  useRealtimeChannel(
    dispatchInboxEnabled,
    'dispatch-inbox-requests',
    dispatchRequestsFilters,
    () => {
      loadDispatchRequests()
    },
    { debounceMs: 400 },
  )

  // See useEstimatorInbox: we drop the per-payload optimization in favour of a
  // simple "if expanded, reload its notes" strategy. Volume is low.
  const dispatchNotesFilters = useMemo(
    () => [{ event: 'INSERT' as const, schema: 'public', table: 'dispatch_request_notes' }],
    [],
  )
  useRealtimeChannel(
    dispatchInboxEnabled,
    'dispatch-inbox-notes',
    dispatchNotesFilters,
    () => {
      const expandedId = expandedDispatchRequestIdRef.current
      if (expandedId) void loadDispatchNotesForRequest(expandedId)
      loadDispatchRequests()
    },
    { debounceMs: 400 },
  )

  function toggleExpandDispatchRequest(requestId: string) {
    setExpandedDispatchRequestId((prev) => (prev === requestId ? null : requestId))
  }

  async function submitDispatchNote(requestId: string) {
    if (!authUser?.id) return
    const body = dispatchNoteDraft.trim()
    if (!body) {
      showToast('Enter a note.', 'error')
      return
    }
    if (body.length > 2000) {
      showToast('Note must be 2000 characters or less.', 'error')
      return
    }

    let wasClosed = false
    const row = dispatchRequests.find((r) => r.id === requestId)
    if (row) {
      wasClosed = row.status === 'closed'
    } else {
      const { data: statusRow, error: statusErr } = await supabase
        .from('dispatch_requests')
        .select('status')
        .eq('id', requestId)
        .maybeSingle()
      if (statusErr) {
        showToast(statusErr.message, 'error')
        return
      }
      wasClosed = statusRow?.status === 'closed'
    }

    setDispatchNoteSubmitRequestId(requestId)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('dispatch_request_notes').insert({
            request_id: requestId,
            author_user_id: authUser.id,
            body,
          }),
        'insert dispatch_request note',
      )

      if (wasClosed) {
        try {
          await withSupabaseRetry(
            async () =>
              supabase
                .from('dispatch_requests')
                .update({
                  status: 'open',
                  closed_at: null,
                  closed_by_user_id: null,
                  closed_note: null,
                })
                .eq('id', requestId),
            'reopen dispatch request',
          )
        } catch (reopenErr) {
          setDispatchNoteDraft('')
          await loadDispatchNotesForRequest(requestId)
          loadDispatchRequests()
          showToast(formatErrorMessage(reopenErr, 'Note saved, but reopen failed.'), 'error')
          return
        }
        // The requester hears about the reopen the same way they hear about a close (v2.2880).
        if (row) {
          void notifyDispatchRequestClosure({
            request: { id: row.id, from_user_id: row.from_user_id, title: row.title },
            note: body,
            mode: 'reopened',
            userId: authUser.id,
            role,
          })
        }
      }

      setDispatchNoteDraft('')
      await loadDispatchNotesForRequest(requestId)
      loadDispatchRequests()
      showToast(wasClosed ? 'Note added and task reopened.' : 'Note added.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to add note'), 'error')
    } finally {
      setDispatchNoteSubmitRequestId(null)
    }
  }

  async function submitDispatchNoteAndClose(requestId: string) {
    if (!authUser?.id) return
    const body = dispatchNoteDraft.trim()
    if (!body) {
      showToast('Enter a note.', 'error')
      return
    }
    if (body.length > 2000) {
      showToast('Note must be 2000 characters or less.', 'error')
      return
    }

    const row = dispatchRequests.find((r) => r.id === requestId)
    if (row?.status === 'closed') {
      showToast('This request is already closed.', 'error')
      return
    }

    setDispatchNoteSubmitRequestId(requestId)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('dispatch_request_notes').insert({
            request_id: requestId,
            author_user_id: authUser.id,
            body,
          }),
        'insert dispatch_request note',
      )

      try {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('dispatch_requests')
              .update({
                status: 'closed',
                closed_at: new Date().toISOString(),
                closed_by_user_id: authUser.id,
                closed_note: body,
              })
              .eq('id', requestId),
          'close dispatch request',
        )
      } catch (closeErr) {
        setDispatchNoteDraft('')
        await loadDispatchNotesForRequest(requestId)
        loadDispatchRequests()
        showToast(formatErrorMessage(closeErr, 'Note saved, but mark closed failed.'), 'error')
        return
      }

      // Tell the tech (v2.2880, journey-map #25): push + notification_history row
      // carrying this note. Fire-and-forget — the close already happened; the
      // helper records `dispatch_request_closed{notified}` when it settles.
      if (row) {
        void notifyDispatchRequestClosure({
          request: { id: row.id, from_user_id: row.from_user_id, title: row.title },
          note: body,
          mode: 'closed',
          userId: authUser.id,
          role,
        })
      }

      setDispatchNoteDraft('')
      await loadDispatchNotesForRequest(requestId)
      loadDispatchRequests()
      showToast('Note added and request marked closed.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to add note'), 'error')
    } finally {
      setDispatchNoteSubmitRequestId(null)
    }
  }

  async function dismissDispatchRequest(requestId: string) {
    if (!authUser?.id) return
    setDispatchRequestDismissingId(requestId)
    const { error } = await supabase.from('dispatch_request_dismissals').insert({
      user_id: authUser.id,
      request_id: requestId,
    })
    setDispatchRequestDismissingId(null)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    setDispatchRequests((prev) => prev.filter((r) => r.id !== requestId))
    setExpandedDispatchRequestId((ex) => (ex === requestId ? null : ex))
  }

  /**
   * Customer Waiting (v2.3247): raise or lower a request's priority. One RPC
   * (`set_request_priority`) writes the row stamp and the thread note in one
   * transaction; RLS decides who may (group member or dev — the closers).
   */
  async function setDispatchRequestPriority(requestId: string, priority: RequestPriority, note: string | null): Promise<boolean> {
    if (!authUser?.id) return false
    setDispatchPrioritySavingId(requestId)
    try {
      const changed = await withSupabaseRetry(
        async () => supabase.rpc('set_request_priority', { p_inbox: 'dispatch', p_request_id: requestId, p_priority: priority, p_note: note ?? undefined }),
        'set dispatch request priority',
      )
      if (!changed) {
        showToast('Nothing changed — the request may already be there.', 'info')
      } else {
        showToast(priority === 'high' ? 'Marked as a customer waiting.' : 'Priority lowered.', 'success')
      }
      if (expandedDispatchRequestIdRef.current === requestId) await loadDispatchNotesForRequest(requestId)
      loadDispatchRequests()
      return !!changed
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not change the priority'), 'error')
      return false
    } finally {
      setDispatchPrioritySavingId(null)
    }
  }

  /** Customer Waiting (v2.3247): Call / Text was used — stamp last_called and drop the 📞 note. Silent on failure. */
  async function logDispatchRequestCall(requestId: string, phoneDisplay: string): Promise<void> {
    if (!authUser?.id) return
    try {
      await withSupabaseRetry(
        async () => supabase.rpc('log_request_call', { p_inbox: 'dispatch', p_request_id: requestId, p_phone: phoneDisplay }),
        'log dispatch request call',
      )
      if (expandedDispatchRequestIdRef.current === requestId) await loadDispatchNotesForRequest(requestId)
      loadDispatchRequests()
    } catch (e) {
      console.warn('log_request_call failed', e)
    }
  }

  return {
    dispatchInboxEligible,
    dispatchRequests,
    dispatchRequestsLoading,
    dispatchRequestsLoaded,
    dispatchBadgeCounts,
    dispatchRequestDismissingId,
    dispatchPrioritySavingId,
    setDispatchRequestPriority,
    logDispatchRequestCall,
    expandedDispatchRequestId,
    dispatchThreadNotesByRequestId,
    dispatchNotesLoadingRequestId,
    dispatchNoteSubmitRequestId,
    dispatchNoteDraft,
    setDispatchNoteDraft,
    toggleExpandDispatchRequest,
    submitDispatchNote,
    submitDispatchNoteAndClose,
    dismissDispatchRequest,
    loadDispatchRequests,
    fetchDismissedDispatchInboxRows,
  }
}
