import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

/** One CountTooling project on a bid, as the Bid Board and Edit Bid read it (v2.5520). */
export type BidCountSourceRow = {
  id: string
  bid_id: string
  link: string
  token: string | null
  project_name: string | null
  scope: string
  imported_by: string | null
  first_imported_at: string
  last_imported_at: string
  /** v2.6180: 'counttooling' for a project a person imported, 'robot' for the robot's fixtures; the label reads Robot. */
  source_kind?: string | null
}

export const BID_COUNT_SOURCE_SELECT = 'id, bid_id, link, token, project_name, scope, imported_by, first_imported_at, last_imported_at, source_kind'

/**
 * The CountTooling projects behind the board's bids (v2.5520): one chunked read of `bid_count_sources` for every
 * bid on the page, never one per row, first import first. Fail-soft: a bid with no row reads as one project, the
 * link on the bid itself. `gen` re-runs the read.
 */
export function useBidCountSourcesByBid(bidIds: ReadonlyArray<string>, enabled: boolean, gen = 0): ReadonlyMap<string, BidCountSourceRow[]> {
  const key = useMemo(() => (enabled ? [...bidIds].sort().join(',') : ''), [bidIds, enabled])
  const [map, setMap] = useState<ReadonlyMap<string, BidCountSourceRow[]>>(() => new Map())

  useEffect(() => {
    if (!key) {
      setMap(new Map())
      return
    }
    let cancelled = false
    void (async () => {
      const ids = key.split(',')
      const rows: BidCountSourceRow[] = []
      try {
        for (let i = 0; i < ids.length; i += 200) {
          const { data, error } = await supabase.from('bid_count_sources').select(BID_COUNT_SOURCE_SELECT).in('bid_id', ids.slice(i, i + 200)).order('first_imported_at', { ascending: true })
          if (error) throw error
          rows.push(...((data ?? []) as BidCountSourceRow[]))
        }
      } catch {
        /* the chips are a courtesy — the bid's own link still draws */
      }
      if (cancelled) return
      const next = new Map<string, BidCountSourceRow[]>()
      for (const r of rows) {
        const list = next.get(r.bid_id)
        if (list) list.push(r)
        else next.set(r.bid_id, [r])
      }
      setMap(next)
    })()
    return () => {
      cancelled = true
    }
  }, [key, gen])

  return map
}
