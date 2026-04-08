import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { JobThreadNoteRow } from '../components/JobThreadNotesPanel'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

type ToastFn = (message: string, type: 'success' | 'info' | 'warning' | 'error') => void

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
  opts: { authUserId: string | undefined; showToast: ToastFn },
) {
  const { authUserId, showToast } = opts
  const realtimeChannelId = useId()
  const [notes, setNotes] = useState<JobThreadNoteRow[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const openJobIdRef = useRef<string | null>(null)

  useEffect(() => {
    openJobIdRef.current = open && jobId ? jobId : null
  }, [open, jobId])

  const reloadNotesQuiet = useCallback(async (id: string) => {
    try {
      const rows = await queryNotesForJob(id)
      if (openJobIdRef.current !== id) return
      setNotes(rows)
    } catch {
      /* optional refresh; avoid toast spam */
    }
  }, [])

  useEffect(() => {
    if (!open || !jobId) {
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
    setSubmitting(true)
    try {
      await withSupabaseRetry(
        async () =>
          await supabase.from('jobs_ledger_thread_notes').insert({
            job_id: id,
            author_user_id: authUserId,
            body,
          }),
        'insert jobs_ledger_thread_note modal',
      )
      setDraft('')
      await reloadNotesQuiet(id)
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'Failed to post note'), 'error')
    } finally {
      setSubmitting(false)
    }
  }, [authUserId, draft, reloadNotesQuiet, showToast])

  const canPost = Boolean(authUserId)

  return { notes, loading, draft, setDraft, submitting, submitNote, canPost }
}
