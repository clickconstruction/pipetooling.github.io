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

const OPTIMISTIC_JOB_THREAD_NOTE_PREFIX = '__optimistic__:'

function makeOptimisticThreadNote(body: string, authorDisplayName: string | null | undefined): JobThreadNoteRow {
  return {
    id: `${OPTIMISTIC_JOB_THREAD_NOTE_PREFIX}${crypto.randomUUID()}`,
    body,
    created_at: new Date().toISOString(),
    author: { name: authorDisplayName?.trim() ? authorDisplayName.trim() : null },
  }
}

const THREAD_NOTE_SELECT =
  'id, body, created_at, author:users!jobs_ledger_thread_notes_author_user_id_fkey(name)' as const

/** Avoid oversized uuid[] payloads to jobs_ledger_thread_note_stats in one RPC. */
const THREAD_STATS_JOB_IDS_CHUNK = 200

export function useJobThreadNotes(
  showToast: ToastFn,
  authUserId: string | undefined,
  authorDisplayName?: string | null,
) {
  const realtimeChannelId = useId()
  const [expandedJobThreadId, setExpandedJobThreadId] = useState<string | null>(null)
  const [jobThreadNotesByJobId, setJobThreadNotesByJobId] = useState<Record<string, JobThreadNoteRow[]>>({})
  const [jobThreadNotesLoadingId, setJobThreadNotesLoadingId] = useState<string | null>(null)
  const [jobThreadSubmittingId, setJobThreadSubmittingId] = useState<string | null>(null)
  const [jobThreadDraft, setJobThreadDraft] = useState('')
  const [jobThreadStatsByJobId, setJobThreadStatsByJobId] = useState<Record<string, JobThreadNoteStats>>({})
  const expandedJobThreadIdRef = useRef<string | null>(null)
  /** While posting, quiet reloads may run before the server row exists; keep optimistic row visible. */
  const inFlightThreadNoteRef = useRef<{ jobId: string; optimisticId: string } | null>(null)
  /** Bumped on each full refresh so overlapping refreshes (e.g. Stages search keystrokes) abandon in-flight RPCs. */
  const threadStatsRefreshGenRef = useRef(0)

  const loadJobThreadNotesForJob = useCallback(
    async (jobId: string, opts?: { quiet?: boolean }) => {
      const quiet = opts?.quiet === true
      if (!quiet) setJobThreadNotesLoadingId(jobId)
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase.from('jobs_ledger_thread_notes').select(THREAD_NOTE_SELECT).eq('job_id', jobId).order('created_at', {
              ascending: true,
            }),
          'load jobs_ledger_thread_notes',
        )
        const rowsRaw = (data as JobThreadNoteRow[] | null) ?? []
        setJobThreadNotesByJobId((prev) => {
          const merged = (() => {
            const flight = inFlightThreadNoteRef.current
            if (quiet && flight?.jobId === jobId) {
              const opt = (prev[jobId] ?? []).find((n) => n.id === flight.optimisticId)
              if (opt && !rowsRaw.some((r) => r.id === opt.id)) {
                return [...rowsRaw, opt].sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                )
              }
            }
            return rowsRaw
          })()
          const last = merged[merged.length - 1]
          if (last?.body?.trim()) {
            setJobThreadStatsByJobId((sprev) => {
              const cur = sprev[jobId]
              if (!cur || (cur.last_note_body ?? '').trim()) return sprev
              return {
                ...sprev,
                [jobId]: {
                  ...cur,
                  last_note_body: last.body,
                  last_note_author_name: last.author?.name?.trim() ?? cur.last_note_author_name,
                },
              }
            })
          }
          return { ...prev, [jobId]: merged }
        })
      } catch (e: unknown) {
        showToast(formatErrorMessage(e, 'Failed to load job notes'), 'error')
      } finally {
        if (!quiet) setJobThreadNotesLoadingId(null)
      }
    },
    [showToast],
  )

  const mergeJobThreadStatsForJobIds = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    try {
      const data = await withSupabaseRetry(
        () => supabase.rpc('jobs_ledger_thread_note_stats', { p_job_ids: ids }),
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

  const refreshJobThreadStatsForJobIds = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      threadStatsRefreshGenRef.current += 1
      setJobThreadStatsByJobId({})
      return
    }
    const gen = ++threadStatsRefreshGenRef.current
    try {
      const next: Record<string, JobThreadNoteStats> = {}
      for (let i = 0; i < ids.length; i += THREAD_STATS_JOB_IDS_CHUNK) {
        if (threadStatsRefreshGenRef.current !== gen) return
        const slice = ids.slice(i, i + THREAD_STATS_JOB_IDS_CHUNK)
        const data = await withSupabaseRetry(
          () => supabase.rpc('jobs_ledger_thread_note_stats', { p_job_ids: slice }),
          'jobs_ledger_thread_note_stats batch',
        )
        if (threadStatsRefreshGenRef.current !== gen) return
        const rows = (data as unknown[] | null) ?? []
        for (const r of rows) {
          const id = rpcRowJobId(r)
          if (id) next[id] = statsFromRpcRow(r)
        }
      }
      if (threadStatsRefreshGenRef.current !== gen) return
      setJobThreadStatsByJobId(next)
    } catch {
      if (threadStatsRefreshGenRef.current !== gen) return
      // Keep prior stats on timeout / failure so Stages does not flash empty after heavy loadJobs.
    }
  }, [])

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
            void loadJobThreadNotesForJob(jid, { quiet: true })
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
      const optimistic = makeOptimisticThreadNote(body, authorDisplayName ?? null)
      inFlightThreadNoteRef.current = { jobId, optimisticId: optimistic.id }
      setJobThreadNotesByJobId((prev) => ({
        ...prev,
        [jobId]: [...(prev[jobId] ?? []), optimistic],
      }))
      setJobThreadStatsByJobId((prev) => {
        const cur = prev[jobId]
        return {
          ...prev,
          [jobId]: {
            note_count: (cur?.note_count ?? 0) + 1,
            last_note_at: optimistic.created_at,
            last_note_body: body,
            last_note_author_name:
              optimistic.author?.name?.trim() ?? cur?.last_note_author_name ?? null,
          },
        }
      })
      setJobThreadDraft('')
      setJobThreadSubmittingId(jobId)
      try {
        const inserted = await withSupabaseRetry(
          async () =>
            supabase
              .from('jobs_ledger_thread_notes')
              .insert({
                job_id: jobId,
                author_user_id: authUserId,
                body,
              })
              .select(THREAD_NOTE_SELECT)
              .single(),
          'insert jobs_ledger_thread_note',
        )
        if (inserted == null) throw new Error('No note row returned')
        const row = inserted as unknown as JobThreadNoteRow
        setJobThreadNotesByJobId((prev) => {
          const list = prev[jobId] ?? []
          const idx = list.findIndex((n) => n.id === optimistic.id)
          if (idx < 0) return { ...prev, [jobId]: [...list, row] }
          const next = [...list]
          next[idx] = row
          return { ...prev, [jobId]: next }
        })
        inFlightThreadNoteRef.current = null
        const stats = await withSupabaseRetry(
          () => supabase.rpc('jobs_ledger_thread_note_stats', { p_job_ids: [jobId] }),
          'jobs_ledger_thread_note_stats after insert',
        )
        const statRow = (stats as unknown[] | null)?.[0]
        if (statRow) {
          setJobThreadStatsByJobId((prev) => ({
            ...prev,
            [jobId]: statsFromRpcRow(statRow),
          }))
        }
      } catch (e: unknown) {
        inFlightThreadNoteRef.current = null
        setJobThreadNotesByJobId((prev) => ({
          ...prev,
          [jobId]: (prev[jobId] ?? []).filter((n) => n.id !== optimistic.id),
        }))
        void mergeJobThreadStatsForJobIds([jobId])
        setJobThreadDraft(body)
        showToast(formatErrorMessage(e, 'Failed to post note'), 'error')
      } finally {
        setJobThreadSubmittingId(null)
      }
    },
    [authUserId, authorDisplayName, jobThreadDraft, mergeJobThreadStatsForJobIds, showToast],
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
