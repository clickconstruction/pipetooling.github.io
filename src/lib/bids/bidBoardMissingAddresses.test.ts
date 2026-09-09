import { describe, expect, it } from 'vitest'
import type { BidBoardMapBid, BidBoardMapPin } from './bidBoardMap'
import { addressDraftReady, composeMissingAddressRows, customerAddressHint, missingAddressStatus, missingAddressSummary } from './bidBoardMissingAddresses'

function mapBid(over: Partial<BidBoardMapBid> & { id: string; address?: string; customerAddress?: string | null }): BidBoardMapBid {
  const { customerAddress, ...rest } = over
  return {
    label: `b${over.id} · Test`,
    numberLabel: `b${over.id}`,
    projectName: 'Test',
    gcName: 'GC',
    address: '',
    addressKey: '',
    section: 'unsent',
    dueTone: null,
    dueLabel: null,
    estimatorName: null,
    distanceMiles: null,
    valueLabel: null,
    row: { customers: customerAddress === undefined ? null : { address: customerAddress }, bids_gc_builders: null } as unknown as BidBoardMapBid['row'],
    ...rest,
  }
}

describe('composeMissingAddressRows', () => {
  it('lists no-address bids first, then unplaced, then the session’s placed fixes', () => {
    const rows = composeMissingAddressRows({
      noAddress: [mapBid({ id: '1' })],
      unmapped: [mapBid({ id: '2', address: 'nowhere', addressKey: 'nowhere' })],
      pins: [{ ...mapBid({ id: '3', address: '1 Main St', addressKey: '1 main st' }), lat: 1, lng: 2 } as BidBoardMapPin, { ...mapBid({ id: '4' }), lat: 1, lng: 2 } as BidBoardMapPin],
      resolving: false,
      keepIds: new Set(['3']),
    })
    expect(rows.map((r) => [r.bid.id, r.reason])).toEqual([
      ['1', 'no-address'],
      ['2', 'unplaced'],
      ['3', 'placed'],
    ])
  })

  it('an unplaced row is "checking" while the geocoder is still resolving', () => {
    const rows = composeMissingAddressRows({ noAddress: [], unmapped: [mapBid({ id: '2', address: 'x', addressKey: 'x' })], pins: [], resolving: true, keepIds: new Set() })
    expect(rows[0]?.checking).toBe(true)
    expect(missingAddressStatus(rows[0]!).text).toMatch(/Looking/)
  })

  it('never lists a bid twice, even when it is in a missing set and kept', () => {
    const rows = composeMissingAddressRows({ noAddress: [mapBid({ id: '1' })], unmapped: [], pins: [], resolving: false, keepIds: new Set(['1']) })
    expect(rows).toHaveLength(1)
  })
})

describe('customerAddressHint', () => {
  it('offers the customer address when the bid has none or a different one, never when it matches', () => {
    expect(customerAddressHint(mapBid({ id: '1', customerAddress: '12 Oak St, Austin' }))).toBe('12 Oak St, Austin')
    expect(customerAddressHint(mapBid({ id: '1', address: '12 Oak St, Austin', customerAddress: '12 Oak St, Austin' }))).toBeNull()
    expect(customerAddressHint(mapBid({ id: '1', customerAddress: '' }))).toBeNull()
    expect(customerAddressHint(mapBid({ id: '1' }))).toBeNull()
  })
})

describe('summary and drafts', () => {
  it('summarises by reason', () => {
    const rows = composeMissingAddressRows({
      noAddress: [mapBid({ id: '1' }), mapBid({ id: '2' })],
      unmapped: [mapBid({ id: '3', address: 'x', addressKey: 'x' })],
      pins: [{ ...mapBid({ id: '4' }), lat: 0, lng: 0 } as BidBoardMapPin],
      resolving: false,
      keepIds: new Set(['4']),
    })
    expect(missingAddressSummary(rows)).toBe('2 without an address · 1 the map couldn’t place · 1 placed just now')
    expect(missingAddressSummary([])).toMatch(/Every bid/)
  })

  it('a draft saves only when it changed and is more than a couple of characters', () => {
    expect(addressDraftReady('  ', '')).toBe(false)
    expect(addressDraftReady('12', '')).toBe(false)
    expect(addressDraftReady('12 Oak St', '12 Oak St')).toBe(false)
    expect(addressDraftReady('12 Oak St ', '12 Oak St, Austin')).toBe(true)
  })

  it('a placed row names its distance when known', () => {
    const rows = composeMissingAddressRows({ noAddress: [], unmapped: [], pins: [{ ...mapBid({ id: '4', distanceMiles: 41.4 }), lat: 0, lng: 0 } as BidBoardMapPin], resolving: false, keepIds: new Set(['4']) })
    expect(missingAddressStatus(rows[0]!)).toEqual({ text: 'Placed ✓ · 41 mi from the office', tone: 'ok' })
  })
})
