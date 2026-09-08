import { describe, expect, it } from 'vitest'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import {
  BID_BOARD_MAP_DEFAULT_SECTIONS,
  bidBoardMapBids,
  bidBoardMapDistanceLine,
  bidBoardMapHomeFitPoints,
  bidBoardMapLegend,
  milesBetween,
  bidBoardMapUnmappedLine,
  bidBoardMapVisiblePins,
  parseBidDistanceMiles,
  readBidBoardMapHidden,
  resolveBidBoardMapPins,
  writeBidBoardMapHidden,
  type BidBoardMapPin,
} from './bidBoardMap'

const TODAY = new Date('2026-09-08T12:00:00')

function bid(p: Partial<BidWithBuilder> & { id: string }): BidWithBuilder {
  return {
    bid_number: '385',
    project_name: 'Galloway Park Concession Stand',
    address: '1400 Oak Hollow Rd, Burnet, TX 78611',
    outcome: null,
    bid_date_sent: null,
    bid_due_date: null,
    service_type_id: 'st-plumbing',
    distance_from_office: '96',
    bid_value: null,
    working_board_archived_at: null,
    customers: null,
    bids_gc_builders: null,
    estimator: null,
    ...p,
  } as unknown as BidWithBuilder
}

describe('bidBoardMapBids', () => {
  it('buckets by the board sections and drops archived unsent bids', () => {
    const { bids } = bidBoardMapBids(
      [
        bid({ id: 'u' }),
        bid({ id: 'p', bid_date_sent: '2026-09-01' }),
        bid({ id: 'w', outcome: 'won' }),
        bid({ id: 's', outcome: 'started_or_complete' }),
        bid({ id: 'l', outcome: 'lost' }),
        bid({ id: 'archived', working_board_archived_at: '2026-08-01T00:00:00Z' }),
      ],
      {},
      TODAY,
    )
    expect(bids.map((b) => [b.id, b.section])).toEqual([
      ['u', 'unsent'],
      ['p', 'pending'],
      ['w', 'won'],
      ['s', 'startedOrComplete'],
      ['l', 'lost'],
    ])
  })

  it('splits off bids with no usable address and keeps the label number-first', () => {
    const { bids, noAddress } = bidBoardMapBids([bid({ id: 'a' }), bid({ id: 'b', address: '  ' }), bid({ id: 'c', address: null })], {}, TODAY)
    expect(bids.map((b) => b.id)).toEqual(['a'])
    expect(noAddress.map((b) => b.id)).toEqual(['b', 'c'])
    expect(bids[0]!.label).toMatch(/385 · Galloway Park Concession Stand$/)
    expect(bids[0]!.addressKey).toBe('1400 oak hollow rd, burnet, tx 78611')
  })

  it('rings an unsent bid that is due soon or past due, but never a sent or decided one', () => {
    const { bids } = bidBoardMapBids(
      [
        bid({ id: 'overdue', bid_due_date: '2026-09-07' }),
        bid({ id: 'soon', bid_due_date: '2026-09-10' }),
        bid({ id: 'later', bid_due_date: '2026-09-30' }),
        bid({ id: 'sent', bid_due_date: '2026-09-07', bid_date_sent: '2026-09-06' }),
        bid({ id: 'won', bid_due_date: '2026-09-07', outcome: 'won' }),
        bid({ id: 'nodate' }),
      ],
      {},
      TODAY,
    )
    const byId = Object.fromEntries(bids.map((b) => [b.id, b]))
    expect(byId.overdue!.dueTone).toBe('overdue')
    expect(byId.overdue!.dueLabel).toBe('Mon 9/7 (+1)')
    expect(byId.soon!.dueTone).toBe('soon')
    expect(byId.soon!.dueLabel).toBe('Thu 9/10 (-2)')
    expect(byId.later!.dueTone).toBeNull()
    expect(byId.sent!.dueTone).toBeNull()
    expect(byId.sent!.dueLabel).toBe('Mon 9/7 (+1)')
    expect(byId.won!.dueTone).toBeNull()
    expect(byId.nodate!.dueLabel).toBeNull()
  })

  it('carries the GC, estimator, distance and value the popup shows', () => {
    const { bids } = bidBoardMapBids(
      [
        bid({
          id: 'a',
          customers: { name: 'JOERIS - SAN ANTONIO' } as BidWithBuilder['customers'],
          bids_gc_builders: { name: 'ignored when a customer exists' } as BidWithBuilder['bids_gc_builders'],
          estimator: [{ id: 'e1', name: 'Wendi', email: 'wendi@example.com' }],
          distance_from_office: '1,158.5 mi',
          bid_value: 44420,
        }),
        bid({ id: 'b', bids_gc_builders: { name: 'Knight Contracting' } as BidWithBuilder['bids_gc_builders'], estimator: { id: 'e2', name: '', email: 'grace@example.com' } }),
      ],
      {},
      TODAY,
    )
    expect(bids[0]).toMatchObject({ gcName: 'JOERIS - SAN ANTONIO', estimatorName: 'Wendi', distanceMiles: 1158.5, valueLabel: '$44k' })
    expect(bids[1]).toMatchObject({ gcName: 'Knight Contracting', estimatorName: 'grace@example.com', valueLabel: null })
  })
})

