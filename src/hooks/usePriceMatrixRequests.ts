import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import type { PriceMatrixRequestRow, PriceMatrixResult, PriceMatrixScopeLine, PriceMatrixSource, PriceMatrixStatus } from '../lib/rfq/priceMatrixRequest'

// bid_price_matrix_requests predates the generated types (BidsRobotQueueTab
// pattern) — untyped until the post-push gen-types run.
const db = supabase as unknown as SupabaseClient

const SELECT =
  'id, bid_id, status, requested_at, requested_by, scope, sources, claimed_by, claimed_at, heartbeat_at, finished_at, reviewed_at, summary, result, bids(bid_number, project_name)'

export type PriceMatrixRequestWithBid = PriceMatrixRequestRow & {
  bid: { bid_number: string | null; project_name: string | null } | null
}

type RawRow = {
  id: string
  bid_id: string
  status: string
  requested_at: string
  requested_by: string | null
  scope: unknown
  sources: unknown
  claimed_by: string | null
  claimed_at: string | null
  heartbeat_at: string | null
  finished_at: string | null
  reviewed_at: string | null
  summary: string | null
  result: unknown
  bids: { bid_number: string | null; project_name: string | null } | Array<{ bid_number: string | null; project_name: string | null }> | null
}

function shape(r: RawRow): PriceMatrixRequestWithBid {
  const bid = Array.isArray(r.bids) ? (r.bids[0] ?? null) : r.bids
  return {
    id: r.id,
    bid_id: r.bid_id,
    status: r.status as PriceMatrixStatus,
    requested_at: r.requested_at,
    requested_by: r.requested_by,
    scope: Array.isArray(r.scope) ? (r.scope as PriceMatrixScopeLine[]) : [],
    sources: Array.isArray(r.sources) ? (r.sources as PriceMatrixSource[]) : [],
    claimed_by: r.claimed_by,
    claimed_at: r.claimed_at,
    heartbeat_at: r.heartbeat_at,
    finished_at: r.finished_at,
    reviewed_at: r.reviewed_at,
    summary: r.summary,
    result: r.result && typeof r.result === 'object' ? (r.result as PriceMatrixResult) : null,
    bid: bid ? { bid_number: bid.bid_number, project_name: bid.project_name } : null,
  }
}

/**
 * The bid's (or the whole board's) price-matrix requests — Price Matrix PR 2.
 * `supported` goes false when the table is not in the schema cache yet (client
 * ahead of the migration): callers render the door disabled with a plain
 * notice instead of a broken button. `nonce` re-runs the load.
 */
export function usePriceMatrixRequests(args: {
  enabled: boolean
  bidId?: string | null
  statuses?: ReadonlyArray<PriceMatrixStatus>
  limit?: number
  nonce?: number
}): { requests: PriceMatrixRequestWithBid[]; supported: boolean; loaded: boolean; reload: () => void } {
  const { enabled, bidId, statuses, limit = 50, nonce = 0 } = args
  const [requests, setRequests] = useState<PriceMatrixRequestWithBid[]>([])
  const [supported, setSupported] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])
  const statusKey = statuses ? [...statuses].sort().join(',') : ''

  useEffect(() => {
    if (!enabled || (bidId === null)) {
      setRequests([])
      setLoaded(true)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        let q = db.from('bid_price_matrix_requests').select(SELECT).order('requested_at', { ascending: false }).limit(limit)
        if (bidId) q = q.eq('bid_id', bidId)
        if (statusKey) q = q.in('status', statusKey.split(','))
        const { data, error } = await q
        if (cancelled) return
        if (error) {
          // Pre-push: the table is unknown to PostgREST. The door renders disabled.
          setSupported(false)
          setRequests([])
        } else {
          setSupported(true)
          setRequests(((data ?? []) as RawRow[]).map(shape))
        }
      } catch {
        if (!cancelled) {
          setSupported(false)
          setRequests([])
        }
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, bidId, statusKey, limit, nonce, tick])

  return { requests, supported, loaded, reload }
}
