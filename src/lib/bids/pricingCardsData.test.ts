import { describe, expect, it } from 'vitest'

import { countRowsByOtherBidVersion, gcIdsToLoad, gcNameForVersion, needsOtherBidVersionRows } from './pricingCardsData'

describe('gcIdsToLoad', () => {
  it('names each GC on the versions once, skipping versions with none and names already loaded', () => {
    const versions = [{ customer_id: 'c1' }, { customer_id: null }, { customer_id: 'c2' }, { customer_id: 'c1' }, { customer_id: 'c3' }]
    expect(gcIdsToLoad(versions, { c2: 'Hensel Phelps' })).toEqual(['c1', 'c3'])
    expect(gcIdsToLoad(versions, { c1: 'A', c2: 'B', c3: 'C' })).toEqual([])
    expect(gcIdsToLoad([], {})).toEqual([])
  })

  it('a GC loaded with no name (—) counts as loaded', () => {
    expect(gcIdsToLoad([{ customer_id: 'c1' }], { c1: '—' })).toEqual([])
  })
})

describe('gcNameForVersion', () => {
  const bidVersions = [
    { id: 'v1', customer_id: null },
    { id: 'v2', customer_id: 'c2' },
    { id: 'v3', customer_id: 'c3' },
  ]
  const bid = { customers: { name: 'Rogers-O’Brien' }, bids_gc_builders: { name: 'Builder Co' } }

  it('a version with its own GC reads that GC; one still loading reads an ellipsis', () => {
    expect(gcNameForVersion({ bidVersions, gcNamesById: { c2: 'Hensel Phelps' }, bid, versionId: 'v2' })).toBe('Hensel Phelps')
    expect(gcNameForVersion({ bidVersions, gcNamesById: { c2: 'Hensel Phelps' }, bid, versionId: 'v3' })).toBe('…')
  })

  it('a version with no GC of its own, no version, or an unknown one reads the bid’s GC', () => {
    for (const versionId of ['v1', null, 'gone']) {
      expect(gcNameForVersion({ bidVersions, gcNamesById: {}, bid, versionId })).toBe('Rogers-O’Brien')
    }
  })

  it('then the builder, then "the GC"', () => {
    expect(gcNameForVersion({ bidVersions, gcNamesById: {}, bid: { customers: null, bids_gc_builders: { name: 'Builder Co' } }, versionId: null })).toBe('Builder Co')
    expect(gcNameForVersion({ bidVersions, gcNamesById: {}, bid: { customers: { name: null } }, versionId: null })).toBe('the GC')
    expect(gcNameForVersion({ bidVersions, gcNamesById: {}, bid: null, versionId: null })).toBe('the GC')
  })
})

describe('needsOtherBidVersionRows', () => {
  it('is true only when some scenario lives on another bid version', () => {
    expect(needsOtherBidVersionRows([{ bid_version_id: 'v1' }, { bid_version_id: 'v1' }], 'v1')).toBe(false)
    expect(needsOtherBidVersionRows([{ bid_version_id: 'v1' }, { bid_version_id: 'v2' }], 'v1')).toBe(true)
  })

  it('a legacy unversioned scenario on an unversioned bid is the one on screen', () => {
    expect(needsOtherBidVersionRows([{ bid_version_id: null }], null)).toBe(false)
    expect(needsOtherBidVersionRows([{ bid_version_id: null }], 'v1')).toBe(true)
  })
})

describe('countRowsByOtherBidVersion', () => {
  it('groups the rows by version in order and leaves out the version on screen', () => {
    const rows = [
      { id: 'a', bid_version_id: 'v1' },
      { id: 'b', bid_version_id: 'v2' },
      { id: 'c', bid_version_id: null },
      { id: 'd', bid_version_id: 'v2' },
    ]
    const out = countRowsByOtherBidVersion(rows, 'v1')
    expect([...out.keys()]).toEqual(['v2', ''])
    expect(out.get('v2')?.map((r) => r.id)).toEqual(['b', 'd'])
    expect(out.get('')?.map((r) => r.id)).toEqual(['c'])
    expect(out.has('v1')).toBe(false)
  })

  it('with the unversioned rows on screen, those are the ones left out', () => {
    const out = countRowsByOtherBidVersion([{ id: 'c', bid_version_id: null }, { id: 'b', bid_version_id: 'v2' }], null)
    expect([...out.keys()]).toEqual(['v2'])
  })
})
