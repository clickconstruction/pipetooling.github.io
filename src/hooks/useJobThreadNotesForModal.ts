import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
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
import { fetchJobStatusEventsForJobLedger } from '../lib/fetchJobStatusEventsForJobLedger'
import { statusEventsToActivityItems } from '../lib/jobThreadStatusEventActivity'
import { fetchJobPaymentsForJobLedger } from '../lib/fetchJobPaymentsForJobLedger'
import { paymentsToActivityItems } from '../lib/jobThreadPaymentActivity'
import { fetchJobInvoicesForActivity } from '../lib/fetchJobInvoicesForActivity'
import { invoicesToActivityItems } from '../lib/jobThreadInvoiceActivity'
import { fetchJobStripeEmailSendsForJobLedger } from '../lib/fetchJobStripeEmailSendsForJobLedger'
import { stripeEmailSendsToActivityItems } from '../lib/jobThreadInvoiceEmailActivity'
import { fetchJobTeamMembersForJobLedger } from '../lib/fetchJobTeamMembersForJobLedger'
import { teamMembersToActivityItems } from '../lib/jobThreadCrewActivity'
import { sortJobThreadActivity } from '../lib/jobThreadActivitySort'

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
  scheduleBlockRows: JobScheduleBlockWithAssigneeName[],
  clockRows: JobDetailClockSessionRow[],
  eventItems: JobThreadEventActivityItem[],
): JobThreadActivityItem[] {
  const scheduleItems = scheduleBlocksToScheduleActivityItems(scheduleBlockRows)
  const clockItems = clockSessionsToActivityItems(clockRows)
  const noteItems: JobThreadActivityItem[] = noteRows.map((n) => ({ kind: 'note' as const, note: n }))
  return sortJobThreadActivity([...noteItems, ...scheduleItems, ...clockItems, ...eventItems])
}

/** Fetch + map all Phase-1 ledger event sources for one job (RLS-gated; per-source errors → []). */
async function fetchJobEventItems(jobId: string): Promise<JobThreadEventActivityItem[]> {
  const [statusPack, paymentsPack, invoicesPack, emailPack, crewPack] = await Promise.all([
    fetchJobStatusEventsForJobLedger(jobId),
    fetchJobPaymentsForJobLedger(jobId),
    fetchJobInvoicesForActivity(jobId),
    fetchJobStripeEmailSendsForJobLedger(jobId),
    fetchJobTeamMembersForJobLedger(jobId),
  ])
  return [
    ...statusEventsToActivityItems(statusPack.error ? [] : statusPack.data),
    ...paymentsToActivityItems(paymentsPack.error ? [] : paymentsPack.data),
    ...invoicesToActivityItems(invoicesPack.error ? [] : invoicesPack.data),
    ...stripeEmailSendsToActivityItems(emailPack.error ? [] : emailPack.data),
    ...teamMembersToActivityItems(crewPack.error ? [] : crewPack.data),
  ]
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
  opts: { authUserId: string | undefined; showToast: ToastFn; authorDisplayName?: string | null },
) {
  const { authUserId, showToast, authorDisplayName } = opts
  const realtimeChannelId = useId()
  const [activity, setActivity] = useState<JobThreadActivityItem[]>([])
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
      const [rows, blocksPack, clockPack, eventItems] = await Promise.all([
        queryNotesForJob(id),
        fetchJobScheduleBlocksForJob(id),
        fetchClockSessionsForJobLedger(id),
        fetchJobEventItems(id),
      ])
      if (openJobIdRef.current !== id) return
      const scheduleRows = blocksPack.error ? [] : blocksPack.data
      const clockRows = clockPack.error ? [] : clockPack.data
      setActivity((prev) => {
        const flight = inFlightThreadNoteRef.current
        let combined = mergeNotesAndScheduleIntoActivity(rows, scheduleRows, clockRows, eventItems)
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
        const [rows, blocksPack, clockPack, eventItems] = await Promise.all([
          queryNotesForJob(jobId),
          fetchJobScheduleBlocksForJob(jobId),
          fetchClockSessionsForJobLedger(jobId),
          fetchJobEventItems(jobId),
        ])
        if (cancelled) return
        const scheduleRows = blocksPack.error ? [] : blocksPack.data
        const clockRows = clockPack.error ? [] : clockPack.data
        setActivity(mergeNotesAndScheduleIntoActivity(rows, scheduleRows, clockRows, eventItems))
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
        { event: '*', schema: 'public', table: 'job_status_events' },
        (payload) => {
          const jid =
            (payload.new as { job_id?: string | null } | null)?.job_id ??
            (payload.old as { job_id?: string | null } | null)?.job_id
          if (jid === jobId) void reloadActivityQuiet(jobId)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs_ledger_payments' },
        (payload) => {
          const jid =
            (payload.new as { job_id?: string | null } | null)?.job_id ??
            (payload.old as { job_id?: string | null } | null)?.job_id
          if (jid === jobId) void reloadActivityQuiet(jobId)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs_ledger_invoices' },
        (payload) => {
          const jid =
            (payload.new as { job_id?: string | null } | null)?.job_id ??
            (payload.old as { job_id?: string | null } | null)?.job_id
          if (jid === jobId) void reloadActivityQuiet(jobId)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs_ledger_team_members' },
        (payload) => {
          const jid =
            (payload.new as { job_id?: string | null } | null)?.job_id ??
            (payload.old as { job_id?: string | null } | null)?.job_id
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
        const inserted = await withSupabaseRetry(
          async () =>
            await supabase
              .from('jobs_ledger_thread_notes')
              .insert({
                job_id: id,
                author_user_id: authUserId,
                body: trimmed,
              })
              .select(SELECT)
              .single(),
          'insert jobs_ledger_thread_note modal',
        )
        if (inserted == null) throw new Error('No note row returned')
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
    [authUserId, authorDisplayName, showToast],
  )

  const submitNote = useCallback(async () => {
    const body = draft.trim()
    if (!body) return
    await submitNoteWithBody(body, 'draft')
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

  return { activity, loading, draft, setDraft, submitting, submitNote, submitStamp, canPost }
}
