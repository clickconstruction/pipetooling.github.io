/**
 * Bid Room state read-backs (Signable Bids Phase 3, v2.2471): fold rooms + latest revisions +
 * events into the one summary every staff surface renders — the Send-to strip, the board's GC
 * lines, Waiting to hear, the Cover Letter panel. Pure; batch-fetched by useBidGcPackets.
 */

export type RoomRowLike = {
  id: string
  bid_id: string
  customer_id: string | null
  closed_at: string | null
}
export type RoomRevisionLike = { room_id: string; rev_number: number }
export type RoomEventLike = {
  room_id: string
  event_type: string
  occurred_at: string
  metadata: unknown
}
/** A change order published into a room (estimates row, doc_kind change_order). */
export type RoomDocumentLike = { bid_room_id: string | null; status: string }

export type BidRoomStateSummary = {
  roomId: string
  gcId: string | null
  closed: boolean
  revNumber: number | null
  everSent: boolean
  viewCount: number
  lastViewAt: string | null
  outcome: 'signed' | 'declined' | null
  outcomeAt: string | null
  outcomeMeta: {
    option_name?: string
    total_cents?: number
    estimate_number?: number
    printed_name?: string
    category?: string
  }
  /** Change orders in the room (Phase 4): awaiting signature / signed. */
  coPending: number
  coSigned: number
}

/** gcKey convention shared with gcPackets: '' = the bid's own GC. */
export function roomGcKey(customerId: string | null): string {
  return customerId ?? ''
}

export function summarizeBidRooms(
  rooms: ReadonlyArray<RoomRowLike>,
  revisions: ReadonlyArray<RoomRevisionLike>,
  events: ReadonlyArray<RoomEventLike>,
  documents: ReadonlyArray<RoomDocumentLike> = [],
): Record<string, Record<string, BidRoomStateSummary>> {
  const out: Record<string, Record<string, BidRoomStateSummary>> = {}
  for (const room of rooms) {
    const revs = revisions.filter((r) => r.room_id === room.id)
    const evs = events.filter((e) => e.room_id === room.id)
    const views = evs.filter((e) => e.event_type === 'room_view').map((e) => e.occurred_at).sort()
    const outcomeEv = [...evs]
      .filter((e) => e.event_type === 'signed' || e.event_type === 'declined')
      // Phase 4: change-order answers carry metadata.kind='change_order' — they never decide
      // the ROOM's (proposal's) outcome.
      .filter((e) => !(e.metadata && typeof e.metadata === 'object' && (e.metadata as { kind?: string }).kind === 'change_order'))
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
      .pop()
    const meta =
      outcomeEv && outcomeEv.metadata && typeof outcomeEv.metadata === 'object' && !Array.isArray(outcomeEv.metadata)
        ? (outcomeEv.metadata as BidRoomStateSummary['outcomeMeta'])
        : {}
    const docs = documents.filter((d) => d.bid_room_id === room.id)
    const summary: BidRoomStateSummary = {
      roomId: room.id,
      gcId: room.customer_id,
      closed: room.closed_at != null,
      revNumber: revs.length > 0 ? Math.max(...revs.map((r) => r.rev_number)) : null,
      everSent: evs.some((e) => e.event_type === 'link_sent'),
      viewCount: views.length,
      lastViewAt: views[views.length - 1] ?? null,
      outcome: outcomeEv ? (outcomeEv.event_type as 'signed' | 'declined') : null,
      outcomeAt: outcomeEv?.occurred_at ?? null,
      outcomeMeta: meta,
      coPending: docs.filter((d) => d.status === 'sent').length,
      coSigned: docs.filter((d) => d.status === 'customer_accepted').length,
    }
    const byGc = (out[room.bid_id] ??= {})
    // One OPEN room per GC by schema; a closed room only shows when no open one replaced it.
    const existing = byGc[roomGcKey(room.customer_id)]
    if (!existing || (existing.closed && !summary.closed)) byGc[roomGcKey(room.customer_id)] = summary
  }
  return out
}

function fmtUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}
function fmtDay(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
}

/** The compact chip every surface shows. Null = no room, show nothing. */
export function roomStateChipLabel(s: BidRoomStateSummary | null | undefined): string | null {
  if (!s) return null
  const coSuffix =
    s.coPending > 0
      ? ` · CO${s.coPending > 1 ? `×${s.coPending}` : ''} awaiting`
      : s.coSigned > 0
        ? ` · ${s.coSigned} CO${s.coSigned > 1 ? 's' : ''} signed`
        : ''
  if (s.outcome === 'signed') {
    const opt = (s.outcomeMeta.option_name ?? '').trim()
    const amt = typeof s.outcomeMeta.total_cents === 'number' ? ` ${fmtUsd(s.outcomeMeta.total_cents)}` : ''
    return `✍ signed${opt ? ` — ${opt}` : ''}${amt}${coSuffix}`
  }
  if (s.outcome === 'declined') return `✍ declined${coSuffix}`
  if (s.closed) return 'room closed'
  if (s.revNumber == null) return 'room · nothing published'
  const views = s.viewCount > 0 ? ` · opened ${s.viewCount}×${s.lastViewAt ? ` · ${fmtDay(s.lastViewAt)}` : ''}` : s.everSent ? ' · not opened yet' : ' · not sent'
  return `rev ${s.revNumber}${views}${coSuffix}`
}

/** Chip tone: green when signed, red-ish when declined, amber while out, muted otherwise. */
export function roomStateChipTone(s: BidRoomStateSummary | null | undefined): 'signed' | 'declined' | 'live' | 'idle' | null {
  if (!s) return null
  if (s.coPending > 0) return 'live'
  if (s.outcome === 'signed') return 'signed'
  if (s.outcome === 'declined') return 'declined'
  if (s.closed || s.revNumber == null || !s.everSent) return 'idle'
  return 'live'
}
