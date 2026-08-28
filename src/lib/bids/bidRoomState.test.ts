import { describe, it, expect } from 'vitest'
import { roomStateChipLabel, roomStateChipTone, summarizeBidRooms } from './bidRoomState'

const room = (id: string, bid_id: string, customer_id: string | null, closed = false) => ({
  id,
  bid_id,
  customer_id,
  closed_at: closed ? '2026-08-28T10:00:00Z' : null,
})
const ev = (room_id: string, event_type: string, occurred_at: string, metadata: unknown = {}) => ({
  room_id,
  event_type,
  occurred_at,
  metadata,
})

describe('summarizeBidRooms', () => {
  it('folds rooms into per-bid per-GC summaries keyed by the gcPackets convention', () => {
    const out = summarizeBidRooms(
      [room('r1', 'b1', null), room('r2', 'b1', 'gc-north')],
      [
        { room_id: 'r1', rev_number: 1 },
        { room_id: 'r2', rev_number: 1 },
        { room_id: 'r2', rev_number: 3 },
      ],
      [
        ev('r2', 'link_sent', '2026-08-28T01:00:00Z'),
        ev('r2', 'room_view', '2026-08-28T02:00:00Z'),
        ev('r2', 'room_view', '2026-08-28T03:00:00Z'),
      ],
    )
    expect(out.b1?.['']?.revNumber).toBe(1)
    expect(out.b1?.['gc-north']).toMatchObject({ revNumber: 3, viewCount: 2, everSent: true, lastViewAt: '2026-08-28T03:00:00Z' })
  })

  it('the latest signed/declined event wins and carries its metadata', () => {
    const out = summarizeBidRooms(
      [room('r1', 'b1', null)],
      [{ room_id: 'r1', rev_number: 2 }],
      [ev('r1', 'signed', '2026-08-28T05:00:00Z', { option_name: 'Base bid', total_cents: 24997129 })],
    )
    const s = out.b1?.['']
    expect(s?.outcome).toBe('signed')
    expect(roomStateChipLabel(s)).toBe('✍ signed — Base bid $249,971')
    expect(roomStateChipTone(s)).toBe('signed')
  })

  it('chip labels for the in-flight states', () => {
    const base = summarizeBidRooms([room('r1', 'b1', null)], [{ room_id: 'r1', rev_number: 2 }], [ev('r1', 'link_sent', 'x')]).b1?.['']
    expect(roomStateChipLabel(base)).toBe('rev 2 · not opened yet')
    expect(roomStateChipTone(base)).toBe('live')
    const unsent = summarizeBidRooms([room('r1', 'b1', null)], [{ room_id: 'r1', rev_number: 1 }], []).b1?.['']
    expect(roomStateChipLabel(unsent)).toBe('rev 1 · not sent')
    expect(roomStateChipTone(unsent)).toBe('idle')
    const empty = summarizeBidRooms([room('r1', 'b1', null)], [], []).b1?.['']
    expect(roomStateChipLabel(empty)).toBe('room · nothing published')
    expect(roomStateChipLabel(null)).toBeNull()
  })

  it('declined renders as declined; closed rooms say so', () => {
    const dec = summarizeBidRooms([room('r1', 'b1', null)], [{ room_id: 'r1', rev_number: 1 }], [ev('r1', 'declined', 'x')]).b1?.['']
    expect(roomStateChipLabel(dec)).toBe('✍ declined')
    const closed = summarizeBidRooms([room('r1', 'b1', null, true)], [{ room_id: 'r1', rev_number: 1 }], []).b1?.['']
    expect(roomStateChipLabel(closed)).toBe('room closed')
  })
})