describe('parseBidDistanceMiles', () => {
  it('reads the leading number out of the free-text column', () => {
    expect(parseBidDistanceMiles('96')).toBe(96)
    expect(parseBidDistanceMiles('96.4 mi')).toBe(96.4)
    expect(parseBidDistanceMiles('1,158.5')).toBe(1158.5)
    expect(parseBidDistanceMiles('about 40 miles')).toBe(40)
    expect(parseBidDistanceMiles('')).toBeNull()
    expect(parseBidDistanceMiles(null)).toBeNull()
    expect(parseBidDistanceMiles('n/a')).toBeNull()
    expect(parseBidDistanceMiles('-5')).toBeNull()
  })
})

function pin(p: Partial<BidBoardMapPin> & { id: string; section: BidBoardMapPin['section'] }): BidBoardMapPin {
  return { lat: 30, lng: -97, label: p.id, numberLabel: p.id, projectName: p.id, gcName: null, address: 'x', addressKey: 'x', dueTone: null, dueLabel: null, estimatorName: null, distanceMiles: null, valueLabel: null, row: {} as BidWithBuilder, ...p }
}

describe('pins, legend and visibility', () => {
  it('attaches coordinates by address key and reports the rest as unmapped', () => {
    const { bids } = bidBoardMapBids([bid({ id: 'a' }), bid({ id: 'b', address: '5100 Pine Ridge Blvd' })], {}, TODAY)
    const { pins, unmapped } = resolveBidBoardMapPins(bids, new Map([['1400 oak hollow rd, burnet, tx 78611', { lat: 30.76, lng: -98.23 }]]))
    expect(pins.map((p) => [p.id, p.lat, p.lng])).toEqual([['a', 30.76, -98.23]])
    expect(unmapped.map((b) => b.id)).toEqual(['b'])
  })

  it('legend lists every section in board order with its pinned count, and the default view hides Lost', () => {
    const pins = [pin({ id: '1', section: 'unsent' }), pin({ id: '2', section: 'pending' }), pin({ id: '3', section: 'pending' }), pin({ id: '4', section: 'lost' })]
    expect(bidBoardMapLegend(pins)).toEqual([
      { section: 'unsent', count: 1 },
      { section: 'pending', count: 2 },
      { section: 'won', count: 0 },
      { section: 'startedOrComplete', count: 0 },
      { section: 'lost', count: 1 },
    ])
    expect(bidBoardMapVisiblePins(pins, BID_BOARD_MAP_DEFAULT_SECTIONS).map((p) => p.id)).toEqual(['1', '2', '3'])
    expect(bidBoardMapVisiblePins(pins, { ...BID_BOARD_MAP_DEFAULT_SECTIONS, lost: true, pending: false }).map((p) => p.id)).toEqual(['1', '4'])
  })
})

describe('bidBoardMapHomeFitPoints', () => {
  const office = { lat: 29.653, lng: -97.797 }
  const burnet = { lat: 30.758, lng: -98.228 }
  const dallas = { lat: 32.78, lng: -96.8 }
  const neesesSC = { lat: 33.53, lng: -81.12 }
  it('fits the pins within 150 miles of the office plus the office, leaving Dallas and a far-state bid out of the initial view', () => {
    expect(bidBoardMapHomeFitPoints([burnet, dallas, neesesSC], office)).toEqual([burnet, office])
    expect(bidBoardMapHomeFitPoints([burnet, dallas, neesesSC], office, 300)).toEqual([burnet, dallas, office])
  })
  it('fits everything when nothing is near, and every pin when there is no anchor', () => {
    expect(bidBoardMapHomeFitPoints([neesesSC], office)).toEqual([neesesSC, office])
    expect(bidBoardMapHomeFitPoints([burnet, neesesSC], null)).toEqual([burnet, neesesSC])
  })
  it('milesBetween is the great-circle distance', () => {
    expect(Math.round(milesBetween(office, burnet))).toBe(81)
    expect(Math.round(milesBetween(office, dallas))).toBe(224)
    expect(Math.round(milesBetween(office, neesesSC))).toBe(1016)
  })
})

describe('copy helpers', () => {
  it('distance line rounds to whole miles past ten and one decimal under', () => {
    expect(bidBoardMapDistanceLine({ distanceMiles: 96.4 })).toBe('96 mi from the office')
    expect(bidBoardMapDistanceLine({ distanceMiles: 4.26 })).toBe('4.3 mi from the office')
    expect(bidBoardMapDistanceLine({ distanceMiles: null })).toBeNull()
  })

  it('unmapped line', () => {
    expect(bidBoardMapUnmappedLine(0)).toBeNull()
    expect(bidBoardMapUnmappedLine(1)).toBe('1 bid has no map location yet')
    expect(bidBoardMapUnmappedLine(4)).toBe('4 bids have no map location yet')
  })
})

describe('hide preference', () => {
  it('round-trips through storage and survives a throwing store', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    }
    expect(readBidBoardMapHidden(storage)).toBe(false)
    writeBidBoardMapHidden(true, storage)
    expect(readBidBoardMapHidden(storage)).toBe(true)
    writeBidBoardMapHidden(false, storage)
    expect(readBidBoardMapHidden(storage)).toBe(false)
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readBidBoardMapHidden(broken)).toBe(false)
    expect(() => writeBidBoardMapHidden(true, broken)).not.toThrow()
    expect(readBidBoardMapHidden(null)).toBe(false)
  })
})
