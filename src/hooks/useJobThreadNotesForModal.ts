import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { pressThroughOutbox } from '../lib/offline/pressThroughOutbox'
import { KEPT_ON_PHONE_WORDS } from '../lib/offline/pendingSession'
import { OUTBOX_LANDED_EVENT, type OutboxLandedDetail } from './useOutboxReplay'
import type { JobThreadActivityItem, JobThreadNoteRow } from '../components/JobThreadNotesPanel'
import { appendToastRefreshHint, formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { buildJobThreadStampBody, type JobThreadStampKind } from '../lib/jobThreadNoteStampBody'
import { fetchJobScheduleBlocksForJob, type JobScheduleBlockWithAssigneeName } from '../lib/jobScheduleBlocks'
import { scheduleBlocksToScheduleActivityItems } from '../lib/jobThreadScheduleActivity'
import {
  fetchClockSessionsForJobLedger,
  type JobDetailClockSessionRow,
} from '../lib/fetchClockSessionsForJobLedger'
import { clockSessionsToActivityItems } from '../lib/jobThreadClockActivity'
import type { JobThreadEventActivityItem } from '../lib/jobActivityEvent'
import { fetchJobActivityEventsForJobLedger } from '../lib/fetchJobActivityEventsForJobLedger'
import { jobActivityEventsFromRpc } from '../lib/jobActivityEventsFromRpc'
import { sortJobThreadActivity } from '../lib/jobThreadActivitySort'
import {
  reportForViewFromJobLedgerRow,
  type ReportForJobLedgerRow,
} from '../lib/reportForViewFromJobLedgerRow'

export type { JobThreadStampKind } from '../lib/jobThreadNoteStampBody'

type ToastFn = (message: string, type: 'success' | 'info' | 'warning' | 'error') => void

const OPTIMISTIC_JOB_THREAD_NOTE_PREFIX = '__optimistic__:'

function makeOptimisticThreadNote(body: string, authorDisplayName: string | null | undefined): JobThreadNoteRow {
  return {
    id: `${OPTIMISTIC_JOB_THREAD_NOTE_PREFIX}${crypto.randomUUID()}`,
    body,
    created_at: new Date().toISOString(),
    author: { name: authorDisplayName?.trim() ? authorDisplayName.trim() : null },
  }
}

function mergeNotesAndScheduleIntoActivity(
  noteRows: JobThreadNoteRow[],
  reportRows: ReportForJobLedgerRow[],
  scheduleBlockRows: JobScheduleBlockWithAssigneeName[],
  clockRows: JobDetailClockSessionRow[],
  eventItems: JobThreadEventActivityItem[],
): JobThreadActivityItem[] {
  const scheduleItems = scheduleBlocksToScheduleActivityItems(scheduleBlockRows)
  const clockItems = clockSessionsToActivityItems(clockRows)
  const noteItems: JobThreadActivityItem[] = noteRows.map((n) => ({ kind: 'note' as const, note: n }))
  const reportItems: JobThreadActivityItem[] = reportRows.map((r) => ({
    kind: 'report' as const,
    report: reportForViewFromJobLedgerRow(r),
  }))
  return sortJobThreadActivity([...noteItems, ...reportItems, ...scheduleItems, ...clockItems, ...eventItems])
}

/** Field reports for the job (same role-aware RPC the Stages thread uses; errors → []). */
async function queryReportsForJob(jobId: string): Promise<ReportForJobLedgerRow[]> {
  try {
    const data = await withSupabaseRetry(
      async () => supabase.rpc('list_reports_for_job_ledger', { p_job_id: jobId }),
      'list_reports_for_job_ledger modal',
    )
    return (data as ReportForJobLedgerRow[] | null) ?? []
  } catch {
    return []
  }
}

/** Fetch + map the job activity ledger for one job (single role-aware RPC; errors → []). */
async function fetchJobEventItems(jobId: string): Promise<JobThreadEventActivityItem[]> {
  const pack = await fetchJobActivityEventsForJobLedger(jobId)
  return jobActivityEventsFromRpc(pack.error ? [] : pack.data)
}

const SELECT =
  'id, body, created_at, author:users!jobs_ledger_thread_notes_author_user_id_fkey(name)'

async function queryNotesForJob(jobId: string): Promise<JobThreadNoteRow[]> {
  const data = await withSupabaseRetry(
    async () =>
      await supabase
        .from('jobs_ledger_thread_notes')
        .select(SELECT)
        .eq('job_id', jobId)
        .order('created_at', {
          ascending: true,
        }),
    'load jobs_ledger_thread_notes modal',
  )
  return (data as JobThreadNoteRow[] | null) ?? []
}

/**
 * Thread notes + dispatch schedule notes for a single job while a modal is open (load + realtime + post).
 */
export function useJobThreadNotesForModal(
  jobId: string | null,
  open: boolean,
  opts: { authUserId: string | undefined; showToast: ToastFn; authorDisplayName?: string | null; /** What a queued note is about, for the outbox's list (punch list #163 PR 3): the job's label. */ about?: string },
) {
  const { authUserId, showToast, authorDisplayName, about } = opts
  const realtimeChannelId = useId()
  const [activity, setActivity] = useState<JobThreadActivityItem[]>([])
  /** Who is assigned to the job's schedule blocks (punch list #30, PR 2b: the crew gate on Arrived / Leaving). */
  const [scheduleAssigneeIds, setScheduleAssigneeIds] = useState<ReadonlySet<string>>(() => new Set())
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const openJobIdRef = useRef<string | null>(null)
  const inFlightThreadNoteRef = useRef<{ optimisticId: string } | null>(null)

  useEffect(() => {
    openJobIdRef.current = open && jobId ? jobId : null
  }, [open, jobId])

  const reloadActivityQuiet = useCallback(async (id: string) => {
    try {
      const [rows, reportRows, blocksPack, clockPack, eventItems] = await Promise.all([
        queryNotesForJob(id),
        queryReportsForJob(id),
        fetchJobScheduleBlocksForJob(id),
        fetchClockSessionsForJobLedger(id),
        fetchJobEventItems(id),
      ])
      if (openJobIdRef.current !== id) return
      const scheduleRows = blocksPack.error ? [] : blocksPack.data
      const clockRows = clockPack.error ? [] : clockPack.data
      setScheduleAssigneeIds(new Set(scheduleRows.map((r) => r.assignee_user_id).filter((id): id is string => !!id)))
      setActivity((prev) => {
        const flight = inFlightThreadNoteRef.current
        let combined = mergeNotesAndScheduleIntoActivity(rows, reportRows, scheduleRows, clockRows, eventItems)
        if (flight) {
          const opt = prev.find((i) => i.kind === 'note' && i.note.id === flight.optimisticId)
          if (opt && opt.kind === 'note' && !rows.some((r) => r.id === opt.note.id)) {
            combined = sortJobThreadActivity([...combined, opt])
          }
        }
        return combined
      })
    } catch {
      /* optional refresh; avoid toast spam */
    }
  }, [])

  useEffect(() => {
    if (!open || !jobId) {
      inFlightThreadNoteRef.current = null
      setActivity([])
      setDraft('')
      setLoading(false)
      setSubmitting(false)
      return
    }

    let cancelled = false
    setDraft('')
    setLoading(true)
    ;(async () => {
      try {
        const [rows, reportRows, blocksPack, clockPack, eventItems] = await Promise.all([
          queryNotesForJob(jobId),
          queryReportsForJob(jobId),
          fetchJobScheduleBlocksForJob(jobId),
          fetchClockSessionsForJobLedger(jobId),
          fetchJobEventItems(jobId),
        ])
        if (cancelled) return
        const scheduleRows = blocksPack.error ? [] : blocksPack.data
        const clockRows = clockPack.error ? [] : clockPack.data
        setScheduleAssigneeIds(new Set(scheduleRows.map((r) => r.assignee_user_id).filter((id): id is string => !!id)))
        setActivity(mergeNotesAndScheduleIntoActivity(rows, reportRows, scheduleRows, clockRows, eventItems))
      } catch (e: unknown) {
        if (!cancelled)
          showToast(appendToastRefreshHint(formatErrorMessage(e, 'Failed to load job notes')), 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, jobId, showToast])

  useEffect(() => {
    if (!open || !jobId || !authUserId) return

    const channel = supabase
      .channel(`jobs-ledger-thread-notes-modal-${realtimeChannelId}-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'jobs_ledger_thread_notes' },
        (payload) => {
          const jid = (payload.new as { job_id?: string } | null)?.job_id
          if (jid === jobId) void reloadActivityQuiet(jobId)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_schedule_blocks' },
        (payload) => {
          const jid =
            (payload.new as { job_id?: string } | null)?.job_id ??
            (payload.old as { job_id?: string } | null)?.job_id
          if (jid === jobId) void reloadActivityQuiet(jobId)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clock_sessions' },
        (payload) => {
          const jid =
            (payload.new as { job_ledger_id?: string | null } | null)?.job_ledger_id ??
            (payload.old as { job_ledger_id?: string | null } | null)?.job_ledger_id
          if (jid === jobId) void reloadActivityQuiet(jobId)
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_activity_events' },
        (payload) => {
          const jid = (payload.new as { job_id?: string | null } | null)?.job_id
          if (jid === jobId) void reloadActivityQuiet(jobId)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [open, jobId, authUserId, realtimeChannelId, reloadActivityQuiet])

  const submitNoteWithBody = useCallback(
    async (body: string, source: 'draft' | 'stamp'): Promise<boolean> => {
      const id = openJobIdRef.current
      const trimmed = body.trim()
      if (!authUserId || !id || !trimmed) return false
      const optimistic = makeOptimisticThreadNote(trimmed, authorDisplayName ?? null)
      inFlightThreadNoteRef.current = { optimisticId: optimistic.id }
      const optimisticItem: JobThreadActivityItem = { kind: 'note', note: optimistic }
      setActivity((prev) => sortJobThreadActivity([...prev, optimisticItem]))
      if (source === 'draft') {
        setDraft('')
      }
      setSubmitting(true)
      try {
        // Through the outbox (punch list #163 PR 3): sent at once when it can be, kept on the phone when it cannot.
        const outcome = await pressThroughOutbox({
          kind: 'job-note',
          userId: authUserId,
          pressedAt: Date.now(),
          payload: { jobId: id, body: trimmed },
          about: about ?? '',
          door: '/dashboard',
        })
        if (outcome.kind === 'refused') throw new Error(outcome.message)
        if (outcome.kind === 'failed') throw outcome.error
        if (outcome.kind === 'queued') {
          // The optimistic row stays as the note on the thread until the press lands and the thread is read again.
          inFlightThreadNoteRef.current = null
          showToast(KEPT_ON_PHONE_WORDS, 'success')
          return true
        }
        const noteId = (outcome.result as { note_id?: string } | null)?.note_id
        if (!noteId) throw new Error('No note row returned')
        const inserted = await withSupabaseRetry(
          async () => await supabase.from('jobs_ledger_thread_notes').select(SELECT).eq('id', noteId).single(),
          'read jobs_ledger_thread_note modal',
        )
        const row = inserted as unknown as JobThreadNoteRow
        setActivity((prev) => {
          const idx = prev.findIndex((i) => i.kind === 'note' && i.note.id === optimistic.id)
          if (idx < 0) return sortJobThreadActivity([...prev, { kind: 'note', note: row }])
          const next = [...prev]
          next[idx] = { kind: 'note', note: row }
          return sortJobThreadActivity(next)
        })
        inFlightThreadNoteRef.current = null
        return true
      } catch (e: unknown) {
        inFlightThreadNoteRef.current = null
        setActivity((prev) => prev.filter((i) => !(i.kind === 'note' && i.note.id === optimistic.id)))
        if (source === 'draft') {
          setDraft(trimmed)
        }
        showToast(formatErrorMessage(e, 'Failed to post note'), 'error')
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [authUserId, authorDisplayName, showToast, about],
  )

  // A note that waited on the phone landed (punch list #163 PR 3): the thread reads again, and the optimistic row gives way.
  useEffect(() => {
    if (!open || !jobId || typeof window === 'undefined') return
    const onLanded = (e: Event) => {
      const detail = (e as CustomEvent<OutboxLandedDetail>).detail
      if (detail?.kind === 'job-note' && openJobIdRef.current === jobId) void reloadActivityQuiet(jobId)
    }
    window.addEventListener(OUTBOX_LANDED_EVENT, onLanded)
    return () => window.removeEventListener(OUTBOX_LANDED_EVENT, onLanded)
  }, [open, jobId, reloadActivityQuiet])

  /** Post the draft; true once the note is on the thread (the Note sheet closes on it, punch list #189 PR 4). */
  const submitNote = useCallback(async (): Promise<boolean> => {
    const body = draft.trim()
    if (!body) return false
    return submitNoteWithBody(body, 'draft')
  }, [draft, submitNoteWithBody])

  const submitStamp = useCallback(
    async (kind: JobThreadStampKind): Promise<boolean> => {
      if (!authUserId) return false
      const body = buildJobThreadStampBody(authorDisplayName ?? null, kind, new Date())
      return submitNoteWithBody(body, 'stamp')
    },
    [authUserId, authorDisplayName, submitNoteWithBody],
  )

  const canPost = Boolean(authUserId)

  /** Silent re-fetch of the activity feed (e.g. after a lifecycle write like a completeness mark). */
  const reload = useCallback(() => {
    const id = openJobIdRef.current
    if (id) void reloadActivityQuiet(id)
  }, [reloadActivityQuiet])

  return { activity, loading, draft, setDraft, submitting, submitNote, submitNoteWithBody, submitStamp, canPost, reload, scheduleAssigneeIds }
}
