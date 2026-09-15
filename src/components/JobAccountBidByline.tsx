import { useEffect, useState } from 'react'

import { supabase } from '../lib/supabase'
import { fetchUserDisplayNames, userDisplayLabel } from '../lib/userDisplayNames'

/**
 * Job accounts from the bid (v2.3454): one line on the Dispatch card for a
 * tech's job-account ask — which bid the job came from, who bid it, and the
 * houses that quoted it — so the office can loop the estimator in by phone
 * instead of a second inbox. Renders nothing for a hand-made job.
 */
export function JobAccountBidByline({ jobId }: { jobId: string }) {
  const [line, setLine] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data: idRows } = await supabase.rpc('job_account_job_identity', { p_job_id: jobId })
        const bidId = ((idRows ?? []) as Array<{ bid_id: string | null }>)[0]?.bid_id ?? null
        if (!bidId) return
        const [{ data: bid }, { data: rfqs }] = await Promise.all([
          supabase.from('bids').select('bid_number, project_name, created_by').eq('id', bidId).maybeSingle(),
          supabase.from('bid_rfqs').select('supply_house:supply_houses(name)').eq('bid_id', bidId),
        ])
        if (cancelled || !bid) return
        const names = bid.created_by ? await fetchUserDisplayNames([bid.created_by]) : []
        if (cancelled) return
        const who = names[0] ? userDisplayLabel(names[0]) : ''
        const num = (bid.bid_number ?? '').toString().trim()
        const label = [num ? `B${num}` : null, (bid.project_name ?? '').trim() || null].filter(Boolean).join(' · ') || 'a bid'
        const houses = [...new Set(((rfqs ?? []) as Array<{ supply_house: { name: string | null } | { name: string | null }[] | null }>).map((r) => (Array.isArray(r.supply_house) ? r.supply_house[0]?.name : r.supply_house?.name) ?? '').filter(Boolean))]
        setLine(`Bid ${label}${who ? ` · bid by ${who}` : ''}${houses.length > 0 ? ` · priced with ${houses.join(', ')}` : ''}`)
      } catch {
        // best-effort
      }
    })()
    return () => {
      cancelled = true
    }
  }, [jobId])
  if (!line) return null
  return (
    <span style={{ fontSize: '0.8125rem', color: 'var(--text-600)' }} data-job-account-bid-byline>
      {line} — the estimator knows the rep; a phone call can beat a card.
    </span>
  )
}
