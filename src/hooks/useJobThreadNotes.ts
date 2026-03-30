import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { JobThreadNoteRow } from '../components/JobThreadNotesPanel'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

type ToastFn = (message: string, type: 'success' | 'info' | 'warning' | 'error') => void

export type JobThreadNoteStats = {
  note_count: number
  last_note_at: string | null
  last_note_body: string | null
  last_note_author_name: string | null
}

function rpcNum(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isNaN(n) ? 0 : n
  }
  return 0
}

function rpcStr(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v
  return String(v)
}

/** Normalize PostgREST / RPC row (snake_case; tolerate camelCase or string bigints). */
function statsFromRpcRow(r: unknown): JobThreadNoteStats {
  if (r == null || typeof r !== 'object') {
    return { note_count: 0, last_note_at: null, last_note_body: null, last_note_author_name: null }
  }
  const o = r as Record<string, unknown>
  return {
    note_count: rpcNum(o.note_count ?? o.noteCount),
    last_note_at: rpcStr(o.last_note_at ?? o.lastNoteAt),
    last_note_body: rpcStr(o.last_note_body ?? o.lastNoteBody),
    last_note_author_name: rpcStr(o.last_note_author_name ?? o.lastNoteAuthorName),
  }
}

function rpcRowJobId(r: unknown): string | null {
  if (r == null || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  const id = o.job_id ?? o.jobId
  return typeof id === 'string' && id.length > 0 ? id : null
}

export function useJobThreadNotes(showToast: ToastFn, authUserId: string | undefined) {
  const realtimeChannelId = useId()
  const [expandedJobThreadId, setExpandedJobThreadId] = useState<string | null>(null)
  const [jobThreadNotesByJobId, setJobThreadNotesByJobId] = useState<Record<string, JobThreadNoteRow[]>>({})
  const [jobThreadNotesLoadingId, setJobThreadNotesLoadingId] = useState<string | null>(null)
  const [jobThreadSubmittingId, setJobThreadSubmittingId] = useState<string | null>(null)
  const [jobThreadDraft, setJobThreadDraft] = useState('')
  const [jobThreadStatsByJobId, setJobThreadStatsByJobId] = useState<Record<string, JobThreadNoteStats>>({})
  const expandedJobThreadIdRef = useRef<string | null>(null)

  const loadJobThreadNotesForJob = useCallback(
    async (jobId: string) => {
      setJobThreadNotesLoadingId(jobId)
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('jobs_ledger_thread_notes')
              .select(
                'id, body, created_at, author:users!jobs_ledger_thread_notes_author_user_id_fkey(name)',
              )
              .eq('job_id', jobId)
              .order('created_at', { ascending: true }),
          'load jobs_ledger_thread_notes',
        )
        const rows = (data as JobThreadNoteRow[] | null) ?? []
        setJobThreadNotesByJobId((prev) => ({ ...prev, [jobId]: rows }))
        const last = rows[rows.length - 1]
        if (last?.body?.trim()) {
          setJobThreadStatsByJobId((prev) => {
            const cur = prev[jobId]
            if (!cur || (cur.last_note_body ?? '').trim()) return prev
            return {
              ...prev,
              [jobId]: {
                ...cur,
                last_note_body: last.body,
                last_note_author_name: last.author?.name?.trim() ?? cur.last_note_author_name,
              },
            }
          })
        }
      } catch (e: unknown) {
        showToast(formatErrorMessage(e, 'Failed to load job notes'), 'error')
      } finally {
        setJobThreadNotesLoadingId(null)
      }
    },
    [showToast],
  )

  const mergeJobThreadStatsForJobIds = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    try {
      const data = await withSupabaseRetry(
        async () => supabase.rpc('jobs_ledger_thread_note_stats', { p_job_ids: ids }),
        'jobs_ledger_thread_note_stats merge',
      )
      const rows = (data as unknown[] | null) ?? []
      setJobThreadStatsByJobId((prev) => {
        const next = { ...prev }
        for (const r of rows) {
          const id = rpcRowJobId(r)
          if (id) next[id] = statsFromRpcRow(r)
        }
        return next
      })
    } catch {
      /* leave prior stats */
    }
  }, [])

  const refreshJobThreadStatsForJobIds = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) {
        setJobThreadStatsByJobId({})
        return
      }
      try {
        const data = await withSupabaseRetry(
          async () => supabase.rpc('jobs_ledger_thread_note_stats', { p_job_ids: ids }),
          'jobs_ledger_thread_note_stats batch',
        )
        const rows = (data as unknown[] | null) ?? []
        const next: Record<string, JobThreadNoteStats> = {}
        for (const r of rows) {
          const id = rpcRowJobId(r)
          if (id) next[id] = statsFromRpcRow(r)
        }
        setJobThreadStatsByJobId(next)
      } catch {
        setJobThreadStatsByJobId({})
      }
    },
    [],
  )

  useEffect(() => {
    expandedJobThreadIdRef.current = expandedJobThreadId
  }, [expandedJobThreadId])

  useEffect(() => {
    if (!expandedJobThreadId) return
    setJobThreadDraft('')
    void loadJobThreadNotesForJob(expandedJobThreadId)
  }, [expandedJobThreadId, loadJobThreadNotesForJob])

  useEffect(() => {
    if (!authUserId) return
    const channel = supabase
      .channel(`jobs-ledger-thread-notes-${realtimeChannelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'jobs_ledger_thread_notes' },
        (payload) => {
          const jid = (payload.new as { job_id?: string } | null)?.job_id
          if (jid && expandedJobThreadIdRef.current === jid) {
            void loadJobThreadNotesForJob(jid)
          }
          if (jid) {
            void mergeJobThreadStatsForJobIds([jid])
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [authUserId, loadJobThreadNotesForJob, mergeJobThreadStatsForJobIds, realtimeChannelId])

  const submitJobThreadNote = useCallback(
    async (jobId: string) => {
      const body = jobThreadDraft.trim()
      if (!authUserId || !body) return
      setJobThreadSubmittingId(jobId)
      try {
        await withSupabaseRetry(
          async () =>
            supabase.from('jobs_ledger_thread_notes').insert({
              job_id: jobId,
              author_user_id: authUserId,
              body,
            }),
          'insert jobs_ledger_thread_note',
        )
        setJobThreadDraft('')
        await loadJobThreadNotesForJob(jobId)
        const stats = await withSupabaseRetry(
          async () => supabase.rpc('jobs_ledger_thread_note_stats', { p_job_ids: [jobId] }),
          'jobs_ledger_thread_note_stats after insert',
        )
        const row = (stats as unknown[] | null)?.[0]
        if (row) {
          setJobThreadStatsByJobId((prev) => ({
            ...prev,
            [jobId]: statsFromRpcRow(row),
          }))
        }
      } catch (e: unknown) {
        showToast(formatErrorMessage(e, 'Failed to post note'), 'error')
      } finally {
        setJobThreadSubmittingId(null)
      }
    },
    [authUserId, jobThreadDraft, loadJobThreadNotesForJob, showToast],
  )

  return {
    expandedJobThreadId,
    setExpandedJobThreadId,
    jobThreadNotesByJobId,
    jobThreadNotesLoadingId,
    jobThreadSubmittingId,
    jobThreadDraft,
    setJobThreadDraft,
    loadJobThreadNotesForJob,
    submitJobThreadNote,
    jobThreadStatsByJobId,
    refreshJobThreadStatsForJobIds,
  }
}
