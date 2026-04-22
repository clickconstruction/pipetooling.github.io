import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { JobThreadActivityItem, JobThreadNoteRow } from '../components/JobThreadNotesPanel'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import {
  reportForViewFromJobLedgerRow,
  type ReportForJobLedgerRow,
} from '../lib/reportForViewFromJobLedgerRow'

type ToastFn = (message: string, type: 'success' | 'info' | 'warning' | 'error') => void

export type JobThreadNoteStats = {
  note_count: number
  last_note_at: string | null
  last_note_body: string | null
  last_note_author_name: string | null
  report_count: number
  last_report_at: string | null
  last_report_author_name: string | null
  last_report_template_name: string | null
  last_report_preview: string | null
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

export const EMPTY_JOB_THREAD_STATS: JobThreadNoteStats = {
  note_count: 0,
  last_note_at: null,
  last_note_body: null,
  last_note_author_name: null,
  report_count: 0,
  last_report_at: null,
  last_report_author_name: null,
  last_report_template_name: null,
  last_report_preview: null,
}

/** Normalize PostgREST / RPC row (snake_case; tolerate camelCase or string bigints). */
function statsFromRpcRow(r: unknown): JobThreadNoteStats {
  if (r == null || typeof r !== 'object') {
    return { ...EMPTY_JOB_THREAD_STATS }
  }
  const o = r as Record<string, unknown>
  return {
    note_count: rpcNum(o.note_count ?? o.noteCount),
    last_note_at: rpcStr(o.last_note_at ?? o.lastNoteAt),
    last_note_body: rpcStr(o.last_note_body ?? o.lastNoteBody),
    last_note_author_name: rpcStr(o.last_note_author_name ?? o.last_noteAuthorName),
    report_count: rpcNum(o.report_count ?? o.reportCount),
    last_report_at: rpcStr(o.last_report_at ?? o.lastReportAt),
    last_report_author_name: rpcStr(o.last_report_author_name ?? o.lastReportAuthorName),
    last_report_template_name: rpcStr(o.last_report_template_name ?? o.lastReportTemplateName),
    last_report_preview: rpcStr(o.last_report_preview ?? o.lastReportPreview),
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

function sortActivityByTime(items: JobThreadActivityItem[]): JobThreadActivityItem[] {
  return [...items].sort((a, b) => {
    const ta = a.kind === 'note' ? a.note.created_at : a.report.created_at
    const tb = b.kind === 'note' ? b.note.created_at : b.report.created_at
    return new Date(ta).getTime() - new Date(tb).getTime()
  })
}

function buildActivityFromServer(
  rowsRaw: JobThreadNoteRow[],
  reportRows: ReportForJobLedgerRow[],
  prevActivity: JobThreadActivityItem[] | undefined,
  quiet: boolean,
  flight: { jobId: string; optimisticId: string } | null,
  jobId: string,
): JobThreadActivityItem[] {
  const noteItems: JobThreadActivityItem[] = rowsRaw.map((n) => ({ kind: 'note' as const, note: n }))
  const reportItems: JobThreadActivityItem[] = reportRows.map((r) => ({
    kind: 'report' as const,
    report: reportForViewFromJobLedgerRow(r),
  }))
  let combined = sortActivityByTime([...noteItems, ...reportItems])

  if (quiet && flight?.jobId === jobId) {
    const opt = (prevActivity ?? []).find((i) => i.kind === 'note' && i.note.id === flight.optimisticId)
    if (opt && opt.kind === 'note' && !rowsRaw.some((r) => r.id === opt.note.id)) {
      combined = sortActivityByTime([...combined, opt])
    }
  }
  return combined
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
  const [jobThreadActivityByJobId, setJobThreadActivityByJobId] = useState<Record<string, JobThreadActivityItem[]>>({})
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
        const [notesData, reportData] = await Promise.all([
          withSupabaseRetry(
            async () =>
              supabase.from('jobs_ledger_thread_notes').select(THREAD_NOTE_SELECT).eq('job_id', jobId).order('created_at', {
                ascending: true,
              }),
            'load jobs_ledger_thread_notes',
          ),
          withSupabaseRetry(
            async () => supabase.rpc('list_reports_for_job_ledger', { p_job_id: jobId }),
            'list_reports_for_job_ledger',
          ),
        ])
        const rowsRaw = (notesData as JobThreadNoteRow[] | null) ?? []
        const reportRows = (reportData as ReportForJobLedgerRow[] | null) ?? []

        setJobThreadActivityByJobId((prev) => {
          const merged = buildActivityFromServer(
            rowsRaw,
            reportRows,
            prev[jobId],
            quiet,
            inFlightThreadNoteRef.current,
            jobId,
          )

          const lastNote = (() => {
            for (let i = merged.length - 1; i >= 0; i--) {
              const it = merged[i]
              if (it == null) continue
              if (it.kind === 'note' && it.note.body?.trim()) return it.note
            }
            return undefined
          })()
          if (lastNote?.body?.trim()) {
            setJobThreadStatsByJobId((sprev) => {
              const cur = sprev[jobId]
              if (!cur || (cur.last_note_body ?? '').trim()) return sprev
              return {
                ...sprev,
                [jobId]: {
                  ...cur,
                  last_note_body: lastNote.body,
                  last_note_author_name: lastNote.author?.name?.trim() ?? cur.last_note_author_name,
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
      .channel(`jobs-ledger-thread-activity-${realtimeChannelId}`)
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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports' },
        (payload) => {
          const jid = (payload.new as { job_ledger_id?: string | null } | null)?.job_ledger_id
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
      const optimisticItem: JobThreadActivityItem = { kind: 'note', note: optimistic }
      setJobThreadActivityByJobId((prev) => ({
        ...prev,
        [jobId]: sortActivityByTime([...(prev[jobId] ?? []), optimisticItem]),
      }))
      setJobThreadStatsByJobId((prev) => {
        const cur = prev[jobId]
        return {
          ...prev,
          [jobId]: {
            ...EMPTY_JOB_THREAD_STATS,
            ...cur,
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
        setJobThreadActivityByJobId((prev) => {
          const list = prev[jobId] ?? []
          const idx = list.findIndex((i) => i.kind === 'note' && i.note.id === optimistic.id)
          if (idx < 0) return { ...prev, [jobId]: sortActivityByTime([...list, { kind: 'note', note: row }]) }
          const next = [...list]
          next[idx] = { kind: 'note', note: row }
          return { ...prev, [jobId]: sortActivityByTime(next) }
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
        setJobThreadActivityByJobId((prev) => ({
          ...prev,
          [jobId]: (prev[jobId] ?? []).filter(
            (i) => !(i.kind === 'note' && i.note.id === optimistic.id),
          ),
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
    jobThreadActivityByJobId,
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
