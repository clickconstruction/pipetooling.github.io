import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { formatErrorMessage } from '../utils/errorHandling'
import { BACK_ON_DECK_PATCH, pressPatch, type InboxPaper, type PaperPress, type TrayRoutine } from '../lib/quickfill/physicalInbox'

/**
 * The Physical inbox deck's reads and writes (punch list #158, v2.5818): the papers in
 * `office_inbox_papers` that are still on the deck or in a fold, plus the ones decided in
 * the last three days (the Mark's auto-note counts today's) and every paper that became a
 * routine (the tray's routines block, v2.5825, reads their Checklist items). The io is a seam
 * so the station's render smokes run on an in-memory list.
 */

// The papers table lands with v2.5815's migration; the generated types follow in the next types PR, so the
// deck reads it untyped until then (the snooze writer's and the legal firms block's pattern).
const db = supabase as unknown as SupabaseClient

const DAY_MS = 86_400_000
const DECIDED_WINDOW_DAYS = 3
const PAPER_COLUMNS =
  'id, title, detail, came_on, created_by, created_at, state, outcome, outcome_detail, follow_up_on, outcome_at, outcome_by, checklist_item_id, dispatch_request_id, estimator_request_id, users!office_inbox_papers_created_by_fkey(name)'

export type NewPaper = { title: string; came_on: string; created_by: string | null }

/** The links a press leaves on the paper: the task or request it made, or a waiting paper's check day. */
export type PressExtra = Partial<Pick<InboxPaper, 'follow_up_on' | 'checklist_item_id' | 'dispatch_request_id' | 'estimator_request_id'>>

export type OfficeInboxIo = {
  list: () => Promise<InboxPaper[]>
  insert: (row: NewPaper) => Promise<InboxPaper>
  update: (id: string, patch: Partial<InboxPaper>) => Promise<void>
  /** The Checklist items the deck's routines point at, with their assignees and next open day. */
  routines: (itemIds: string[], todayYmd: string) => Promise<TrayRoutine[]>
}

/** A PostgREST error is a plain object; throw a real Error carrying the server's words and code so every reader can name the reason. */
function serverError(error: { message?: string; code?: string } | null): Error {
  return Object.assign(new Error(error?.message?.trim() || 'the server did not say why'), { code: error?.code })
}

type PaperRow = Omit<InboxPaper, 'created_by_name'> & { users: { name: string | null } | null }

function rowToPaper(r: PaperRow): InboxPaper {
  const { users, ...rest } = r
  return { ...rest, created_by_name: users?.name ?? null }
}

