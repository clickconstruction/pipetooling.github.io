// Office-type card charges that landed on FIELD jobs — the hygiene line the
// 2026-09-03 parts query asked for. Mercury auto-categorises every debit-card
// transaction; when a Software / Utilities / Insurance / Medical… charge is
// allocated to a field job it inflates that job's "parts" and lowers every
// crew member's profit share there. The fix is a sorting decision in Banking,
// so the line points there. Pure kernel + a thin loader.

import { supabase } from '../supabase'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { denverCalendarDayKey, ymdAddDays } from '../../utils/dateUtils'

/**
 * Mercury categories that are overhead by nature, never a job's direct cost.
 * Fuel, vehicle expenses, retail, professional services, fees and government
 * services are deliberately NOT here — those can be legitimate job purchases
 * (fuel to reach the site, permits, rentals) and are a separate labelling
 * question.
 */
export const OFFICE_LIKE_MERCURY_CATEGORIES: readonly string[] = [
  'Software',
  'Utilities',
  'Insurance',
  'InternetAndTelephone',
  'Advertising',
  'Medical',
  'Education',
]

/** `mercury_transactions.mercury_category` is jsonb: usually a JSON string, occasionally null/other. */
export function mercuryCategoryString(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null
  if (v && typeof v === 'object' && 'name' in v && typeof (v as { name: unknown }).name === 'string') {
    return ((v as { name: string }).name.trim() || null)
  }
  return null
}

export type OfficeLikeChargeRow = {
  jobId: string
  /** Allocation amount as stored (negative = spend). */
  amount: number
  category: string | null
  counterparty: string | null
}

export type OfficeLikeChargesSummary = {
  usd: number
  charges: number
  jobs: number
  /** "Category · Counterparty $X" lines, largest first. */
  top: Array<{ category: string; counterparty: string; usd: number }>
}

export function summarizeOfficeLikeCharges(
  rows: readonly OfficeLikeChargeRow[],
  officeJobLedgerId: string | null,
  categories: readonly string[] = OFFICE_LIKE_MERCURY_CATEGORIES,
): OfficeLikeChargesSummary {
  const set = new Set(categories)
  let usd = 0
  let charges = 0
  const jobs = new Set<string>()
  const byKey = new Map<string, { category: string; counterparty: string; usd: number }>()
  for (const r of rows) {
    if (!r.category || !set.has(r.category)) continue
    if (officeJobLedgerId && r.jobId === officeJobLedgerId) continue
    const abs = Math.abs(Number(r.amount)) || 0
    if (abs <= 0) continue
    usd += abs
    charges += 1
    jobs.add(r.jobId)
    const counterparty = (r.counterparty ?? '').trim() || 'Unknown'
    const key = `${r.category}|${counterparty}`
    const cur = byKey.get(key) ?? { category: r.category, counterparty, usd: 0 }
    cur.usd += abs
    byKey.set(key, cur)
  }
  const top = [...byKey.values()].sort((a, b) => b.usd - a.usd || a.counterparty.localeCompare(b.counterparty))
  return { usd, charges, jobs: jobs.size, top }
}

/**
 * Card allocations whose transaction POSTED inside [startYmd, endYmd] on the
 * company calendar. Two chunked reads: transactions in the window (fetched a
 * day wide, re-bucketed with `denverCalendarDayKey`), then their allocations.
 */
export async function loadOfficeLikeChargeRows(args: {
  startYmd: string
  endYmd: string
}): Promise<OfficeLikeChargeRow[]> {
  const { startYmd, endYmd } = args
  const set = new Set(OFFICE_LIKE_MERCURY_CATEGORIES)
  const startIsoLow = `${ymdAddDays(startYmd, -1)}T00:00:00-00:00`
  const endIsoHigh = `${ymdAddDays(endYmd, 2)}T00:00:00-00:00`
  const txs = (await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          supabase
            .from('mercury_transactions')
            .select('id, posted_at, mercury_category, counterparty_name')
            .gte('posted_at', startIsoLow)
            .lt('posted_at', endIsoHigh)
            .order('id')
            .range(from, to),
        'load office-like mercury transactions',
      )) as Array<{ id: string; posted_at: string | null; mercury_category: unknown; counterparty_name: string | null }> | null,
      error: null,
    }),
    'load office-like mercury transactions',
  )).filter((t) => {
    // `mercury_category` is a jsonb column holding a JSON string, so the
    // category filter happens here — a server-side `in.(…)` would need
    // JSON-encoded values and fails with "invalid input syntax for type json".
    if (!set.has(mercuryCategoryString(t.mercury_category) ?? '')) return false
    if (!t.posted_at) return false
    const ms = Date.parse(t.posted_at)
    if (!Number.isFinite(ms)) return false
    const day = denverCalendarDayKey(ms)
    return day >= startYmd && day <= endYmd
  })
  if (txs.length === 0) return []
  const txById = new Map(txs.map((t) => [t.id, t]))
  const allocations = (await fetchAllRowsChunkedIn(
    txs.map((t) => t.id),
    (chunk, from, to) =>
      supabase
        .from('mercury_transaction_job_allocations')
        .select('job_id, amount, mercury_transaction_id')
        .in('mercury_transaction_id', chunk)
        .order('id')
        .range(from, to),
    'load office-like charge allocations',
  )) as Array<{ job_id: string; amount: number; mercury_transaction_id: string }>
  return allocations.map((a) => {
    const t = txById.get(a.mercury_transaction_id)
    return {
      jobId: a.job_id,
      amount: Number(a.amount),
      category: mercuryCategoryString(t?.mercury_category),
      counterparty: t?.counterparty_name ?? null,
    }
  })
}
