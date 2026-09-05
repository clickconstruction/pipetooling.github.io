/**
 * The Ahead view's three forward sources (v2.2830): won bids (with their
 * estimated start dates), which bids already have a job, and schedule blocks
 * for the next eight weeks. One load per window; null while loading, empty on
 * error so the view can say what it couldn't read.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AHEAD_WEEKS, type AheadBid, type AheadScheduleBlock } from '../lib/jobs/jobSummaryAhead'
import { ymdAddDays } from '../utils/dateUtils'

export type AheadData = { bids: AheadBid[]; linkedBidIds: Set<string>; blocks: AheadScheduleBlock[]; errors: string[] }

export function useAheadData(enabled: boolean, todayYmd: string): AheadData | null {
  const [data, setData] = useState<AheadData | null>(null)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      const endYmd = ymdAddDays(todayYmd, AHEAD_WEEKS * 7)
      const [bidsRes, linksRes, blocksRes] = await Promise.all([
        supabase.from('bids').select('id, bid_number, project_name, bid_value, agreed_value, estimated_job_start_date, outcome').eq('outcome', 'won'),
        supabase.from('jobs_ledger').select('bid_id').not('bid_id', 'is', null),
        supabase.from('job_schedule_blocks').select('work_date, assignee_user_id, job_id, bid_id').gte('work_date', todayYmd).lte('work_date', endYmd),
      ])
      if (cancelled) return
      const errors: string[] = []
      if (bidsRes.error) errors.push(`won bids: ${bidsRes.error.message}`)
      if (linksRes.error) errors.push(`bid links: ${linksRes.error.message}`)
      if (blocksRes.error) errors.push(`schedule: ${blocksRes.error.message}`)
      setData({
        bids: (bidsRes.data ?? []) as AheadBid[],
        linkedBidIds: new Set(((linksRes.data ?? []) as Array<{ bid_id: string | null }>).map((r) => r.bid_id).filter((v): v is string => v != null)),
        blocks: (blocksRes.data ?? []) as AheadScheduleBlock[],
        errors,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, todayYmd])
  return data
}
