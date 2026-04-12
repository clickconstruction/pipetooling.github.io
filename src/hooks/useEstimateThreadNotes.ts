import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { JobThreadNoteRow } from '../components/JobThreadNotesPanel'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import type { JobThreadNoteStats } from './useJobThreadNotes'

export type EstimateThreadNoteStats = JobThreadNoteStats

type ToastFn = (message: string, type: 'success' | 'info' | 'warning' | 'error') => void

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

function statsFromRpcRow(r: unknown): EstimateThreadNoteStats {
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

function rpcRowEstimateId(r: unknown): string | null {
  if (r == null || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  const id = o.estimate_id ?? o.estimateId
  return typeof id === 'string' && id.length > 0 ? id : null
}

const OPTIMISTIC_ESTIMATE_THREAD_NOTE_PREFIX = '__optimistic__:'

function makeOptimisticThreadNote(body: string, authorDisplayName: string | null | undefined): JobThreadNoteRow {
  return {
    id: `${OPTIMISTIC_ESTIMATE_THREAD_NOTE_PREFIX}${crypto.randomUUID()}`,
    body,
    created_at: new Date().toISOString(),
    author: { name: authorDisplayName?.trim() ? authorDisplayName.trim() : null },
  }
}

const THREAD_NOTE_SELECT =
  'id, body, created_at, author:users!estimates_thread_notes_author_user_id_fkey(name)' as const

const THREAD_STATS_ESTIMATE_IDS_CHUNK = 200

export function useEstimateThreadNotes(
  showToast: ToastFn,
  authUserId: string | undefined,
  authorDisplayName?: string | null,
) {
  const realtimeChannelId = useId()
  const [expandedEstimateThreadId, setExpandedEstimateThreadId] = useState<string | null>(null)
  const [estimateThreadNotesByEstimateId, setEstimateThreadNotesByEstimateId] = useState<
    Record<string, JobThreadNoteRow[]>
  >({})
  const [estimateThreadNotesLoadingId, setEstimateThreadNotesLoadingId] = useState<string | null>(null)
  const [estimateThreadSubmittingId, setEstimateThreadSubmittingId] = useState<string | null>(null)
  const [estimateThreadDraft, setEstimateThreadDraft] = useState('')
  const [estimateThreadStatsByEstimateId, setEstimateThreadStatsByEstimateId] = useState<
    Record<string, EstimateThreadNoteStats>
  >({})
  const expandedEstimateThreadIdRef = useRef<string | null>(null)
  const inFlightThreadNoteRef = useRef<{ estimateId: string; optimisticId: string } | null>(null)
  const threadStatsRefreshGenRef = useRef(0)

  const loadEstimateThreadNotesForEstimate = useCallback(
    async (estimateId: string, opts?: { quiet?: boolean }) => {
      const quiet = opts?.quiet === true
      if (!quiet) setEstimateThreadNotesLoadingId(estimateId)
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('estimates_thread_notes')
              .select(THREAD_NOTE_SELECT)
              .eq('estimate_id', estimateId)
              .order('created_at', { ascending: true }),
          'load estimates_thread_notes',
        )
        const rowsRaw = (data as JobThreadNoteRow[] | null) ?? []
        setEstimateThreadNotesByEstimateId((prev) => {
          const merged = (() => {
            const flight = inFlightThreadNoteRef.current
            if (quiet && flight?.estimateId === estimateId) {
              const opt = (prev[estimateId] ?? []).find((n) => n.id === flight.optimisticId)
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
            setEstimateThreadStatsByEstimateId((sprev) => {
              const cur = sprev[estimateId]
              if (!cur || (cur.last_note_body ?? '').trim()) return sprev
              return {
                ...sprev,
                [estimateId]: {
                  ...cur,
                  last_note_body: last.body,
                  last_note_author_name: last.author?.name?.trim() ?? cur.last_note_author_name,
                },
              }
            })
          }
          return { ...prev, [estimateId]: merged }
        })
      } catch (e: unknown) {
        showToast(formatErrorMessage(e, 'Failed to load estimate notes'), 'error')
      } finally {
        if (!quiet) setEstimateThreadNotesLoadingId(null)
      }
    },
    [showToast],
  )

  const mergeEstimateThreadStatsForEstimateIds = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    try {
      const data = await withSupabaseRetry(
        async () => supabase.rpc('estimates_thread_note_stats', { p_estimate_ids: ids }),
        'estimates_thread_note_stats merge',
      )
      const rows = (data as unknown[] | null) ?? []
      setEstimateThreadStatsByEstimateId((prev) => {
        const next = { ...prev }
        for (const r of rows) {
          const id = rpcRowEstimateId(r)
          if (id) next[id] = statsFromRpcRow(r)
        }
        return next
      })
    } catch {
      /* leave prior stats */
    }
  }, [])

  const refreshEstimateThreadStatsForEstimateIds = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      threadStatsRefreshGenRef.current += 1
      setEstimateThreadStatsByEstimateId({})
      return
    }
    const gen = ++threadStatsRefreshGenRef.current
    try {
      const next: Record<string, EstimateThreadNoteStats> = {}
      for (let i = 0; i < ids.length; i += THREAD_STATS_ESTIMATE_IDS_CHUNK) {
        if (threadStatsRefreshGenRef.current !== gen) return
        const slice = ids.slice(i, i + THREAD_STATS_ESTIMATE_IDS_CHUNK)
        const data = await withSupabaseRetry(
          async () => supabase.rpc('estimates_thread_note_stats', { p_estimate_ids: slice }),
          'estimates_thread_note_stats batch',
        )
        if (threadStatsRefreshGenRef.current !== gen) return
        const rows = (data as unknown[] | null) ?? []
        for (const r of rows) {
          const id = rpcRowEstimateId(r)
          if (id) next[id] = statsFromRpcRow(r)
        }
      }
      if (threadStatsRefreshGenRef.current !== gen) return
      setEstimateThreadStatsByEstimateId(next)
    } catch {
      if (threadStatsRefreshGenRef.current !== gen) return
    }
  }, [])

  useEffect(() => {
    expandedEstimateThreadIdRef.current = expandedEstimateThreadId
  }, [expandedEstimateThreadId])

  useEffect(() => {
    if (!expandedEstimateThreadId) return
    setEstimateThreadDraft('')
    void loadEstimateThreadNotesForEstimate(expandedEstimateThreadId)
  }, [expandedEstimateThreadId, loadEstimateThreadNotesForEstimate])

  useEffect(() => {
    if (!authUserId) return
    const channel = supabase
      .channel(`estimates-thread-notes-${realtimeChannelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'estimates_thread_notes' },
        (payload) => {
          const eid = (payload.new as { estimate_id?: string } | null)?.estimate_id
          if (eid && expandedEstimateThreadIdRef.current === eid) {
            void loadEstimateThreadNotesForEstimate(eid, { quiet: true })
          }
          if (eid) {
            void mergeEstimateThreadStatsForEstimateIds([eid])
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [authUserId, loadEstimateThreadNotesForEstimate, mergeEstimateThreadStatsForEstimateIds, realtimeChannelId])

  const submitEstimateThreadNote = useCallback(
    async (estimateId: string) => {
      const body = estimateThreadDraft.trim()
      if (!authUserId || !body) return
      const optimistic = makeOptimisticThreadNote(body, authorDisplayName ?? null)
      inFlightThreadNoteRef.current = { estimateId, optimisticId: optimistic.id }
      setEstimateThreadNotesByEstimateId((prev) => ({
        ...prev,
        [estimateId]: [...(prev[estimateId] ?? []), optimistic],
      }))
      setEstimateThreadStatsByEstimateId((prev) => {
        const cur = prev[estimateId]
        return {
          ...prev,
          [estimateId]: {
            note_count: (cur?.note_count ?? 0) + 1,
            last_note_at: optimistic.created_at,
            last_note_body: body,
            last_note_author_name:
              optimistic.author?.name?.trim() ?? cur?.last_note_author_name ?? null,
          },
        }
      })
      setEstimateThreadDraft('')
      setEstimateThreadSubmittingId(estimateId)
      try {
        const inserted = await withSupabaseRetry(
          async () =>
            supabase
              .from('estimates_thread_notes')
              .insert({
                estimate_id: estimateId,
                author_user_id: authUserId,
                body,
              })
              .select(THREAD_NOTE_SELECT)
              .single(),
          'insert estimates_thread_note',
        )
        if (inserted == null) throw new Error('No note row returned')
        const row = inserted as unknown as JobThreadNoteRow
        setEstimateThreadNotesByEstimateId((prev) => {
          const list = prev[estimateId] ?? []
          const idx = list.findIndex((n) => n.id === optimistic.id)
          if (idx < 0) return { ...prev, [estimateId]: [...list, row] }
          const next = [...list]
          next[idx] = row
          return { ...prev, [estimateId]: next }
        })
        inFlightThreadNoteRef.current = null
        const stats = await withSupabaseRetry(
          async () => supabase.rpc('estimates_thread_note_stats', { p_estimate_ids: [estimateId] }),
          'estimates_thread_note_stats after insert',
        )
        const statRow = (stats as unknown[] | null)?.[0]
        if (statRow) {
          setEstimateThreadStatsByEstimateId((prev) => ({
            ...prev,
            [estimateId]: statsFromRpcRow(statRow),
          }))
        }
      } catch (e: unknown) {
        inFlightThreadNoteRef.current = null
        setEstimateThreadNotesByEstimateId((prev) => ({
          ...prev,
          [estimateId]: (prev[estimateId] ?? []).filter((n) => n.id !== optimistic.id),
        }))
        void mergeEstimateThreadStatsForEstimateIds([estimateId])
        setEstimateThreadDraft(body)
        showToast(formatErrorMessage(e, 'Failed to post note'), 'error')
      } finally {
        setEstimateThreadSubmittingId(null)
      }
    },
    [authUserId, authorDisplayName, estimateThreadDraft, mergeEstimateThreadStatsForEstimateIds, showToast],
  )

  return {
    expandedEstimateThreadId,
    setExpandedEstimateThreadId,
    estimateThreadNotesByEstimateId,
    estimateThreadNotesLoadingId,
    estimateThreadSubmittingId,
    estimateThreadDraft,
    setEstimateThreadDraft,
    loadEstimateThreadNotesForEstimate,
    submitEstimateThreadNote,
    estimateThreadStatsByEstimateId,
    refreshEstimateThreadStatsForEstimateIds,
  }
}
