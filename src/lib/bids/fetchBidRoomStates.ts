/** One-bid room-state fetch (v2.2471) for surfaces outside the batched useBidGcPackets. */
import { supabase } from '../supabase'
import { summarizeBidRooms, type BidRoomStateSummary, type RoomDocumentLike, type RoomEventLike, type RoomRevisionLike, type RoomRowLike } from './bidRoomState'

export async function fetchBidRoomStates(bidId: string): Promise<Record<string, BidRoomStateSummary>> {
  const { data: roomRows } = await supabase
    .from('bid_proposal_rooms')
    .select('id, bid_id, customer_id, closed_at')
    .eq('bid_id', bidId)
  const rooms = (roomRows ?? []) as RoomRowLike[]
  if (rooms.length === 0) return {}
  const roomIds = rooms.map((r) => r.id)
  const [revRes, evRes, docRes] = await Promise.all([
    supabase.from('bid_proposal_room_revisions').select('room_id, rev_number').in('room_id', roomIds),
    supabase.from('bid_proposal_room_events').select('room_id, event_type, occurred_at, metadata').in('room_id', roomIds),
    supabase.from('estimates').select('bid_room_id, status').in('bid_room_id', roomIds),
  ])
  return (
    summarizeBidRooms(
      rooms,
      (revRes.data ?? []) as RoomRevisionLike[],
      (evRes.data ?? []) as RoomEventLike[],
      (docRes.data ?? []) as RoomDocumentLike[],
    )[bidId] ?? {}
  )
}
