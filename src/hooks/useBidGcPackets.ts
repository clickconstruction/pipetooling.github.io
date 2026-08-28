/**
 * GC packets for a set of bids (Bids by GC, v2.2162): versions grouped by GC with send state and
 * per-GC outcome — what the Bid Board's per-GC rows and Followup read. One query per table for all
 * bids; recomputes when sends / versions change (window events from the picker + Cover Letter).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { groupVersionsByGc, type GcPacket, type GcVersionLike } from '../lib/bids/gcPackets'
import { latestSendByVersion, type VersionSendRow } from '../lib/bids/versionSends'
import { countGcNotes } from '../lib/bids/bidGcNotes'
import { summarizeBidRooms, type BidRoomStateSummary, type RoomDocumentLike, type RoomEventLike, type RoomRevisionLike, type RoomRowLike } from '../lib/bids/bidRoomState'

type BidLite = { id: string; bid_date_sent: string | null; customers?: { name?: string | null } | null; bids_gc_builders?: { name?: string | null } | null }

export function useBidGcPackets(bids: ReadonlyArray<BidLite>, recipientsByBid?: Record<string, ReadonlyArray<{ customerId: string; name: string }>>): { packetsByBid: Record<string, GcPacket[]>; noteCounts: Record<string, number>; roomStatesByBid: Record<string, Record<string, BidRoomStateSummary>>; reload: () => void } {
  const [versions, setVersions] = useState<Array<GcVersionLike & { bid_id: string }>>([])
  const [sends, setSends] = useState<VersionSendRow[]>([])
  const [gcNames, setGcNames] = useState<Record<string, string>>({})
  /** Per-GC note counts (v2.2217): `${bidId}:${gcCustomerId}` → n (scoped bids_submission_entries). */
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({})
  /** Bid Room read-backs (v2.2471): bidId → gcKey ('' = own GC) → room summary. */
  const [roomStatesByBid, setRoomStatesByBid] = useState<Record<string, Record<string, BidRoomStateSummary>>>({})
  const [tick, setTick] = useState(0)
  const ids = useMemo(() => bids.map((b) => b.id), [bids])
  const idsKey = ids.join('|')
  useEffect(() => {
    if (ids.length === 0) { setVersions([]); setSends([]); return }
    let cancelled = false
    void (async () => {
      const [vRes, sRes, nRes] = await Promise.all([
        supabase.from('bid_versions').select('id, bid_id, name, customer_id, sort_order, created_at, starred_price_book_version_id, outcome, outcome_at, loss_category, outcome_note').in('bid_id', ids),
        supabase.from('bid_version_sends').select('bid_version_id, sent_on, value, is_alternate, created_at').in('bid_id', ids),
        supabase.from('bids_submission_entries').select('bid_id, gc_customer_id').in('bid_id', ids).not('gc_customer_id', 'is', null),
      ])
      if (cancelled) return
      setNoteCounts(countGcNotes(((nRes.data ?? []) as Array<{ bid_id: string; gc_customer_id: string | null }>)))
      const vs = ((vRes.data ?? []) as Array<GcVersionLike & { bid_id: string }>)
      setVersions(vs)
      setSends(sRes.error ? [] : ((sRes.data ?? []) as VersionSendRow[]))
      // Bid Rooms (v2.2471): one batched pull; events/revisions only for the rooms found.
      const { data: roomRows } = await supabase.from('bid_proposal_rooms').select('id, bid_id, customer_id, closed_at').in('bid_id', ids)
      const rooms = (roomRows ?? []) as RoomRowLike[]
      if (!cancelled) {
        if (rooms.length === 0) setRoomStatesByBid({})
        else {
          const roomIds = rooms.map((r) => r.id)
          const [revRes, evRes, docRes] = await Promise.all([
            supabase.from('bid_proposal_room_revisions').select('room_id, rev_number').in('room_id', roomIds),
            supabase.from('bid_proposal_room_events').select('room_id, event_type, occurred_at, metadata').in('room_id', roomIds),
            supabase.from('estimates').select('bid_room_id, status').in('bid_room_id', roomIds),
          ])
          if (!cancelled) {
            setRoomStatesByBid(
              summarizeBidRooms(
                rooms,
                (revRes.data ?? []) as RoomRevisionLike[],
                (evRes.data ?? []) as RoomEventLike[],
                (docRes.data ?? []) as RoomDocumentLike[],
              ),
            )
          }
        }
      }
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
    window.addEventListener('bid-gc-notes-changed', bump)
    window.addEventListener('bid-room-changed', bump)
    return () => {
      window.removeEventListener('bid-room-changed', bump)
      window.removeEventListener('bid-version-sends-changed', bump)
      window.removeEventListener('bid-version-picker-reload', bump)
      window.removeEventListener('bid-gc-outcome-changed', bump)
      window.removeEventListener('bid-gc-notes-changed', bump)
    }
  }, [])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  const packetsByBid = useMemo(() => {
    const latest = latestSendByVersion(sends)
    const out: Record<string, GcPacket[]> = {}
    const byBid = new Map<string, Array<GcVersionLike & { bid_id: string }>>()
    for (const v of versions) byBid.set(v.bid_id, [...(byBid.get(v.bid_id) ?? []), v])
    for (const b of bids) {
      const vs = byBid.get(b.id) ?? []
      const recipients = recipientsByBid?.[b.id]
      if (vs.length === 0 && !(recipients && recipients.length > 0)) continue
      out[b.id] = groupVersionsByGc(vs, { bidGcName: b.customers?.name ?? b.bids_gc_builders?.name ?? null, gcNames, latestSends: latest, bidDateSent: b.bid_date_sent, recipients })
    }
    return out
  }, [versions, sends, gcNames, bids, recipientsByBid])
  return { packetsByBid, noteCounts, roomStatesByBid, reload }
}
