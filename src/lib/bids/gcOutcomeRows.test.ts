import { describe, expect, it } from 'vitest'
import { gcOutcomeRowsForBid, tallyGcOutcomeRows } from './gcOutcomeRows'
import type { GcPacket } from './gcPackets'

const pk = (key: string, gcId: string | null, name: string, extra: Partial<GcPacket> = {}, versionExtra: Record<string, unknown> = {}): GcPacket => ({
  key, gcId, name, versions: [{ id: `v-${key}`, name: key, customer_id: gcId, sort_order: 0, ...versionExtra }], sentOn: '2026-07-31', sentValue: null, outcome: null, ...extra,
})
const bid = (outcome: string | null, extra: Record<string, unknown> = {}) => ({ id: 'b1', outcome, bid_date_sent: '2026-07-31', bid_value: 52311.11, loss_category: null, loss_reason: null, ...extra })
const builder = { key: 'c-spc', name: 'SPC' }

describe('gcOutcomeRowsForBid', () => {
  it('no packets: one row with the bid outcome, value and reason', () => {
    const rows = gcOutcomeRowsForBid(bid('lost', { loss_category: 'price', loss_reason: 'too high' }), builder, undefined)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ gcKey: 'c-spc', gcName: 'SPC', outcome: 'lost', perGc: false, value: 52311.11, lossCategory: 'price', lossNote: 'too high', packetKey: null })
  })
  it('unsent and pending classify from bid_date_sent', () => {
    expect(gcOutcomeRowsForBid(bid(null, { bid_date_sent: null }), builder, undefined)[0]!.outcome).toBe('unsent')
    expect(gcOutcomeRowsForBid(bid(null), builder, undefined)[0]!.outcome).toBe('pending')
    expect(gcOutcomeRowsForBid(bid('started_or_complete'), builder, undefined)[0]!.outcome).toBe('won')
  })
  it('multi-GC with nothing marked: every packet inherits the bid (legacy)', () => {
    const rows = gcOutcomeRowsForBid(bid('lost', { loss_category: 'gc_lost' }), builder, [pk('', null, 'SPC'), pk('c-burd', 'c-burd', 'Burd')])
    expect(rows.map((r) => [r.gcKey, r.outcome, r.perGc, r.lossCategory])).toEqual([['c-spc', 'lost', false, 'gc_lost'], ['c-burd', 'lost', false, 'gc_lost']])
    expect(rows[0]!.siblings).toEqual([{ gcKey: 'c-burd', gcName: 'Burd', outcome: 'lost' }])
  })
  it('a sibling win makes an unmarked sent packet lost · gc_lost; a recorded reason wins', () => {
    const rows = gcOutcomeRowsForBid(bid('won'), builder, [
      pk('', null, 'SPC', { outcome: 'won', sentValue: 50000 }),
      pk('c-burd', 'c-burd', 'Burd'),
      pk('c-k', 'c-k', 'Knight', {}, { loss_category: 'price' }),
    ])
    expect(rows.map((r) => [r.gcName, r.outcome, r.perGc, r.lossCategory, r.value])).toEqual([
      ['SPC', 'won', true, null, 50000],
      ['Burd', 'lost', true, 'gc_lost', 52311.11],
      ['Knight', 'lost', true, 'price', 52311.11],
    ])
  })
  it('a sibling loss leaves an unmarked packet pending (or unsent when never sent)', () => {
    const rows = gcOutcomeRowsForBid(bid(null), builder, [pk('', null, 'SPC', { outcome: 'lost' }), pk('c-burd', 'c-burd', 'Burd'), pk('c-k', 'c-k', 'Knight', { sentOn: null })])
    expect(rows.map((r) => [r.gcName, r.outcome])).toEqual([['SPC', 'lost'], ['Burd', 'pending'], ['Knight', 'unsent']])
  })
  it('shared-letter packets take the bid outcome and never duplicate a real packet', () => {
    const rows = gcOutcomeRowsForBid(bid('lost'), builder, [pk('', null, 'SPC'), pk('shared:c-k', 'c-k', 'Knight', { sharedLetter: true, versions: [] })])
    expect(rows.map((r) => [r.gcName, r.outcome, r.sharedLetter])).toEqual([['SPC', 'lost', false], ['Knight', 'lost', true]])
  })
  it('tally: hit rate over decided rows only', () => {
    expect(tallyGcOutcomeRows([{ outcome: 'won' }, { outcome: 'lost' }, { outcome: 'lost' }, { outcome: 'pending' }, { outcome: 'unsent' }])).toEqual({ won: 1, lost: 2, pending: 1, unsent: 1, hitRatePct: 33 })
    expect(tallyGcOutcomeRows([{ outcome: 'pending' }]).hitRatePct).toBeNull()
  })
})
