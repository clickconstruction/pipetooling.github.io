import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fixtureKey } from '../lib/bids/takeoffFixtureKey'
import { fetchTakeoffFixtureHistory } from '../lib/bids/takeoffFixtureHistoryRpc'
import { groupFixtureHistory } from '../lib/bids/takeoffFixtureHistory'
import type { TakeoffFixtureHistoryRow } from '../types/database-functions'

/**
 * "What this fixture usually gets" for every fixture on a bid — one
 * `takeoff_fixture_history` call per bid (keys de-duplicated), shared by
 * New 1 and New 2 (v2.2778 / v2.2779). `null` while loading; a failed call
 * degrades to an empty map (the views say "no other bid has costed this").
 */
export function useTakeoffFixtureHistory(args: {
  bidId: string | null
  serviceTypeId: string
  countRows: ReadonlyArray<{ fixture: string | null | undefined }>
  bidsPerKey?: number
}): Map<string, TakeoffFixtureHistoryRow[]> | null {
  const { bidId, serviceTypeId, countRows, bidsPerKey = 3 } = args
  const keys = useMemo(() => Array.from(new Set(countRows.map((r) => fixtureKey(r.fixture)).filter(Boolean))).sort().join(' '), [countRows])
  const [history, setHistory] = useState<Map<string, TakeoffFixtureHistoryRow[]> | null>(null)
  useEffect(() => {
    let cancelled = false
    setHistory(null)
    const list = keys ? keys.split(' ') : []
    if (!bidId || list.length === 0) {
      setHistory(new Map())
      return
    }
    void (async () => {
      try {
        const rows = await fetchTakeoffFixtureHistory(supabase, { serviceTypeId, keys: list, excludeBidId: bidId, bidsPerKey })
        if (!cancelled) setHistory(groupFixtureHistory(rows))
      } catch (e) {
        console.warn('[takeoff] fixture history unavailable:', e)
        if (!cancelled) setHistory(new Map())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bidId, serviceTypeId, keys, bidsPerKey])
  return history
}
