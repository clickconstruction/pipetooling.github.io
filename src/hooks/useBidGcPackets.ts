/**
 * GC packets for a set of bids (Bids by GC, v2.2162): versions grouped by GC with send state and
 * per-GC outcome — what the Bid Board's per-GC rows and Followup read. One query per table for all
 * bids; recomputes when sends / versions change (window events from the picker + Cover Letter).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { groupVersionsByGc, type GcPacket, type GcVersionLike } from '../lib/bids/gcPackets'
import { latestSendByVersion, type VersionSendRow } from '../lib/bids/versionSends'

type BidLite = { id: string; bid_date_sent: string | null; customers?: { name?: string | null } | null; bids_gc_builders?: { name?: string | null } | null }

export function useBidGcPackets(bids: ReadonlyArray<BidLite>): { packetsByBid: Record<string, GcPacket[]>; reload: () => void } {
  const [versions, setVersions] = useState<Array<GcVersionLike & { bid_id: string }>>([])
  const [sends, setSends] = useState<VersionSendRow[]>([])
  const [gcNames, setGcNames] = useState<Record<string, string>>({})
  const [tick, setTick] = useState(0)
  const ids = useMemo(() => bids.map((b) => b.id), [bids])
  const idsKey = ids.join('|')
  useEffect(() => {
    if (ids.length === 0) { setVersions([]); setSends([]); return }
    let cancelled = false
    void (async () => {
      const [vRes, sRes] = await Promise.all([
        supabase.from('bid_versions').select('id, bid_id, name, customer_id, sort_order, created_at, starred_price_book_version_id, outcome, outcome_at').in('bid_id', ids),
        supabase.from('bid_version_sends').select('bid_version_id, sent_on, value, is_alternate, created_at').in('bid_id', ids),
      ])
      if (cancelled) return
      const vs = ((vRes.data ?? []) as Array<GcVersionLike & { bid_id: string }>)
      setVersions(vs)
      setSends(sRes.error ? [] : ((sRes.data ?? []) as VersionSendRow[]))
      const cids = [...new Set(vs.map((v) => v.customer_id).filter((c): c is string => !!c))]
      if (cids.length > 0) {
        const { data } = await supabase.from('customers').select('id, name').in('id', cids)
        if (!cancelled && data) setGcNames(Object.fromEntries(data.map((c) => [c.id, c.name ?? '—'])))
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, tick])
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    window.addEventListener('bid-version-sends-changed', bump)
    window.addEventListener('bid-version-picker-reload', bump)
    window.addEventListener('bid-gc-outcome-changed', bump)
    return () => {
      window.removeEventListener('bid-version-sends-changed', bump)
      window.removeEventListener('bid-version-picker-reload', bump)
      window.removeEventListener('bid-gc-outcome-changed', bump)
    }
  }, [])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  const packetsByBid = useMemo(() => {
    const latest = latestSendByVersion(sends)
    const out: Record<string, GcPacket[]> = {}
    const byBid = new Map<string, Array<GcVersionLike & { bid_id: string }>>()
    for (const v of versions) byBid.set(v.bid_id, [...(byBid.get(v.bid_id) ?? []), v])
    for (const b of bids) {
      const vs = byBid.get(b.id)
      if (!vs || vs.length === 0) continue
      out[b.id] = groupVersionsByGc(vs, { bidGcName: b.customers?.name ?? b.bids_gc_builders?.name ?? null, gcNames, latestSends: latest, bidDateSent: b.bid_date_sent })
    }
    return out
  }, [versions, sends, gcNames, bids])
  return { packetsByBid, reload }
}
