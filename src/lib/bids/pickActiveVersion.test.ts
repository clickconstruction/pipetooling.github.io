import { describe, expect, it } from 'vitest'
import { deriveActivePricingId, pickActiveVersion, resolveTaggedVersion } from './pickActiveVersion'

describe('pickActiveVersion', () => {
  const versions = [
    { id: 'v2', sort_order: 1 },
    { id: 'v0', sort_order: 0 },
    { id: 'v1', sort_order: 2 },
  ]

  it('returns null for an unsplit bid (no versions)', () => {
    expect(pickActiveVersion({ savedVersionId: null, bidVersions: [] })).toBeNull()
  })

  it('keeps the saved version when still present', () => {
    expect(pickActiveVersion({ savedVersionId: 'v1', bidVersions: versions })).toBe('v1')
  })

  it('falls back to lowest sort_order when saved is stale or absent', () => {
    expect(pickActiveVersion({ savedVersionId: 'gone', bidVersions: versions })).toBe('v0')
    expect(pickActiveVersion({ savedVersionId: null, bidVersions: versions })).toBe('v0')
  })
})

describe('deriveActivePricingId', () => {
  const pricings = [
    { id: 'pA', bid_version_id: 'vA' },
    { id: 'pB', bid_version_id: 'vB' },
    { id: 'pLegacy', bid_version_id: null },
  ]

  it('matches the pricing facet of the active version', () => {
    expect(deriveActivePricingId({ activeVersionId: 'vB', bidPricings: pricings, legacyFallbackPricingId: null })).toBe('pB')
  })

  it('returns null when the active version has no pricing facet', () => {
    expect(deriveActivePricingId({ activeVersionId: 'vNoPricing', bidPricings: pricings, legacyFallbackPricingId: 'x' })).toBeNull()
  })

  it('uses an unsplit pricing copy when unsplit', () => {
    expect(deriveActivePricingId({ activeVersionId: null, bidPricings: pricings, legacyFallbackPricingId: 'tmpl' })).toBe('pLegacy')
  })

  it('falls back to the legacy global selection when unsplit with no bid pricing', () => {
    expect(deriveActivePricingId({ activeVersionId: null, bidPricings: [], legacyFallbackPricingId: 'tmpl' })).toBe('tmpl')
    expect(deriveActivePricingId({ activeVersionId: null, bidPricings: [], legacyFallbackPricingId: null })).toBeNull()
  })
})

describe('resolveTaggedVersion', () => {
  it('returns the version when the ref is tagged for the requested bid', () => {
    expect(resolveTaggedVersion({ bidId: 'bidA', versionId: 'vX' }, 'bidA')).toBe('vX')
  })

  it('preserves a null version for the matching bid (unsplit bid)', () => {
    expect(resolveTaggedVersion({ bidId: 'bidA', versionId: null }, 'bidA')).toBeNull()
  })

  it('returns null (Base) when the ref belongs to a different bid', () => {
    // The key safety property: never filter bid B's takeoff with bid A's version.
    expect(resolveTaggedVersion({ bidId: 'bidA', versionId: 'vX' }, 'bidB')).toBeNull()
  })

  it('returns null when the ref is unset', () => {
    expect(resolveTaggedVersion(null, 'bidA')).toBeNull()
  })
})
