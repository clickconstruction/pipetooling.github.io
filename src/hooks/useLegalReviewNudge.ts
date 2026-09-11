import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { buildLegalReview, type LegalMatterRow, type LegalReviewSummary } from '../lib/legal/legalMatters'
import { daysBetweenYmd, payerForJob } from '../lib/legal/legalPacket'
import { todayYmdInAppTz } from '../utils/dateUtils'

const db = supabase as unknown as SupabaseClient

type CollectionsJobRow = {
  id: string
  customer_id: string | null
  customer_name: string | null
  gc_customer_id: string | null
  collections_at: string | null
  revenue: number | null
  payments_made: number | null
}

/**
 * The dev's "Collections accounts await your review" card (Legal portal PR 2):
 * every Collections account not yet with a firm or closed, the ones the office
 * asked a dev about first, and how long the oldest has sat. Refetches on window
 * focus like the neighbouring nudges; fail-soft (a checkout ahead of the
 * migration renders nothing).
 */
export function useLegalReviewNudge(enabled: boolean): { review: LegalReviewSummary | null; reload: () => void } {
  const [review, setReview] = useState<LegalReviewSummary | null>(null)

  const load = useCallback(async () => {
    if (!enabled) {
      setReview(null)
      return
    }
    try {
      const jobsRes = await db
        .from('jobs_ledger')
        .select('id, customer_id, customer_name, gc_customer_id, collections_at, revenue, payments_made')
        .eq('status', 'billed')
        .not('collections_at', 'is', null)
        .limit(500)
      if (jobsRes.error) {
        setReview(null)
        return
      }
      const jobs = (jobsRes.data ?? []) as CollectionsJobRow[]
      if (jobs.length === 0) {
        setReview({ underReview: 0, withFirm: 0, requested: [], oldestDays: null, firstKey: null, balanceUnderReview: 0 })
        return
      }
      const gcIds = [...new Set(jobs.map((j) => j.gc_customer_id).filter((x): x is string => Boolean(x)))]
      const [gcRes, mattersRes, usersRes] = await Promise.all([
        gcIds.length ? db.from('customers').select('id, name').in('id', gcIds) : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }>, error: null }),
        db.from('legal_matters').select('*'),
        db.from('users').select('id, name'),
      ])
      const gcName = new Map(((gcRes.data ?? []) as Array<{ id: string; name: string | null }>).map((c) => [c.id, c.name] as const))
      const matters = mattersRes.error ? [] : ((mattersRes.data ?? []) as LegalMatterRow[])
      const userName = new Map(((usersRes.data ?? []) as Array<{ id: string; name: string | null }>).map((u) => [u.id, u.name] as const))
      const today = todayYmdInAppTz()
      const accounts = new Map<string, { key: string; name: string; reviewDays: number | null; balance: number }>()
      for (const j of jobs) {
        const payer = payerForJob({ customer_id: j.customer_id, customer_name: j.customer_name, gc_customer_id: j.gc_customer_id, gcCustomer: j.gc_customer_id ? { id: j.gc_customer_id, name: gcName.get(j.gc_customer_id) ?? null } : null })
        const acc = accounts.get(payer.key) ?? { key: payer.key, name: payer.name, reviewDays: null, balance: 0 }
        acc.balance += Math.max(0, Number(j.revenue ?? 0) - Number(j.payments_made ?? 0))
        const flagged = (j.collections_at ?? '').slice(0, 10)
        if (/^\d{4}-\d{2}-\d{2}$/.test(flagged)) {
          const d = daysBetweenYmd(flagged, today)
          acc.reviewDays = acc.reviewDays == null ? d : Math.max(acc.reviewDays, d)
        }
        accounts.set(payer.key, acc)
      }
      setReview(buildLegalReview([...accounts.values()], matters, today, (id) => (id ? (userName.get(id) ?? null) : null)))
    } catch {
      setReview(null)
    }
  }, [enabled])

  useEffect(() => {
    void load()
    if (!enabled) return
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [enabled, load])

  return { review, reload: () => void load() }
}