export const supabaseOfficeInboxIo: OfficeInboxIo = {
  async list() {
    const since = new Date(Date.now() - DECIDED_WINDOW_DAYS * DAY_MS).toISOString()
    const { data, error } = await db
      .from('office_inbox_papers')
      .select(PAPER_COLUMNS)
      .or(`state.neq.closed,outcome_at.gte.${since},outcome.eq.routine`)
      .order('came_on', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(500)
    if (error) throw serverError(error)
    return ((data ?? []) as unknown as PaperRow[]).map(rowToPaper)
  },
  async insert(row) {
    const { data, error } = await db.from('office_inbox_papers').insert(row).select(PAPER_COLUMNS).single()
    if (error) throw serverError(error)
    return rowToPaper(data as unknown as PaperRow)
  },
  async update(id, patch) {
    const { created_by_name: _name, ...cols } = patch
    void _name
    const { error } = await db.from('office_inbox_papers').update(cols).eq('id', id)
    if (error) throw serverError(error)
  },
  async routines(itemIds, todayYmd) {
    if (itemIds.length === 0) return []
    const [{ data: items, error: itemsErr }, { data: nexts, error: nextsErr }] = await Promise.all([
      supabase
        .from('checklist_items')
        .select('id, title, repeat_type, repeat_days_of_week, repeat_days_after, show_until_completed, checklist_item_assignees(user_id, users(name))')
        .in('id', itemIds),
      supabase
        .from('checklist_instances')
        .select('checklist_item_id, scheduled_date')
        .in('checklist_item_id', itemIds)
        .is('completed_at', null)
        .gte('scheduled_date', todayYmd)
        .order('scheduled_date', { ascending: true })
        .limit(itemIds.length * 8),
    ])
    if (itemsErr) throw serverError(itemsErr)
    if (nextsErr) throw serverError(nextsErr)
    const nextById = new Map<string, string>()
    for (const n of (nexts ?? []) as Array<{ checklist_item_id: string; scheduled_date: string }>) {
      if (!nextById.has(n.checklist_item_id)) nextById.set(n.checklist_item_id, n.scheduled_date)
    }
    type ItemRow = { id: string; title: string; repeat_type: string | null; repeat_days_of_week: number[] | null; repeat_days_after: number | null; show_until_completed: boolean | null; checklist_item_assignees: Array<{ user_id: string; users: { name: string | null } | null }> | null }
    return ((items ?? []) as unknown as ItemRow[]).map((it) => ({
      itemId: it.id,
      title: it.title,
      repeat_type: it.repeat_type,
      repeat_days_of_week: it.repeat_days_of_week,
      repeat_days_after: it.repeat_days_after,
      show_until_completed: it.show_until_completed,
      assigneeNames: (it.checklist_item_assignees ?? []).map((a) => a.users?.name?.trim() ?? '').filter(Boolean),
      nextDate: nextById.get(it.id) ?? null,
    }))
  },
}

export type UseOfficeInboxPapers = {
  papers: InboxPaper[]
  routines: TrayRoutine[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  add: (title: string, cameOn: string) => Promise<InboxPaper>
  press: (paper: InboxPaper, press: PaperPress, detail: string | null, extra?: PressExtra) => Promise<InboxPaper>
  backOnDeck: (paper: InboxPaper) => Promise<void>
}

export function useOfficeInboxPapers(io: OfficeInboxIo, userId: string | null, todayYmd: string): UseOfficeInboxPapers {
  const [papers, setPapers] = useState<InboxPaper[]>([])
  const [routines, setRoutines] = useState<TrayRoutine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await io.list()
      if (!alive.current) return
      setPapers(rows)
      const ids = [...new Set(rows.filter((p) => p.outcome === 'routine' && p.checklist_item_id).map((p) => p.checklist_item_id as string))]
      const rts = await io.routines(ids, todayYmd)
      if (!alive.current) return
      setRoutines(rts)
    } catch (e) {
      if (!alive.current) return
      setError(formatErrorMessage(e, 'Could not read the papers'))
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [io, todayYmd])

  useEffect(() => {
    void reload()
  }, [reload])

  const add = useCallback(
    async (title: string, cameOn: string) => {
      const row = await io.insert({ title, came_on: cameOn, created_by: userId })
      setPapers((prev) => [...prev, row])
      return row
    },
    [io, userId],
  )

  const press = useCallback(
    async (paper: InboxPaper, what: PaperPress, detail: string | null, extra?: PressExtra) => {
      const patch = { ...pressPatch(what, detail, extra?.follow_up_on ?? null, new Date().toISOString(), userId), ...extra }
      await io.update(paper.id, patch)
      const next = { ...paper, ...patch }
      setPapers((prev) => prev.map((p) => (p.id === paper.id ? next : p)))
      if (what === 'routine' && next.checklist_item_id) {
        const rts = await io.routines([next.checklist_item_id], todayYmd)
        if (alive.current) setRoutines((prev) => [...prev.filter((r) => !rts.some((n) => n.itemId === r.itemId)), ...rts])
      }
      return next
    },
    [io, userId, todayYmd],
  )

  const backOnDeck = useCallback(
    async (paper: InboxPaper) => {
      await io.update(paper.id, BACK_ON_DECK_PATCH)
      setPapers((prev) => prev.map((p) => (p.id === paper.id ? { ...p, ...BACK_ON_DECK_PATCH } : p)))
    },
    [io],
  )

  return { papers, routines, loading, error, reload, add, press, backOnDeck }
}
