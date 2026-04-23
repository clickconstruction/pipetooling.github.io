import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { checkSupabaseError, withSupabaseRetry } from '../utils/errorHandling'

export type ProspectWarmthCounts = {
  w3: number
  w2: number
  w1: number
  w0: number
  w4plus: number
  /** All active prospects (excludes not_a_fit, cant_reach) */
  totalActive: number
}

function emptyCounts(): ProspectWarmthCounts {
  return { w3: 0, w2: 0, w1: 0, w0: 0, w4plus: 0, totalActive: 0 }
}

/**
 * Buckets by warmth for active prospects only, matching Prospects → Prospect List
 * (exclude not_a_fit and cant_reach). Warmth 0–3 and 4+.
 */
export async function loadProspectWarmthCounts(
  supabase: SupabaseClient<Database>,
): Promise<ProspectWarmthCounts> {
  return await withSupabaseRetry(
    async () => {
      const res = await supabase
        .from('prospects')
        .select('warmth_count, prospect_fit_status')
      checkSupabaseError(res, 'load prospect warmth counts')
      const rows = (res.data ?? []) as Array<{
        warmth_count: number | null
        prospect_fit_status: string | null
      }>
      return { data: aggregateProspectWarmthCountsFromRows(rows), error: null }
    },
    'load prospect warmth counts',
  )
}

export function aggregateProspectWarmthCountsFromRows(
  rows: Array<{ warmth_count: number | null; prospect_fit_status: string | null }>,
): ProspectWarmthCounts {
  const out = emptyCounts()
  for (const p of rows) {
    if (p.prospect_fit_status === 'cant_reach' || p.prospect_fit_status === 'not_a_fit') continue
    out.totalActive += 1
    const w = p.warmth_count ?? 0
    if (w >= 4) {
      out.w4plus += 1
    } else if (w === 3) {
      out.w3 += 1
    } else if (w === 2) {
      out.w2 += 1
    } else if (w === 1) {
      out.w1 += 1
    } else {
      out.w0 += 1
    }
  }
  return out
}
