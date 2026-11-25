import { describe, expect, it } from 'vitest'
import type { BidBoardMapBid, BidBoardMapPin } from './bidBoardMap'
import { plainSentence } from '../valuesInPlace'
import { addressDraftReady, composeMissingAddressRows, customerAddressHint, missingAddressMemory, missingAddressStatus, missingAddressSummary } from './bidBoardMissingAddresses'

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

describe('what the app remembers about an address it could not place (punch list #441)', () => {
  const NOW = '2026-11-24T15:00:00Z'
  const KEY = 'zz the pasture behind the made up barn'
  const words = mapBid({ id: '2', address: 'ZZ the pasture behind the made up barn', addressKey: KEY })
  const compose = (over: Partial<Parameters<typeof composeMissingAddressRows>[0]> = {}) =>
    composeMissingAddressRows({ noAddress: [mapBid({ id: '1' })], unmapped: [words], pins: [], resolving: false, keepIds: new Set(), ...over })
  const miss = { address_normalized: KEY, error_code: 'not_found', detail: null, checked_at: '2026-11-20T18:00:00Z' }

  it('a bid with no address has no memory lines and no Try again: its own words stand', () => {
    const [none] = compose({ misses: new Map([[KEY, miss]]) })
    expect(none!.miss).toBeNull()
    expect(missingAddressMemory(none!, NOW)).toBeNull()
    expect(missingAddressStatus(none!).text).toBe('No address on the bid — type the site address and save.')
  })

  it('while the map is still looking, the row says so and nothing more', () => {
    const [, looking] = compose({ resolving: true, misses: new Map([[KEY, miss]]) })
    expect(missingAddressMemory(looking!, NOW)).toBeNull()
    expect(missingAddressStatus(looking!).text).toMatch(/Looking/)
  })

  it('a standing miss says why, the day it was checked and the day the app asks again', () => {
    const [, row] = compose({ misses: new Map([[KEY, { ...miss, detail: 'no match from Google; no match from US Census' }]]) })
    expect(row!.miss?.checked_at).toBe('2026-11-20T18:00:00Z')
    const memory = missingAddressMemory(row!, NOW)!
    // The services' own account of the look-up is not drawn: one plain sentence.
    expect(memory.reason).toBe('No map service could find this address.')
    expect(plainSentence(memory.checked)).toBe('Checked Nov 20. The app asks again by itself on Dec 20.')
    // The row's own words stay above them.
    expect(missingAddressStatus(row!).text).toMatch(/couldn’t find this address/)
  })

  it('a miss with no day kept has no lines, and still offers Try again', () => {
    const [, row] = compose()
    expect(row!.miss).toBeNull()
    expect(missingAddressMemory(row!, NOW)).toEqual({ reason: '', checked: '' })
  })

  it('a Try again that kept the miss again moves the day, and gives a row with no reason its reason', () => {
    const [, bare] = compose()
    const kept = { kind: 'missed', reason: 'No map service could find this address.', checkedAt: NOW } as const
    const after = missingAddressMemory(bare!, NOW, kept)!
    expect(after.reason).toBe('No map service could find this address.')
    expect(plainSentence(after.checked)).toBe('Checked Nov 24. The app asks again by itself on Dec 24.')
    const [, row] = compose({ misses: new Map([[KEY, miss]]) })
    expect(plainSentence(missingAddressMemory(row!, NOW, kept)!.checked)).toBe('Checked Nov 24. The app asks again by itself on Dec 24.')
  })

  it('a Try again that kept nothing, or could not ask, leaves the day the app already had', () => {
    const [, row] = compose({ misses: new Map([[KEY, miss]]) })
    for (const tried of [{ kind: 'missed', reason: 'Google is taking no more look-ups right now. Try again later.', checkedAt: null }, { kind: 'failed', reason: 'Lost signal.' }] as const) {
      const memory = missingAddressMemory(row!, NOW, tried)!
      expect(memory.reason).toBe('No map service could find this address.')
      expect(plainSentence(memory.checked)).toBe('Checked Nov 20. The app asks again by itself on Dec 20.')
    }
  })

  it('a placed row has no memory lines', () => {
    const rows = composeMissingAddressRows({ noAddress: [], unmapped: [], pins: [{ ...words, lat: 1, lng: 2 } as BidBoardMapPin], resolving: false, keepIds: new Set(['2']), misses: new Map([[KEY, miss]]) })
    expect(rows[0]!.reason).toBe('placed')
    expect(missingAddressMemory(rows[0]!, NOW, { kind: 'placed' })).toBeNull()
  })
})
