import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { JOB_CREATED_FROM_BID_EVENT } from '../lib/bids/wonMomentActions'

export interface BidJobAccountRow {
  bid_id: string
  job_id: string | null
  job_hcp_number: string | null
  job_click_number: string | null
  job_name: string | null
  job_address: string | null
  supply_house_id: string
  house_name: string
  policy: string | null
  quoted: boolean
  status: string | null
  account_ref: string | null
  opened_via: string | null
  opened_at: string | null
  requested_at: string | null
  rep_contact_id: string | null
  rep_name: string | null
  rep_phone: string | null
  rep_email: string | null
}

/**
 * Job accounts from the bid (v2.3451): the linked job's account status per
 * house for one bid, through the bid-gated RPC — so an estimator, who reads
 * no job rows, still sees Ferguson ✓ on the bid they won. Refetches when a
 * job is created from the bid and on window focus. RPC error = nothing.
 */
export function useBidJobAccountStrip(bidId: string | null, enabled = true): {
  rows: BidJobAccountRow[]
  job: { id: string; hcpNumber: string | null; clickNumber: string | null; name: string | null; address: string | null } | null
  loaded: boolean
  reload: () => void
} {
  const [rows, setRows] = useState<BidJobAccountRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!enabled || !bidId) {
      setRows([])
      setLoaded(enabled)
      return
    }
    let cancelled = false
    void supabase.rpc('list_bid_job_account_strip', { p_bid_ids: [bidId] }).then(({ data, error }) => {
      if (cancelled) return
      setRows(error ? [] : ((data ?? []) as BidJobAccountRow[]))
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [bidId, enabled, tick])

  useEffect(() => {
    if (!enabled) return
    const bump = () => setTick((t) => t + 1)
    window.addEventListener('focus', bump)
    window.addEventListener(JOB_CREATED_FROM_BID_EVENT, bump)
    return () => {
      window.removeEventListener('focus', bump)
      window.removeEventListener(JOB_CREATED_FROM_BID_EVENT, bump)
    }
  }, [enabled])

  const job = useMemo(() => {
    const r = rows.find((x) => x.job_id)
    return r && r.job_id ? { id: r.job_id, hcpNumber: r.job_hcp_number, clickNumber: r.job_click_number, name: r.job_name, address: r.job_address } : null
  }, [rows])

  return { rows, job, loaded, reload }
}
