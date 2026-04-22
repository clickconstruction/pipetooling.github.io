import { useCallback, useEffect, useState } from 'react'
import { buildColumnBidMap, type BidWorkingBoardMapBid } from '../lib/bidWorkingBoardColumnMap'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'

type BidWorkingColumn = Database['public']['Tables']['bid_working_board_columns']['Row']
type BidWorkingPlacement = Database['public']['Tables']['bid_working_board_placements']['Row']

async function loadInboxCount(userId: string, bids: BidWorkingBoardMapBid[]): Promise<number> {
  const assignedBids = bids.filter((b) => b.estimator_id === userId || b.account_manager_id === userId)
  const assignedIds = new Set(assignedBids.map((b) => b.id))

  const colsRaw = await withSupabaseRetry(
    async () =>
      supabase.from('bid_working_board_columns').select('*').eq('user_id', userId).order('position', { ascending: true }),
    'load working board columns for inbox tally',
  )
  const columns = ((colsRaw ?? []) as BidWorkingColumn[]).slice()
  const sorted = [...columns].sort((a, b) => a.position - b.position)

  const placementsRaw = await withSupabaseRetry(
    async () => supabase.from('bid_working_board_placements').select('*').eq('user_id', userId),
    'load working board placements for inbox tally',
  )
  const pl = ((placementsRaw ?? []) as BidWorkingPlacement[]).filter((p) => assignedIds.has(p.bid_id))

  const inboxCol = sorted.find((c) => c.system_key === 'inbox')
  if (!inboxCol) {
    return assignedBids.length
  }
  const map = buildColumnBidMap(sorted, pl, assignedBids)
  return (map[inboxCol.id] ?? []).length
}

/**
 * Inbox card count for the Working board (explicit + implicit), for tab badges.
 * Refetches when bids change and on Realtime placement/column changes for this user.
 */
export function useWorkingBoardInboxCount(
  userId: string | undefined,
  bids: BidWorkingBoardMapBid[],
): { inboxCount: number; loading: boolean } {
  const [inboxCount, setInboxCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    if (!userId) {
      setInboxCount(0)
      setLoading(false)
      return
    }
    let cancelled = false
    if (refreshKey === 0) setLoading(true)
    void (async () => {
      try {
        const n = await loadInboxCount(userId, bids)
        if (!cancelled) setInboxCount(n)
      } catch {
        if (!cancelled) setInboxCount(0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      setLoading(false)
    }
  }, [userId, bids, refreshKey])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`working-board-inbox-tally-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bid_working_board_placements',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          bump()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bid_working_board_columns',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          bump()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, bump])

  return { inboxCount, loading }
}
