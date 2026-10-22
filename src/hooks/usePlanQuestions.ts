import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { rfiQuestionFrom, type PlanQuestionRow } from '../lib/bids/planQuestions'

// bid_plan_questions lands with 20261022..._bid_plan_questions; the generated types follow the push.
const db = supabase as unknown as SupabaseClient

/**
 * The thread of plan questions on one bid (Robot rounds PR 7, punch list #142): read on open and
 * every minute while the panel is open (an answer comes within a round), ask as yourself, mark the
 * answers seen, and make an RFI of an answer that says the plans do not say. Fail-soft.
 */
export function usePlanQuestions(input: { bidId: string | null; enabled: boolean; userId: string | null }): {
  rows: readonly PlanQuestionRow[]
  ask: (question: string) => Promise<string | null>
  makeRfi: (q: PlanQuestionRow) => Promise<{ error: string | null; rfiNumber: number | null }>
  reload: () => void
} {
  const { bidId, enabled, userId } = input
  const [rows, setRows] = useState<readonly PlanQuestionRow[]>([])
  const [gen, setGen] = useState(0)
  const reload = useCallback(() => setGen((g) => g + 1), [])

  useEffect(() => {
    if (!enabled || !bidId) {
      setRows([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await db.from('bid_plan_questions').select('*').eq('bid_id', bidId).neq('status', 'dismissed').order('asked_at', { ascending: false }).limit(50)
        if (cancelled || error) return
        const list = (data ?? []) as PlanQuestionRow[]
        setRows(list)
        // Reading the thread marks the asker's fresh answers seen, so the Dashboard line clears.
        const mine = list.filter((r) => r.status === 'answered' && !r.seen_at && r.asked_by && r.asked_by === userId).map((r) => r.id)
        if (mine.length) await db.from('bid_plan_questions').update({ seen_at: new Date().toISOString() }).in('id', mine)
      } catch {
        /* the thread stays as it was */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bidId, enabled, userId, gen])

  useEffect(() => {
    if (!enabled || !bidId) return
    const id = window.setInterval(() => { if (document.visibilityState !== 'hidden') setGen((g) => g + 1) }, 60_000)
    return () => window.clearInterval(id)
  }, [bidId, enabled])

  const ask = useCallback(async (question: string): Promise<string | null> => {
    const text = question.trim().replace(/\s+/g, ' ')
    if (!bidId || !userId) return 'Sign in to ask.'
    if (text.length < 3) return 'Type the question first.'
    try {
      const { error } = await db.from('bid_plan_questions').insert({ bid_id: bidId, question: text.slice(0, 600), asked_by: userId })
      if (error) return error.message
      setGen((g) => g + 1)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }, [bidId, userId])

  const makeRfi = useCallback(async (q: PlanQuestionRow): Promise<{ error: string | null; rfiNumber: number | null }> => {
    try {
      const { data: rfi, error } = await db.from('bids_rfis').insert({ bid_id: q.bid_id, question: rfiQuestionFrom(q), sheet_ref: q.sheet_refs?.[0] ?? null, source: 'manual', created_by: userId }).select('id, rfi_number').single()
      if (error || !rfi) return { error: error?.message ?? 'RFI insert failed', rfiNumber: null }
      const r = rfi as { id: string; rfi_number: number }
      await db.from('bid_plan_questions').update({ rfi_id: r.id, updated_at: new Date().toISOString() }).eq('id', q.id)
      setGen((g) => g + 1)
      return { error: null, rfiNumber: r.rfi_number }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e), rfiNumber: null }
    }
  }, [userId])

  return { rows, ask, makeRfi, reload }
}

/** The asker's fresh answers across bids, for the Dashboard's line (reads as the person; RLS scopes the rows). */
export function useRobotAnsweredNudge(enabled: boolean, userId: string | null | undefined): { rows: readonly PlanQuestionRow[]; bidNumberOf: (bidId: string) => string | null } {
  const [rows, setRows] = useState<readonly PlanQuestionRow[]>([])
  const [numbers, setNumbers] = useState<ReadonlyMap<string, string>>(() => new Map())
  useEffect(() => {
    if (!enabled || !userId) {
      setRows([])
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const { data, error } = await db.from('bid_plan_questions').select('*').eq('asked_by', userId).eq('status', 'answered').is('seen_at', null).order('answered_at', { ascending: false }).limit(20)
        if (cancelled || error) return
        const list = (data ?? []) as PlanQuestionRow[]
        setRows(list)
        const ids = [...new Set(list.map((r) => r.bid_id))]
        if (ids.length) {
          const { data: bids } = await db.from('bids').select('id, bid_number').in('id', ids)
          if (!cancelled) setNumbers(new Map(((bids ?? []) as Array<{ id: string; bid_number: string | number | null }>).map((b) => [b.id, b.bid_number == null ? '' : String(b.bid_number)])))
        }
      } catch {
        /* no line */
      }
    }
    void load()
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled, userId])
  const bidNumberOf = useCallback((bidId: string) => numbers.get(bidId) || null, [numbers])
  return { rows, bidNumberOf }
}
