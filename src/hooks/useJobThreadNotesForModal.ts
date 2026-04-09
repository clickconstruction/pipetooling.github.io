import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { JobThreadNoteRow } from '../components/JobThreadNotesPanel'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

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

const SELECT =
  'id, body, created_at, author:users!jobs_ledger_thread_notes_author_user_id_fkey(name)'

async function queryNotesForJob(jobId: string): Promise<JobThreadNoteRow[]> {
  const data = await withSupabaseRetry(
    async () =>
      await supabase
        .from('jobs_ledger_thread_notes')
        .select(SELECT)
        .eq('job_id', jobId)
        .order('created_at', { ascending: true }),
    'load jobs_ledger_thread_notes modal',
  )
  return (data as JobThreadNoteRow[] | null) ?? []
}

/**
 * Thread notes for a single job while a modal is open (load + realtime INSERT + post).
 * Same RLS and fields as Jobs Stages useJobThreadNotes.
 */
export function useJobThreadNotesForModal(
  jobId: string | null,
  open: boolean,
  opts: { authUserId: string | undefined; showToast: ToastFn; authorDisplayName?: string | null },
) {
  const { authUserId, showToast, authorDisplayName } = opts
  const realtimeChannelId = useId()
  const [notes, setNotes] = useState<JobThreadNoteRow[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const openJobIdRef = useRef<string | null>(null)
  const inFlightThreadNoteRef = useRef<{ optimisticId: string } | null>(null)

  useEffect(() => {
    openJobIdRef.current = open && jobId ? jobId : null
  }, [open, jobId])

  const reloadNotesQuiet = useCallback(async (id: string) => {
    try {
      const rows = await queryNotesForJob(id)
      if (openJobIdRef.current !== id) return
      setNotes((prev) => {
        const flight = inFlightThreadNoteRef.current
        if (flight) {
          const opt = prev.find((n) => n.id === flight.optimisticId)
          if (opt && !rows.some((r) => r.id === opt.id)) {
            return [...rows, opt].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            )
          }
        }
        return rows
      })
    } catch {
      /* optional refresh; avoid toast spam */
    }
  }, [])

  useEffect(() => {
    if (!open || !jobId) {
      inFlightThreadNoteRef.current = null
      setNotes([])
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
        const rows = await queryNotesForJob(jobId)
        if (cancelled) return
        setNotes(rows)
      } catch (e: unknown) {
        if (!cancelled) showToast(formatErrorMessage(e, 'Failed to load job notes'), 'error')
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
          if (jid === jobId) void reloadNotesQuiet(jobId)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [open, jobId, authUserId, realtimeChannelId, reloadNotesQuiet])

  const submitNote = useCallback(async () => {
    const id = openJobIdRef.current
    const body = draft.trim()
    if (!authUserId || !id || !body) return
    const optimistic = makeOptimisticThreadNote(body, authorDisplayName ?? null)
    inFlightThreadNoteRef.current = { optimisticId: optimistic.id }
    setNotes((prev) => [...prev, optimistic])
    setDraft('')
    setSubmitting(true)
    try {
      const inserted = await withSupabaseRetry(
        async () =>
          await supabase
            .from('jobs_ledger_thread_notes')
            .insert({
              job_id: id,
              author_user_id: authUserId,
              body,
            })
            .select(SELECT)
            .single(),
        'insert jobs_ledger_thread_note modal',
      )
      if (inserted == null) throw new Error('No note row returned')
      const row = inserted as unknown as JobThreadNoteRow
      setNotes((prev) => {
        const idx = prev.findIndex((n) => n.id === optimistic.id)
        if (idx < 0) return [...prev, row]
        const next = [...prev]
        next[idx] = row
        return next
      })
      inFlightThreadNoteRef.current = null
    } catch (e: unknown) {
      inFlightThreadNoteRef.current = null
      setNotes((prev) => prev.filter((n) => n.id !== optimistic.id))
      setDraft(body)
      showToast(formatErrorMessage(e, 'Failed to post note'), 'error')
    } finally {
      setSubmitting(false)
    }
  }, [authUserId, authorDisplayName, draft, showToast])

  const canPost = Boolean(authUserId)

  return { notes, loading, draft, setDraft, submitting, submitNote, canPost }
}
